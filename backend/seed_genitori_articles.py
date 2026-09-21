"""Seed articles from genitorievoluti.it URLs.

For each URL:
  1. Downloads and extracts the article body with trafilatura.
  2. Sends the base text to an LLM (via emergentintegrations) with instructions to:
       - Craft a fresh Italian title
       - Rewrite the article as fluent Italian prose, ~1200 words (1180-1280)
       - Replace any occurrence of "Metodo Cosmo" with "Metodo Summa Aurea"
       - Suggest a category from the site's CATEGORIES list
  3. Chooses a themed Unsplash image
  4. Inserts an article document (idempotent by source_url)

Run: cd /app/backend && python3 seed_genitori_articles.py
"""

import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timezone

import requests
import trafilatura
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

CATEGORIES = [
    "Crescita personale",
    "Spirituale",
    "Fisica quantistica",
    "Meditazione",
    "Discipline orientali",
    "Naturopatia",
    "Psicologia",
    "Medicina Integrata",
    "Filosofia",
    "Nutrizione",
    "Somatognostica",
]

URLS = [
    "https://www.genitorievoluti.it/amore-movimento-e-liberta-lapproccio-pikler-per-lo-sviluppo-del-bambino/",
    "https://www.genitorievoluti.it/la-relazione-genitori-bambino-strumento-di-sviluppo-neuropsicomotorio-e-apprendimento/",
    "https://www.genitorievoluti.it/i-genitori-non-sbagliano-mai/",
    "https://www.genitorievoluti.it/comunicare-cuore-a-cuore-attraverso-il-metodo-summa-aurea-la-comunicazione-dellamore/",
    "https://www.genitorievoluti.it/il-percorso-di-crescita-personale-e-spirituale-summa-aurea-e-i-suoi-benefici/",
    "https://www.genitorievoluti.it/adhd-e-davvero-una-patologia/",
    "https://www.genitorievoluti.it/trascendere-il-caos-il-potere-delle-esperienze-sensoriali-nello-sviluppo-del-bambino/",
    "https://www.genitorievoluti.it/la-gravidanza-e-un-evento-naturale-non-una-malattia/",
    "https://www.genitorievoluti.it/adolescenza-questa-sconosciuta/",
    "https://www.genitorievoluti.it/__trashed-3/",
    "https://www.genitorievoluti.it/larte-del-gioco-e-la-sua-funzione-educativa/",
    "https://www.genitorievoluti.it/attenzione-concentrazione-ritmo-velocita/",
    "https://www.genitorievoluti.it/il-potere-dellamore-nella-nuova-genitorialita/",
    "https://www.genitorievoluti.it/il-diritto-di-comunicazione/",
    "https://www.genitorievoluti.it/lo-sviluppo-neuropsicomotorio-del-bambino-nel-primo-anno-di-vita/",
    "https://www.genitorievoluti.it/i-diritti-dellinfanzia-e-delladolescenza/",
    "https://www.genitorievoluti.it/evitare-i-conflitti-relazionali-attraverso-una-comunicazione-consapevole/",
]

# Themed images (parenting, child, family, communication, growth, meditation)
IMAGE_POOL = [
    "https://images.unsplash.com/photo-1476703993599-0035a21b17a9?w=1200&auto=format&fit=crop&q=70",  # mother child
    "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=1200&auto=format&fit=crop&q=70",  # child hands
    "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=1200&auto=format&fit=crop&q=70",  # baby feet
    "https://images.unsplash.com/photo-1602052793312-b99c2a9ee797?w=1200&auto=format&fit=crop&q=70",  # child running field
    "https://images.unsplash.com/photo-1607453998774-d533f65dac99?w=1200&auto=format&fit=crop&q=70",  # baby holding
    "https://images.unsplash.com/photo-1503919545889-aef636e10ad4?w=1200&auto=format&fit=crop&q=70",  # baby toes
    "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&auto=format&fit=crop&q=70",  # kid painting
    "https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=1200&auto=format&fit=crop&q=70",  # child playing
    "https://images.unsplash.com/photo-1544776527-68e63addedf7?w=1200&auto=format&fit=crop&q=70",     # pregnant belly
    "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=1200&auto=format&fit=crop&q=70",  # nature reflection
    "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1200&auto=format&fit=crop&q=70",  # teenager silhouette
    "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=1200&auto=format&fit=crop&q=70",  # sunset field
    "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=1200&auto=format&fit=crop&q=70",
    "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&auto=format&fit=crop&q=70",  # kids reading
    "https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?w=1200&auto=format&fit=crop&q=70",  # meditation
    "https://images.unsplash.com/photo-1541199249251-f713e6145474?w=1200&auto=format&fit=crop&q=70",  # child freedom
    "https://images.unsplash.com/photo-1544027993-37dbfe43562a?w=1200&auto=format&fit=crop&q=70",     # parent child talking
]

