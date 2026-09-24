"""Seed 8 divulgative articles about movement therapies from cure-naturali.it.

The LLM auto-selects the best matching category from the app's official taxonomy.

Run: cd /app/backend && python3 seed_movimento_articles.py
"""

import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timezone

import requests
import trafilatura
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# Exact category names allowed in the app.
ALLOWED_CATEGORIES = [
    "Nutrizione",
    "Naturopatia",
    "Medicina Integrata",
    "Discipline orientali",
    "Psicologia",
    "Spiritualità",
    "Meditazione",
]

URLS = [
    "https://www.cure-naturali.it/articoli/terapie-naturali/terapie-del-movimento/earthing.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/terapie-del-movimento/terapia-psicomotoria.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/terapie-del-movimento/barefooting-camminare-scalzi.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/terapie-del-movimento/longevity-esercizi.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/terapie-del-movimento/massoterapia-cervicale.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/terapie-del-movimento/memoria-attivita-fisica.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/terapie-del-movimento/massoterapia-distrettuale.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/terapie-del-movimento/sviluppo-motorio-primi-due-mesi.html",
]

# Themed Unsplash images
IMAGE_MAP = {
    "earthing":       "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&auto=format&fit=crop&q=70",
    "barefoot":       "https://images.unsplash.com/photo-1526401485004-2fda9f4f5ffb?w=1200&auto=format&fit=crop&q=70",
    "scalz":          "https://images.unsplash.com/photo-1526401485004-2fda9f4f5ffb?w=1200&auto=format&fit=crop&q=70",
    "longevit":       "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&auto=format&fit=crop&q=70",
    "psicomotor":     "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200&auto=format&fit=crop&q=70",
    "massoter":       "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&auto=format&fit=crop&q=70",
    "cervical":       "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&auto=format&fit=crop&q=70",
    "memoria":        "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=1200&auto=format&fit=crop&q=70",
    "attivita-fisic": "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=1200&auto=format&fit=crop&q=70",
    "sviluppo-motor": "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=1200&auto=format&fit=crop&q=70",
    "primi-due-mes":  "https://images.unsplash.com/photo-1519689680058-324335c77eba?w=1200&auto=format&fit=crop&q=70",
    "default":        "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&auto=format&fit=crop&q=70",
}


def image_for(url: str, title: str) -> str:
    slug = (url + " " + title).lower()
    for kw, img in IMAGE_MAP.items():
        if kw in slug:
            return img
    return IMAGE_MAP["default"]


SYSTEM_PROMPT = (
    "Sei un redattore editoriale esperto di terapie del movimento, benessere corporeo, "
    "medicina integrata, discipline naturali e neuroscienze del corpo. Scrivi in italiano "
    "fluente, chiaro e ispirante, con tono divulgativo ma preciso. "
    "Devi produrre un articolo di MASSIMO 1500 parole (idealmente tra 1000 e 1500), "
    "suddiviso in 6-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo circa 130-200 parole, che sviluppi un aspetto specifico del tema. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Scrivi solo prosa fluida e discorsiva, divulgativa, in terza persona. "
    "Non aggiungere firme, saluti o riferimenti a te stesso o al testo di origine. "
    "NON menzionare mai il sito 'cure-naturali.it' né altri siti web sorgente. "
    "Non trasformare il testo in un'intervista. "
    "\n\n"
    "Devi anche classificare l'articolo scegliendo UNA SOLA categoria tra queste, "
    "esattamente come sono scritte:\n"
    "- Nutrizione (alimentazione, cibo, dieta)\n"
    "- Naturopatia (rimedi naturali, pratiche olistiche naturali come earthing, "
    "barefooting, contatto con la natura, energia naturale)\n"
    "- Medicina Integrata (massaggio terapeutico, massoterapia, osteopatia, "
    "riflessologia, tecniche corporee che combinano tradizione e medicina moderna, "
    "esercizi per longevità e salute)\n"
    "- Discipline orientali (shiatsu, yoga, qi gong, tai chi, meditazioni orientali, "
    "medicina tradizionale cinese)\n"
    "- Psicologia (mente, emozioni, sviluppo psicologico, psicomotricità, neuroscienze "
    "cognitive, memoria, sviluppo infantile emotivo/cognitivo)\n"
    "- Spiritualità (crescita interiore, coscienza, spiritualità)\n"
    "- Meditazione (pratiche meditative)\n"
    "\n"
    "Scegli la categoria più coerente con il tema principale del testo. "
    "Rispondi SOLO con un oggetto JSON valido con questa struttura esatta: "
    '{"title": "<nuovo titolo evocativo in italiano, DIVERSO dall originale>", '
    '"category": "<una delle 7 categorie esatte sopra>", '
    '"summary": "<il testo completo dell articolo, massimo 1500 parole>"}'
)


