"""Seed 10 EDITORIAL articles from cure-naturali.it/salute section.

Differences from seed_cure_naturali.py:
- Broader category set (Naturopatia, Medicina Integrata, Psicologia, Nutrizione,
  Crescita personale, Meditazione, Guarigione Energetica).
- Articles are stored as "Articoli di Redazione": source_url is stored with an
  "editorial:" prefix so the frontend regex ^https?:// fails, and the reader
  sees "Articolo di Redazione" — no source link. The prefix is kept internally
  only for idempotency (no re-import on re-run).
- The prompt explicitly forbids any mention of the origin site.

Run: cd /app/backend && python3 seed_salute_editorial.py
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

ALLOWED_CATEGORIES = [
    "Naturopatia",
    "Medicina Integrata",
    "Psicologia",
    "Nutrizione",
    "Crescita personale",
    "Meditazione",
    "Guarigione Energetica",
]

# 10 hand-picked articles from cure-naturali.it/salute — diverse topics.
URLS = [
    "https://www.cure-naturali.it/enciclopedia-naturale/salute/naturopatia/ansia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/salute/naturopatia/vertigini.html",
    "https://www.cure-naturali.it/articoli/salute/benessere/piaghe-da-decubito-rimedi-naturali.html",
    "https://www.cure-naturali.it/articoli/salute/estetica/curare-l-herpes-i-10-rimedi-piu-efficaci.html",
    "https://www.cure-naturali.it/articoli/salute/gravidanza/erbe-dannose-in-gravidanza-e-allattamento.html",
    "https://www.cure-naturali.it/articoli/salute/benessere/tosse-calorifero.html",
    "https://www.cure-naturali.it/articoli/salute/benessere/deplezione-di-magnesio-e-potassio-cardiaci.html",
    "https://www.cure-naturali.it/articoli/salute/benessere/barriera-intestinale-permeabile-disbiosi-estiva.html",
    "https://www.cure-naturali.it/articoli/salute/benessere/ipofisi-sotto-il-sole.html",
    "https://www.cure-naturali.it/articoli/salute/benessere/respirazione-4-7-8.html",
]

# Themed images (Unsplash, keyed by topic).
TOPIC_IMAGES = {
    "ansia":        "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=1200&auto=format&fit=crop&q=70",
    "vertigini":    "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200&auto=format&fit=crop&q=70",
    "pelle":        "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=1200&auto=format&fit=crop&q=70",
    "herpes":       "https://images.unsplash.com/photo-1550831107-1553da8c8464?w=1200&auto=format&fit=crop&q=70",
    "gravidanza":   "https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=1200&auto=format&fit=crop&q=70",
    "tosse":        "https://images.unsplash.com/photo-1584515933487-779824d29309?w=1200&auto=format&fit=crop&q=70",
    "cuore":        "https://images.unsplash.com/photo-1518715058427-d33dda13c62b?w=1200&auto=format&fit=crop&q=70",
    "intestino":    "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&auto=format&fit=crop&q=70",
    "sole":         "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&auto=format&fit=crop&q=70",
    "respiro":      "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop&q=70",
    "default":      "https://images.unsplash.com/photo-1517685633396-3d6c1a91f8f4?w=1200&auto=format&fit=crop&q=70",
}


def image_for(url: str, title: str) -> str:
    slug = (url + " " + title).lower()
    mapping = {
        "ansia": "ansia",
        "vertigin": "vertigini",
        "decubito": "pelle",
        "herpes": "herpes",
        "gravidanza": "gravidanza",
        "tosse": "tosse",
        "magnesio": "cuore",
        "potassio": "cuore",
        "cardiac": "cuore",
        "intestin": "intestino",
        "disbios": "intestino",
        "ipofisi": "sole",
        "sole": "sole",
        "respira": "respiro",
        "ansia": "ansia",
    }
    for kw, key in mapping.items():
        if kw in slug:
            return TOPIC_IMAGES[key]
    return TOPIC_IMAGES["default"]


SYSTEM_PROMPT = (
    "Sei un redattore editoriale esperto di salute naturale, benessere, "
    "naturopatia, medicina integrata, psicologia e nutrizione. Scrivi in "
    "italiano fluente, chiaro e ispirante, con tono divulgativo ma preciso. "
    "Produci un articolo di MASSIMO 1500 parole (idealmente 900-1400), "
    "suddiviso in 6-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo circa 130-200 parole, che sviluppi un aspetto specifico. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Scrivi solo prosa fluida e discorsiva. "
    "Non aggiungere firme, saluti o riferimenti a te stesso, all'autore o al "
    "testo di origine. "
    "REGOLA ASSOLUTA: NON menzionare mai il sito 'cure-naturali.it', nomi di autori, "
    "URL, riferimenti a 'l'articolo', 'la fonte', 'il testo originale', né altre "
    "citazioni esterne. Il testo deve leggersi come contenuto originale della "
    "redazione. "
    "Devi scegliere UNA delle seguenti categorie: 'Naturopatia', 'Medicina Integrata', "
    "'Psicologia', 'Nutrizione', 'Crescita personale', 'Meditazione', 'Guarigione Energetica'. "
    "Regole di classificazione: 'Naturopatia' per rimedi vegetali/erboristici, "
    "consigli fitoterapici, cure con erbe/oli/tinture. 'Medicina Integrata' per "
    "temi che uniscono medicina convenzionale e complementare o approcci sistemici "
    "(cuore, ormoni, sistema immunitario, elettroliti, disbiosi, ecc.). "
    "'Psicologia' per stati emotivi, ansia, stress. 'Nutrizione' per alimentazione. "
    "'Crescita personale' per abitudini quotidiane e benessere generale. "
    "'Meditazione' per tecniche di respirazione, mindfulness. "
    "'Guarigione Energetica' per riequilibri sottili. "
    "Rispondi SOLO con un oggetto JSON valido con questa struttura esatta: "
    '{"title": "<nuovo titolo evocativo in italiano, DIVERSO dall originale>", '
    '"category": "<una delle categorie sopra>", '
    '"summary": "<il testo completo dell articolo, massimo 1500 parole>"}'
)


def fetch_source(url: str) -> tuple[str | None, str | None]:
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


async def generate_article(original_title: str, base_text: str) -> dict | None:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = (
        f"Argomento (NON riprendere il titolo identico, riformulalo): {original_title}\n\n"
        f"Base testuale (da rielaborare completamente, non copiare frasi né riferimenti):\n"
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
            print(f"  PARSE ERROR: no JSON in response (first 200): {raw[:200]}")
            return None
        try:
            data = json.loads(m.group(0))
        except Exception as e:
            print(f"  PARSE ERROR: {e}")
            return None
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    summary = (data.get("summary") or "").strip()
    # Guard: nuke any residual source references
    summary = re.sub(r"cure[-\s]?naturali\.it", "", summary, flags=re.IGNORECASE)
    summary = re.sub(r"\bcure[-\s]?naturali\b", "", summary, flags=re.IGNORECASE)
    if not title or not summary:
        return None
    if category not in ALLOWED_CATEGORIES:
        category = "Naturopatia"
    return {"title": title, "category": category, "summary": summary}


# Editorial marker: kept internally for dedup, but frontend regex ^https?://
# FAILS on it, so the reader sees "Articolo di Redazione" (no source link).
EDITORIAL_PREFIX = "editorial:cure-naturali:"


async def process_url(db, url: str, idx: int, sem: asyncio.Semaphore):
    async with sem:
        marker = EDITORIAL_PREFIX + url
        existing = await db.articles.find_one({"source_url": marker})
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
            if 900 <= wc <= 1500:
                best = result
                best_wc = wc
                break
            if wc <= 1700 and wc > best_wc:
                best = result
                best_wc = wc
        if not best:
            print(f"[{idx:02d}] FAIL generation")
            return {"status": "failed", "url": url, "reason": "generation failed"}

        # Duplicate-title guard.
        title_exists = await db.articles.find_one({"title": best["title"]})
        if title_exists:
            best["title"] = best["title"] + " – Nuova prospettiva"

        doc = {
            "id": str(uuid.uuid4()),
            "title": best["title"],
            "summary": best["summary"],
            "category": best["category"],
            "source_url": marker,  # non-http → shown as "Articolo di Redazione"
            "image_url": image_for(url, best["title"]),
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        print(f"[{idx:02d}] ✅ INSERTED ({best_wc} words) [{best['category']}]: {best['title']}")
        return {"status": "inserted", "url": url, "title": best["title"], "wc": best_wc, "cat": best["category"]}


async def main():
    if not EMERGENT_LLM_KEY:
        print("EMERGENT_LLM_KEY missing")
        return
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*[process_url(db, u, i + 1, sem) for i, u in enumerate(URLS)])
    ok = [r for r in results if r and r.get("status") == "inserted"]
    skipped = [r for r in results if r and r.get("status") == "skipped"]
    failed = [r for r in results if r and r.get("status") == "failed"]
    print("\n===== SUMMARY =====")
    print(f"Inserted: {len(ok)}")
    print(f"Skipped:  {len(skipped)}")
    print(f"Failed:   {len(failed)}")
    for r in ok:
        print(f"  + [{r['cat']}] {r['title']} ({r['wc']}w)")
    for r in failed:
        print(f"  FAIL {r.get('url')} -> {r.get('reason')}")


if __name__ == "__main__":
    asyncio.run(main())
