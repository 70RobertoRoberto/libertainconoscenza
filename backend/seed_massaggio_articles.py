"""Seed 20 divulgative articles from cure-naturali.it (Massaggio section).

Rules:
  - Interview URLs (label "Intervista" on source) are excluded upstream: only "Articolo"
    URLs listed below are processed.
  - Shiatsu articles (URL contains "shiatsu") → category "Discipline orientali".
  - Everything else (massaggio, osteopatia, riflessologia, kinesiologia, ...) →
    category "Medicina Integrata".
  - Max 1500 words per article, Italian prose, no Markdown headings.
  - Idempotent by source_url.

Run: cd /app/backend && python3 seed_massaggio_articles.py
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

ALLOWED_CATEGORIES = ["Medicina Integrata", "Discipline orientali"]

# 20 divulgative articles (interviews are excluded).
URLS = [
    # Massaggio generico → Medicina Integrata
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/massaggio-viscerale.html",
    "https://www.cure-naturali.it/terapie-naturali/massaggio/massaggio-olistico.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/massaggio-marma-ayurvedico.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/perche-il-massaggio-infonde-benessere.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/tappetino-chiodato-agopressione.html",
    # Osteopatia → Medicina Integrata
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/osteopatia-significato-e-cosa-cura.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/diventare-osteopata.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/quando-rivolgersi-a-un-osteopata.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/osteopata-legge-requisiti-professionali.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/osteopatia-per-bambini.html",
    # Riflessologia + kinesiologia + metameri → Medicina Integrata
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/riflessologia-mano.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/pianta-del-piede-e-organi-corrispondenti.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/riflessologia-plantare-per-l-ansia.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/riflessologia-cervicale.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/test-kinesiologico-come-funziona-e-a-cosa-serve.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/trattamento-dei-metameri-come-funziona.html",
    # Shiatsu → Discipline orientali
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/torcicollo-tra-shiatsu-e-medicina-cinese.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/le-tecniche-shiatsu-differenti-stili.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/shiatsu-cos-e-il-meodo-masunaga.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/massaggio/shiatsu-cos-e-il-metodo-namikoshi.html",
]

# Themed Unsplash images
IMAGE_MAP = {
    "shiatsu":       "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&auto=format&fit=crop&q=70",
    "osteopat":      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&auto=format&fit=crop&q=70",
    "riflessolog":   "https://images.unsplash.com/photo-1519824145371-296894a0daa9?w=1200&auto=format&fit=crop&q=70",
    "piede":         "https://images.unsplash.com/photo-1601379764061-51e6c95dcd88?w=1200&auto=format&fit=crop&q=70",
    "mano":          "https://images.unsplash.com/photo-1608501078713-8e445a709b39?w=1200&auto=format&fit=crop&q=70",
    "viscerale":     "https://images.unsplash.com/photo-1544162893-52c7b3fdae0b?w=1200&auto=format&fit=crop&q=70",
    "marma":         "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=1200&auto=format&fit=crop&q=70",
    "olistico":      "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=1200&auto=format&fit=crop&q=70",
    "tappetino":     "https://images.unsplash.com/photo-1518611012118-696072aa579a?w=1200&auto=format&fit=crop&q=70",
    "cervical":      "https://images.unsplash.com/photo-1591343395082-e120087004b4?w=1200&auto=format&fit=crop&q=70",
    "ansia":         "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=1200&auto=format&fit=crop&q=70",
    "kinesiolog":    "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&auto=format&fit=crop&q=70",
    "metamer":       "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=1200&auto=format&fit=crop&q=70",
    "bambin":        "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200&auto=format&fit=crop&q=70",
    "massagg":       "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&auto=format&fit=crop&q=70",
    "default":       "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=1200&auto=format&fit=crop&q=70",
}


def image_for(url: str, title: str) -> str:
    slug = (url + " " + title).lower()
    for kw, img in IMAGE_MAP.items():
        if kw in slug:
            return img
    return IMAGE_MAP["default"]


def category_for(url: str) -> str:
    return "Discipline orientali" if "shiatsu" in url.lower() else "Medicina Integrata"


SYSTEM_PROMPT = (
    "Sei un redattore editoriale esperto di discipline naturali, medicina integrata, "
    "massaggio olistico, osteopatia, riflessologia e shiatsu. Scrivi in italiano fluente, "
    "chiaro e ispirante, con tono divulgativo ma preciso. "
    "Devi produrre un articolo di MASSIMO 1500 parole (idealmente tra 1000 e 1500), "
    "suddiviso in 6-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo circa 130-200 parole, che sviluppi un aspetto specifico del tema. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Scrivi solo prosa fluida e discorsiva, divulgativa. "
    "Non aggiungere firme, saluti o riferimenti a te stesso o al testo di origine. "
    "NON menzionare mai il sito 'cure-naturali.it' né altri siti web sorgente. "
    "Non trasformare il testo in un'intervista: solo prosa divulgativa in terza persona. "
    "Rispondi SOLO con un oggetto JSON valido con questa struttura esatta: "
    '{"title": "<nuovo titolo evocativo in italiano, DIVERSO dall originale>", '
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
        f"Titolo originale (NON riprenderlo identico, riformulalo): {original_title}\n\n"
        f"Testo di partenza (base da riscrivere completamente, non copiare frasi):\n"
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
    summary = (data.get("summary") or "").strip()
    summary = re.sub(r"cure[-\s]?naturali\.it", "", summary, flags=re.IGNORECASE)
    if not title or not summary:
        return None
    return {"title": title, "summary": summary}


async def process_url(db, url: str, idx: int, sem: asyncio.Semaphore):
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

        cat = category_for(url)
        doc = {
            "id": str(uuid.uuid4()),
            "title": best["title"],
            "summary": best["summary"],
            "category": cat,
            "source_url": url,
            "image_url": image_for(url, best["title"]),
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        print(f"[{idx:02d}] ✅ INSERTED ({best_wc} words) [{cat}]: {best['title']}")
        return {"status": "inserted", "url": url, "title": best["title"], "wc": best_wc, "cat": cat}


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
    medint = sum(1 for r in ok if r.get("cat") == "Medicina Integrata")
    disc = sum(1 for r in ok if r.get("cat") == "Discipline orientali")
    print(f"  → Medicina Integrata:  {medint}")
    print(f"  → Discipline orientali:{disc}")
    for r in failed:
        print(f"  FAIL {r.get('url')} -> {r.get('reason')}")


if __name__ == "__main__":
    asyncio.run(main())