def fetch_source(url: str):
    try:
        html = trafilatura.fetch_url(url)
        if not html:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=25)
            html = r.text
        text = trafilatura.extract(html, include_comments=False, include_tables=False)
        soup = BeautifulSoup(html, "html.parser")
        h1 = soup.find("h1")
        title = h1.get_text(strip=True) if h1 else None
        return title, text
    except Exception as e:
        print(f"  FETCH ERROR {url}: {e}")
        return None, None


def clean_json_response(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


async def generate_article(original_title: str, base_text: str):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = (
        f"Titolo originale (NON riprenderlo identico, riformulalo): {original_title}\n\n"
        f"Testo di partenza (base da riscrivere completamente):\n"
        f"{base_text[:7000]}\n\n"
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
        print(f"  LLM ERROR: {e}")
        return None
    raw = clean_json_response(response or "")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            print(f"  PARSE ERROR: no JSON (first 200): {raw[:200]}")
            return None
        try:
            data = json.loads(m.group(0))
        except Exception as e:
            print(f"  PARSE ERROR: {e}")
            return None
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    summary = (data.get("summary") or "").strip()
    summary = re.sub(r"cure[-\s]?naturali\.it", "", summary, flags=re.IGNORECASE)
    if not title or not summary:
        return None
    if category not in ALLOWED_CATEGORIES:
        category = "Medicina Integrata"
    return {"title": title, "category": category, "summary": summary}


async def process_url(db, url, idx, sem):
    async with sem:
        existing = await db.articles.find_one({"source_url": url})
        if existing:
            print(f"[{idx:02d}] SKIP already imported: {url}")
            return {"status": "skipped", "url": url}
        print(f"[{idx:02d}] Fetching: {url}")
        orig_title, base_text = fetch_source(url)
        if not base_text or len(base_text) < 250:
            print(f"[{idx:02d}] FAIL empty content ({len(base_text or '')} chars)")
            return {"status": "failed", "url": url, "reason": "empty content"}

        best = None
        best_wc = 0
        for attempt in range(3):
            result = await generate_article(orig_title or url, base_text)
            if not result:
                continue
            wc = len(result["summary"].split())
            if 1000 <= wc <= 1500:
                best = result
                best_wc = wc
                break
            if wc <= 1600 and wc > best_wc:
                best = result
                best_wc = wc
        if not best:
            print(f"[{idx:02d}] FAIL generation")
            return {"status": "failed", "url": url, "reason": "generation failed"}

        title_exists = await db.articles.find_one({"title": best["title"]})
        if title_exists:
            best["title"] = best["title"] + " – Nuova prospettiva"

        doc = {
            "id": str(uuid.uuid4()),
            "title": best["title"],
            "summary": best["summary"],
            "category": best["category"],
            "source_url": url,
            "image_url": image_for(url, best["title"]),
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        print(f"[{idx:02d}] ✅ INSERTED ({best_wc} words) [{best['category']}]: {best['title']}")
        return {"status": "inserted", "url": url, "cat": best["category"], "wc": best_wc}


async def main():
    if not EMERGENT_LLM_KEY:
        print("EMERGENT_LLM_KEY missing")
        return
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*[process_url(db, u, i, sem) for i, u in enumerate(URLS)])
    ok = [r for r in results if r and r.get("status") == "inserted"]
    skipped = [r for r in results if r and r.get("status") == "skipped"]
    failed = [r for r in results if r and r.get("status") == "failed"]
    print("\n===== SUMMARY =====")
    print(f"Inserted: {len(ok)}")
    print(f"Skipped:  {len(skipped)}")
    print(f"Failed:   {len(failed)}")
    from collections import Counter
    cats = Counter(r.get("cat") for r in ok)
    for k, v in cats.items():
        print(f"  → {k}: {v}")
    for r in failed:
        print(f"  FAIL {r.get('url')} -> {r.get('reason')}")


if __name__ == "__main__":
    asyncio.run(main())