SYSTEM_PROMPT = (
    "Sei un redattore editoriale esperto di crescita personale, spiritualità, psicologia, "
    "genitorialità, sviluppo del bambino, comunicazione consapevole e naturopatia. "
    "Scrivi in italiano fluente, elegante e ispirante, con un tono divulgativo ma profondo. "
    "Devi produrre un articolo di CIRCA 1200 PAROLE (obbligatoriamente tra 1180 e 1280 parole), "
    "suddiviso in 7-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo ~140-180 parole, sviluppando un aspetto specifico del tema. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Scrivi solo prosa fluida. Cita ricerche, autori, tradizioni sapienziali, applicazioni pratiche. "
    "Non aggiungere firme, saluti o riferimenti a te stesso. "
    "NON menzionare mai il sito 'genitorievoluti.it' né altri siti web sorgente. "
    "IMPORTANTE: se nel testo di partenza incontri 'Metodo Cosmo', sostituiscilo sempre con "
    "'Metodo Summa Aurea'. Non usare mai 'Metodo Cosmo' nel testo finale. "
    "Rispondi SOLO con un oggetto JSON valido con questa struttura esatta: "
    '{"title": "<nuovo titolo in italiano, evocativo, diverso dall originale>", '
    '"category": "<una delle categorie fornite>", '
    '"summary": "<il testo completo dell articolo, 1180-1280 parole>"}'
)


def fetch_source(url: str) -> tuple[str | None, str | None]:
    """Return (title, extracted_text)."""
    try:
        html = trafilatura.fetch_url(url)
        if not html:
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
            html = r.text
        text = trafilatura.extract(html, include_comments=False, include_tables=False)
        # Try to grab the title from the HTML
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        h1 = soup.find("h1")
        title = h1.get_text(strip=True) if h1 else None
        return title, text
    except Exception as e:
        print(f"  FETCH ERROR {url}: {e}")
        return None, None


def clean_json_response(raw: str) -> str:
    raw = raw.strip()
    # Remove markdown fences
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


async def generate_article(original_title: str, base_text: str) -> dict | None:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    # Pre-substitute in the base text to bias the model
    base_text = base_text.replace("Metodo Cosmo", "Metodo Summa Aurea")
    prompt = (
        f"Titolo originale (da NON riprendere identico, riformulalo): {original_title}\n\n"
        f"Categorie disponibili (scegline UNA, esattamente come scritta): {', '.join(CATEGORIES)}\n\n"
        f"Testo di partenza (base da riscrivere completamente, non copiare frasi):\n"
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
        print(f"  LLM ERROR: {e}")
        return None
    raw = clean_json_response(response or "")
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Attempt to salvage by finding the outermost JSON braces
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            print(f"  PARSE ERROR: could not find JSON in response (first 200 chars): {raw[:200]}")
            return None
        try:
            data = json.loads(m.group(0))
        except Exception as e:
            print(f"  PARSE ERROR: {e}")
            return None
    # Sanitize
    title = (data.get("title") or "").strip()
    category = (data.get("category") or "").strip()
    summary = (data.get("summary") or "").strip()
    # Guard: replace any leftover mentions
    summary = summary.replace("Metodo Cosmo", "Metodo Summa Aurea")
    summary = re.sub(r"genitorievoluti\.it", "", summary, flags=re.IGNORECASE)
    if not title or not summary:
        return None
    if category not in CATEGORIES:
        # Fallback mapping
        category = "Psicologia"
    return {"title": title, "category": category, "summary": summary}


async def process_url(db, url: str, idx: int, sem: asyncio.Semaphore):
    async with sem:
        # Idempotency: skip if we already imported this URL
        existing = await db.articles.find_one({"source_url": url})
        if existing:
            print(f"[{idx:02d}] SKIP already imported: {url}")
            return {"status": "skipped", "url": url}
        print(f"[{idx:02d}] Fetching: {url}")
        orig_title, base_text = fetch_source(url)
        if not base_text or len(base_text) < 300:
            print(f"[{idx:02d}] FAIL empty content")
            return {"status": "failed", "url": url, "reason": "empty content"}

        best = None
        best_wc = 0
        for attempt in range(3):
            result = await generate_article(orig_title or url, base_text)
            if not result:
                continue
            wc = len(result["summary"].split())
            if wc > best_wc:
                best = result
                best_wc = wc
            if 1180 <= wc <= 1400:
                break
        if not best:
            print(f"[{idx:02d}] FAIL generation")
            return {"status": "failed", "url": url, "reason": "generation failed"}
        # Final duplicate title check
        title_exists = await db.articles.find_one({"title": best["title"]})
        if title_exists:
            best["title"] = best["title"] + " – Nuova prospettiva"

        doc = {
            "id": str(uuid.uuid4()),
            "title": best["title"],
            "summary": best["summary"],
            "category": best["category"],
            "source_url": url,
            "image_url": IMAGE_POOL[idx % len(IMAGE_POOL)],
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expanded_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        print(f"[{idx:02d}] INSERTED ({best_wc} words) [{best['category']}]: {best['title']}")
        return {"status": "inserted", "url": url, "title": best["title"], "wc": best_wc}


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
    for r in failed:
        print(f"  FAIL {r.get('url')} -> {r.get('reason')}")


if __name__ == "__main__":
    asyncio.run(main())
