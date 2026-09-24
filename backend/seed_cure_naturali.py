"""Seed 30 articles from cure-naturali.it (Medicina naturale section).

For each URL:
  1. Download and extract the article body with trafilatura.
  2. Ask Claude Sonnet (via emergentintegrations) to:
       - Craft a fresh Italian title (different from the source)
       - Rewrite the article as clean Italian prose, MAX 1500 words
       - Classify the article as "Naturopatia" or "Medicina Integrata"
  3. Pick a themed Unsplash image based on topic keywords
  4. Insert the article (idempotent by source_url)

Run: cd /app/backend && python3 seed_cure_naturali.py
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

# Only these two categories are allowed for this batch.
ALLOWED_CATEGORIES = ["Naturopatia", "Medicina Integrata"]

URLS = [
    # Page 1
    "https://www.cure-naturali.it/articoli/terapie-naturali/medicina-alternativa/medicina-naturale-e-prevenzione.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/medicina-alternativa/professionista-olistico.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/sali-schussler.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/radiestesia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/shilajit.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/biorisonanza.html",
    # Page 2
    "https://www.cure-naturali.it/articoli/terapie-naturali/medicina-alternativa/movimento-del-legno.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/omotossicologia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/feng-shui.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/pranoterapia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/arteterapia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/pet-therapy.html",
    # Page 3
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/fitoterapia.html",
    "https://www.cure-naturali.it/articoli/terapie-naturali/medicina-alternativa/dolore-cronico-come-trattarlo-con-la-desomatizzazione.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/desomatizzazione.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/medicina-integrata.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/shunghite.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/aromaterapia.html",
    # Page 4
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/omeopatia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/Neo-tantra.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/cristalloterapia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/metodo-kneipp.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/auricoloterapia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/agopuntura.html",
    # Page 5
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/pressoterapia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/medicina-siddha.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/theta-healing.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/terapia-microbiologica.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/oligoterapia.html",
    "https://www.cure-naturali.it/enciclopedia-naturale/terapie-naturali/medicina-naturale/iridologia.html",
]

# Themed Unsplash images — a pool the script rotates through, keyed by topic.
TOPIC_IMAGES = {
    "erbe":       "https://images.unsplash.com/photo-1471943311424-646960669fbc?w=1200&auto=format&fit=crop&q=70",
    "fiori":      "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=1200&auto=format&fit=crop&q=70",
    "cristalli":  "https://images.unsplash.com/photo-1547954575-855750c57bd3?w=1200&auto=format&fit=crop&q=70",
    "acqua":      "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1200&auto=format&fit=crop&q=70",
    "agopuntura": "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&auto=format&fit=crop&q=70",
    "occhio":     "https://images.unsplash.com/photo-1508847154043-be5407fcaa5a?w=1200&auto=format&fit=crop&q=70",
    "orecchio":   "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&auto=format&fit=crop&q=70",
    "casa":       "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&auto=format&fit=crop&q=70",
    "pittura":    "https://images.unsplash.com/photo-1513475382585-d06e58bcb0e0?w=1200&auto=format&fit=crop&q=70",
    "cane":       "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=1200&auto=format&fit=crop&q=70",
    "cuore":      "https://images.unsplash.com/photo-1518715058427-d33dda13c62b?w=1200&auto=format&fit=crop&q=70",
    "olio":       "https://images.unsplash.com/photo-1600631308569-57eb1e0e87ac?w=1200&auto=format&fit=crop&q=70",
    "meditazione":"https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop&q=70",
    "energia":    "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=1200&auto=format&fit=crop&q=70",
    "montagna":   "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&auto=format&fit=crop&q=70",
    "foresta":    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1200&auto=format&fit=crop&q=70",
    "default":    "https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=1200&auto=format&fit=crop&q=70",
}


def image_for(url: str, title: str) -> str:
    slug = (url + " " + title).lower()
    keys_map = {
        "shilajit": "montagna",
        "shunghite": "cristalli",
        "cristallo": "cristalli",
        "sali": "acqua",
        "radiestes": "energia",
        "biorison": "energia",
        "pranoter": "energia",
        "theta": "energia",
        "kneipp": "acqua",
        "pressoter": "acqua",
        "aroma": "olio",
        "fitoter": "erbe",
        "oligoter": "erbe",
        "omeopat": "erbe",
        "auricol": "orecchio",
        "iridolog": "occhio",
        "agopunt": "agopuntura",
        "feng-shui": "casa",
        "feng shui": "casa",
        "arteterap": "pittura",
        "pet-therap": "cane",
        "pet therap": "cane",
        "desomatiz": "cuore",
        "movimento-del-legno": "foresta",
        "movimento del legno": "foresta",
        "neo-tantra": "meditazione",
        "tantra": "meditazione",
        "siddha": "meditazione",
        "microbiolog": "erbe",
        "prevenzione": "montagna",
        "professionista": "cuore",
        "omotossicolog": "erbe",
    }
    for kw, key in keys_map.items():
        if kw in slug:
            return TOPIC_IMAGES.get(key, TOPIC_IMAGES["default"])
    return TOPIC_IMAGES["default"]


SYSTEM_PROMPT = (
    "Sei un redattore editoriale esperto di naturopatia, medicina integrata, discipline "
    "olistiche e benessere della persona. Scrivi in italiano fluente, chiaro e ispirante, "
    "con tono divulgativo ma preciso. "
    "Devi produrre un articolo di MASSIMO 1500 parole (idealmente tra 1000 e 1500), "
    "suddiviso in 6-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo circa 130-200 parole, che sviluppi un aspetto specifico del tema. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Scrivi solo prosa fluida e discorsiva. Puoi citare tradizioni, autori, applicazioni "
    "pratiche, casi d'uso, controindicazioni e cenni scientifici quando pertinenti. "
    "Non aggiungere firme, saluti o riferimenti a te stesso o al testo di origine. "
    "NON menzionare mai il sito 'cure-naturali.it' né altri siti web sorgente. "
    "Devi scegliere UNA delle due categorie: 'Naturopatia' oppure 'Medicina Integrata'. "
    "Regola di massima: usa 'Naturopatia' per rimedi vegetali/minerali/rituali "
    "(fitoterapia, aromaterapia, oligoterapia, cristalli, sali, ecc.) e per pratiche "
    "energetiche/spirituali (pranoterapia, theta healing, radiestesia, cristallo, ecc.). "
    "Usa 'Medicina Integrata' quando il tema unisce esplicitamente medicina "
    "convenzionale e complementare, o quando parla di diagnosi/approcci sistemici "
    "(medicina cinese, agopuntura, iridologia, omeopatia, omotossicologia, biorisonanza, "
    "auricoloterapia, medicina Siddha, desomatizzazione, medicina integrata). "
    "Rispondi SOLO con un oggetto JSON valido con questa struttura esatta: "
    '{"title": "<nuovo titolo evocativo in italiano, DIVERSO dall originale>", '
    '"category": "Naturopatia" | "Medicina Integrata", '
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
    # Guard: hide source references
    summary = re.sub(r"cure[-\s]?naturali\.it", "", summary, flags=re.IGNORECASE)
    # Enforce 1500 word soft cap (if slightly over, we'll accept up to 1600)
    if not title or not summary:
        return None
    if category not in ALLOWED_CATEGORIES:
        category = "Naturopatia"
    return {"title": title, "category": category, "summary": summary}


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
            # Prefer entries within 1000-1500. Break early if in range.
            if 1000 <= wc <= 1500:
                best = result
                best_wc = wc
                break
            # Otherwise keep the longest so far, capped at 1600 (safety).
            if wc <= 1600 and wc > best_wc:
                best = result
                best_wc = wc
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
    results = await asyncio.gather(*[process_url(db, u, i, sem) for i, u in enumerate(URLS)])
    ok = [r for r in results if r and r.get("status") == "inserted"]
    skipped = [r for r in results if r and r.get("status") == "skipped"]
    failed = [r for r in results if r and r.get("status") == "failed"]
    print("\n===== SUMMARY =====")
    print(f"Inserted: {len(ok)}")
    print(f"Skipped:  {len(skipped)}")
    print(f"Failed:   {len(failed)}")
    naturopatia = sum(1 for r in ok if r.get("cat") == "Naturopatia")
    integrata = sum(1 for r in ok if r.get("cat") == "Medicina Integrata")
    print(f"  → Naturopatia:      {naturopatia}")
    print(f"  → Medicina Integrata:{integrata}")
    for r in failed:
        print(f"  FAIL {r.get('url')} -> {r.get('reason')}")


if __name__ == "__main__":
    asyncio.run(main())
