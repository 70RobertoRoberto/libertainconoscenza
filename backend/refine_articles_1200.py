"""Refine articles to target ~1200 words (min 1150). Only re-generates those below 1150.

Run: cd /app/backend && python3 refine_articles_1200.py
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

TARGET_MIN = 1150
TARGET_IDEAL = 1200

SYSTEM_PROMPT = (
    "Sei un redattore editoriale esperto di crescita personale, spiritualità, "
    "meditazione, naturopatia, medicina integrata e biofisica quantistica. "
    "Scrivi in italiano fluente, elegante e ispirante, con un tono divulgativo ma profondo. "
    "Devi scrivere un articolo di CIRCA 1200 PAROLE (obbligatoriamente tra 1180 e 1280 parole). "
    "Struttura l'articolo in 7-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo deve essere sostanzioso, ~140-180 parole, sviluppando un aspetto specifico. "
    "Non usare titoli di sezione, non usare elenchi puntati, non usare grassetti o marcatori Markdown. "
    "Scrivi solo prosa fluida. Cita ricerche scientifiche, autori storici, tradizioni sapienziali, "
    "applicazioni pratiche. Non aggiungere firme, saluti o riferimenti a te stesso. "
    "Rispondi SOLO con il testo dell'articolo."
)


async def generate(title: str, short_summary: str, category: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = (
        f"Titolo: {title}\n"
        f"Categoria: {category}\n"
        f"Vecchio testo (base da riscrivere e ampliare, non copiare):\n{short_summary}\n\n"
        f"Scrivi l'articolo completo in italiano, tra 1180 e 1280 parole. "
        f"Sviluppa il tema in profondità con esempi, riferimenti e applicazioni pratiche."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-4o")
    response = await chat.send_message(UserMessage(text=prompt))
    return (response or "").strip()


async def process(db, doc: dict, sem: asyncio.Semaphore):
    async with sem:
        current = doc.get("summary", "") or ""
        wc_before = len(current.split())
        if wc_before >= TARGET_MIN:
            return None  # already good
        title = doc["title"]
        category = doc.get("category", "")
        best = current
        best_wc = wc_before
        for attempt in range(3):
            try:
                new = await generate(title, current if attempt == 0 else best, category)
            except Exception as e:
                print(f"  ERROR '{title[:50]}' attempt {attempt+1}: {e}")
                continue
            wc = len(new.split())
            if wc > best_wc:
                best = new
                best_wc = wc
            if wc >= TARGET_MIN:
                break
        if best_wc >= TARGET_MIN:
            await db.articles.update_one(
                {"id": doc["id"]},
                {"$set": {"summary": best, "expanded_at": datetime.now(timezone.utc).isoformat()}},
            )
            print(f"  DONE {wc_before} -> {best_wc}: {title[:60]}")
            return best_wc
        else:
            print(f"  KEPT SHORT {best_wc}: {title[:60]}")
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
    async for a in db.articles.find({"expanded_at": {"$exists": True}}, {"id": 1, "title": 1, "summary": 1, "category": 1}):
        wc = len((a.get("summary") or "").split())
        if wc < TARGET_MIN:
            docs.append(a)
    print(f"Refining {len(docs)} articles below {TARGET_MIN} words...")
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*[process(db, d, sem) for d in docs])
    ok = [r for r in results if r]
    print(f"\nUpdated {len(ok)}/{len(docs)} articles.")


if __name__ == "__main__":
    asyncio.run(main())
