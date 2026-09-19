"""Extend short articles by appending 2-3 new paragraphs until they reach ~1200 words.

Rather than asking the model to rewrite the whole thing at a specific length (unreliable),
we keep appending well-crafted paragraphs that continue naturally from the existing text.

Run: cd /app/backend && python3 extend_articles_append.py
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

TARGET_MIN = 1180


SYSTEM_APPEND = (
    "Sei un redattore editoriale esperto. Ti verrà fornito un articolo in italiano "
    "e dovrai aggiungere 3-4 nuovi paragrafi di continuazione, coerenti col testo esistente, "
    "che ampliano il tema con nuovi aspetti, esempi, ricerche, riferimenti storici o applicazioni pratiche. "
    "IMPORTANTE: rispondi SOLO con i nuovi paragrafi (senza ripetere il testo originale, senza premessa, "
    "senza titoli). Ogni paragrafo deve essere ~140-180 parole. Separali con doppio a capo. "
    "Non usare Markdown né elenchi puntati. Prosa italiana fluida. "
    "Non chiudere con frasi come 'in conclusione', 'per riassumere' o simili."
)


async def append_paragraphs(current_text: str, title: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = (
        f"Titolo articolo: {title}\n\n"
        f"Articolo attuale:\n---\n{current_text}\n---\n\n"
        f"Aggiungi 3-4 nuovi paragrafi di continuazione. Solo i nuovi paragrafi, "
        f"circa 500-700 parole complessive, coerenti col tono e il tema."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=SYSTEM_APPEND,
    ).with_model("openai", "gpt-4o")
    response = await chat.send_message(UserMessage(text=prompt))
    return (response or "").strip()


async def process(db, doc: dict, sem: asyncio.Semaphore):
    async with sem:
        current = doc.get("summary", "") or ""
        wc_before = len(current.split())
        if wc_before >= TARGET_MIN:
            return None
        title = doc["title"]
        text = current
        for attempt in range(4):
            wc = len(text.split())
            if wc >= TARGET_MIN:
                break
            try:
                addition = await append_paragraphs(text, title)
            except Exception as e:
                print(f"  ERROR '{title[:50]}' attempt {attempt+1}: {e}")
                break
            add_wc = len(addition.split())
            if add_wc < 100:
                print(f"  short addition ({add_wc}) for '{title[:50]}'")
                break
            text = text.rstrip() + "\n\n" + addition.strip()
        final_wc = len(text.split())
        if final_wc > wc_before and final_wc >= TARGET_MIN:
            await db.articles.update_one(
                {"id": doc["id"]},
                {"$set": {"summary": text, "expanded_at": datetime.now(timezone.utc).isoformat()}},
            )
            print(f"  DONE {wc_before} -> {final_wc}: {title[:60]}")
            return final_wc
        elif final_wc > wc_before:
            await db.articles.update_one(
                {"id": doc["id"]},
                {"$set": {"summary": text, "expanded_at": datetime.now(timezone.utc).isoformat()}},
            )
            print(f"  PARTIAL {wc_before} -> {final_wc}: {title[:60]}")
            return final_wc
        else:
            print(f"  NO CHANGE {wc_before}: {title[:60]}")
            return None


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    if not EMERGENT_LLM_KEY:
        print("EMERGENT_LLM_KEY missing")
        return
    docs = []
    async for a in db.articles.find({"expanded_at": {"$exists": True}}, {"id": 1, "title": 1, "summary": 1}):
        wc = len((a.get("summary") or "").split())
        if wc < TARGET_MIN:
            docs.append(a)
    print(f"Extending {len(docs)} articles below {TARGET_MIN} words...")
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*[process(db, d, sem) for d in docs])
    ok = [r for r in results if r]
    print(f"\nUpdated {len(ok)}/{len(docs)} articles.")


if __name__ == "__main__":
    asyncio.run(main())
