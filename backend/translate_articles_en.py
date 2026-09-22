"""Translate all Italian articles into English using Claude Sonnet 4.5.

For each article that doesn't yet have title_en/summary_en, invoke the LLM
to produce a faithful English translation, then persist the result in the
document. Runs are idempotent: articles that already have translations are
skipped, so this script can be re-run to fill any gap.

Usage:  cd /app/backend && python3 translate_articles_en.py
"""

import asyncio, json, os, re, uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


SYSTEM_PROMPT = (
    "You are a professional literary translator. Translate the given Italian "
    "text into fluent, elegant, natural English. Preserve every paragraph "
    "break (empty lines) exactly as in the source. Do NOT summarize. Do NOT "
    "add or remove any content. Keep proper names, Italian book titles, and "
    "author names untouched. Preserve markdown syntax if present "
    "(**bold**, *italic*, ## headings, - lists, > quotes). Do NOT wrap the "
    "output in quotes. Respond with a single JSON object of the form: "
    '{"title": "...", "summary": "..."} .'
)


def clean_json(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


async def translate(title: str, summary: str) -> dict | None:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = (
        f"Italian title:\n{title}\n\n"
        f"Italian body:\n{summary}\n\n"
        f"Produce the JSON translation."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        resp = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        print(f"    LLM error: {e}")
        return None
    raw = clean_json(resp or "")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return None
        try:
            data = json.loads(m.group(0))
        except Exception:
            return None
    if not data.get("title") or not data.get("summary"):
        return None
    return {"title": data["title"].strip(), "summary": data["summary"].strip()}


async def process(db, doc: dict, idx: int, sem: asyncio.Semaphore):
    async with sem:
        if doc.get("title_en") and doc.get("summary_en"):
            print(f"[{idx:03d}] SKIP already translated: {doc['title'][:60]}")
            return "skipped"
        print(f"[{idx:03d}] Translating: {doc['title'][:60]}")
        for _ in range(3):
            result = await translate(doc["title"], doc["summary"])
            if result:
                break
        else:
            print(f"[{idx:03d}] FAIL translation")
            return "failed"
        await db.articles.update_one(
            {"id": doc["id"]},
            {
                "$set": {
                    "title_en": result["title"],
                    "summary_en": result["summary"],
                    "translated_at": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
        wc = len(result["summary"].split())
        print(f"[{idx:03d}] OK ({wc} words en): {result['title'][:70]}")
        return "translated"


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    docs = await db.articles.find({}, {"_id": 0}).to_list(length=500)
    print(f"Total articles: {len(docs)}\n")
    sem = asyncio.Semaphore(4)
    results = await asyncio.gather(*[process(db, d, i + 1, sem) for i, d in enumerate(docs)])
    stats = {"translated": 0, "skipped": 0, "failed": 0}
    for r in results:
        if r in stats:
            stats[r] += 1
    print("\n===== SUMMARY =====")
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
