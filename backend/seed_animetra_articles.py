"""Seed 2 articles from animetra.it.

Article 1: from https://animetra.it/presentazione/ + https://animetra.it/corso-collettivo/
Article 2: from https://animetra.it/about-us/
"""

import asyncio, json, os, re, uuid
from datetime import datetime, timezone

import trafilatura
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

CATEGORIES = [
    "Crescita personale", "Spirituale", "Fisica quantistica", "Meditazione",
    "Discipline orientali", "Naturopatia", "Psicologia", "Medicina Integrata",
    "Filosofia", "Nutrizione", "Somatognostica",
]

TARGETS = [
    {
        "source_url": "https://animetra.it/presentazione/",
        "aux_urls": ["https://animetra.it/corso-collettivo/"],
        "hint_category": "Spirituale",
        "image_url": "https://images.unsplash.com/photo-1547153760-18fc86324498?w=1200&auto=format&fit=crop&q=70",
    },
    {
        "source_url": "https://animetra.it/about-us/",
        "aux_urls": [],
        "hint_category": "Crescita personale",
        "image_url": "https://images.unsplash.com/photo-1518623489648-a173ef7824f3?w=1200&auto=format&fit=crop&q=70",
    },
]

SYSTEM_PROMPT = (
    "Sei un redattore editoriale esperto di crescita personale, spiritualità, danza consapevole, "
    "movimento sacro, meditazione e discipline dell'Anima. "
    "Scrivi in italiano fluente, elegante e ispirante, con un tono divulgativo ma profondo e poetico. "
    "Devi produrre un articolo di CIRCA 1200 PAROLE (obbligatoriamente tra 1180 e 1280 parole), "
    "suddiviso in 7-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo ~140-180 parole. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Scrivi solo prosa fluida. "
    "Puoi menzionare 'Animetra' come nome del percorso descritto. "
    "NON menzionare mai il sito 'animetra.it' o altri URL. "
    "Non aggiungere firme, saluti o riferimenti a te stesso. "
    "Se nel testo di partenza incontri 'Metodo Cosmo', sostituiscilo con 'Metodo Summa Aurea'. "
    "Rispondi SOLO con un oggetto JSON valido con questa struttura esatta: "
    '{"title": "<nuovo titolo in italiano, evocativo>", '
    '"category": "<una delle categorie fornite>", '
    '"summary": "<il testo completo dell articolo, 1180-1280 parole>"}'
)


def fetch(url: str) -> str:
    html = trafilatura.fetch_url(url)
    if not html:
        return ""
    return trafilatura.extract(html, include_comments=False, include_tables=False) or ""


def clean_json_response(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


async def generate(base_text: str, hint_category: str) -> dict | None:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    base_text = base_text.replace("Metodo Cosmo", "Metodo Summa Aurea")
    prompt = (
        f"Categoria suggerita (usala se coerente): {hint_category}\n"
        f"Categorie disponibili: {', '.join(CATEGORIES)}\n\n"
        f"Testo di partenza (base da riscrivere in modo originale, senza copiare frasi intere):\n"
        f"{base_text[:6000]}\n\n"
        f"Ora produci il JSON richiesto."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        response = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        print(f"  LLM error: {e}")
        return None
    raw = clean_json_response(response or "")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            print(f"  Parse fail: {raw[:200]}")
            return None
        data = json.loads(m.group(0))
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    summary = (data.get("summary") or "").strip()
    summary = summary.replace("Metodo Cosmo", "Metodo Summa Aurea")
    summary = re.sub(r"animetra\.it", "", summary, flags=re.IGNORECASE)
    if not title or not summary:
        return None
    if category not in CATEGORIES:
        category = hint_category if hint_category in CATEGORIES else "Crescita personale"
    return {"title": title, "category": category, "summary": summary}


async def process(db, target: dict, idx: int):
    url = target["source_url"]
    existing = await db.articles.find_one({"source_url": url})
    if existing:
        print(f"[{idx}] SKIP already imported: {url}")
        return
    print(f"[{idx}] Fetching {url}")
    parts = [fetch(url)]
    for a in target["aux_urls"]:
        t = fetch(a)
        if t:
            parts.append(t)
    base = "\n\n".join(p for p in parts if p)
    if len(base) < 300:
        print(f"[{idx}] FAIL empty")
        return
    best = None
    best_wc = 0
    for attempt in range(3):
        r = await generate(base, target["hint_category"])
        if not r:
            continue
        wc = len(r["summary"].split())
        if wc > best_wc:
            best = r
            best_wc = wc
        if 1180 <= wc <= 1400:
            break
    if not best:
        print(f"[{idx}] FAIL generation")
        return
    doc = {
        "id": str(uuid.uuid4()),
        "title": best["title"],
        "summary": best["summary"],
        "category": best["category"],
        "source_url": url,
        "image_url": target["image_url"],
        "is_premium": False,
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expanded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.articles.insert_one(doc)
    print(f"[{idx}] INSERTED ({best_wc}w) [{best['category']}]: {best['title']}")


async def main():
    if not EMERGENT_LLM_KEY:
        print("Missing EMERGENT_LLM_KEY"); return
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await asyncio.gather(*[process(db, t, i+1) for i, t in enumerate(TARGETS)])
    print(f"\nTotal articles now: {await db.articles.count_documents({})}")


if __name__ == "__main__":
    asyncio.run(main())
