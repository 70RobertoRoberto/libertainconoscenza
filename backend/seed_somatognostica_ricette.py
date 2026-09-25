"""Seed the 3 Somatognostica recipes into the "Nutrizione" category.

The site somatognostica.it belongs to the same author (Roberto), so we
insert the recipes verbatim (cleaned via trafilatura) — no LLM rewriting.

Run: cd /app/backend && python3 seed_somatognostica_ricette.py
"""
import asyncio
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

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# The 3 recipes on somatognostica.it (Ricette Pro-Collagene).
RECIPES = [
    {
        "url": "https://www.somatognostica.it/2026/07/31/cotoletta-con-fagioli-cannelli-e-ricotta-con-salsa-di-avocado/",
        "title": "Cotoletta con Fagioli Cannellini e Ricotta con Salsa di Avocado",
        "image": "https://www.somatognostica.it/wp-content/uploads/2026/07/Cotoletta-vegetale-con-salsa-di-avocado-870x416.jpg",
    },
    {
        "url": "https://www.somatognostica.it/2026/07/27/spaghetti-senza-glutine-con-funghi-cardoncelli-e-albume-ricetta-02/",
        "title": "Spaghetti senza Glutine con Funghi Cardoncelli e Albume",
        "image": "https://www.somatognostica.it/wp-content/uploads/2026/07/Piatto-di-spaghetti-con-funghi-cardoncelli-albume-duovo-prezzemolo-olio-doliva-e-succo-di-limone-870x416.jpg",
    },
    {
        "url": "https://www.somatognostica.it/2026/07/27/spaghetti-senza-glutine-con-funghi-cardoncelli-ricetta/",
        "title": "Spaghetti senza Glutine con Funghi Cardoncelli",
        "image": "https://www.somatognostica.it/wp-content/uploads/2026/07/Piatto-di-spaghetti-con-funghi-cardoncelli-ricotta-prezzemolo-olio-doliva-e-succo-di-limone-870x416.jpg",
    },
]


NOISE_PATTERNS = [
    r"^\s*Facebook\s*$",
    r"^\s*Email\s*$",
    r"^\s*WhatsApp\s*$",
    r"^\s*Telegram\s*$",
    r"^\s*Google Translate\s*$",
    r"^\s*Copy link\s*$",
    r"^\s*Post Views.*$",
    r"^\s*Condividi\s*$",
    r"^\s*Grazie per la condivisione.*$",
    r"^\s*Trova subito un servizio.*$",
    r"^\s*AddToAny.*$",
    r"^\s*Read More.*$",
    r"^\s*Di più.*$",
    r"^\s*A2A\s*$",
    r"^\s*Share\s*$",
    r"^\s*BESbswy.*$",
    r"^\s*Nessun commento\s*$",
    r"^\s*info@istitutobioenergia.*$",
    r"^\s*\d+\s+\w+\s+\d{4}\s*$",  # date lines
]


def clean_text(text: str) -> str:
    lines = []
    for line in text.split("\n"):
        line = line.rstrip()
        if not line.strip():
            lines.append("")
            continue
        if any(re.match(p, line) for p in NOISE_PATTERNS):
            continue
        lines.append(line)
    # collapse repeated blank lines
    out = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    return out


def fetch_recipe_body(url: str) -> str:
    print(f"  Fetching {url} …")
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        # fallback direct request
        r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        downloaded = r.text
    body = trafilatura.extract(downloaded, include_images=False, include_links=False, favor_precision=False)
    if not body:
        # fallback bs4
        soup = BeautifulSoup(downloaded, "html.parser")
        article = soup.find("article") or soup.find("div", class_="entry-content") or soup.find("div", class_="post")
        body = article.get_text("\n") if article else soup.get_text("\n")
    return clean_text(body or "")


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    inserted = 0
    skipped = 0
    for idx, recipe in enumerate(RECIPES, 1):
        print(f"[{idx}/{len(RECIPES)}] {recipe['title']}")
        # Idempotency: skip if source_url already present.
        exists = await db.articles.find_one({"source_url": recipe["url"]})
        if exists:
            print(f"  ↷ SKIP (already exists as id={exists.get('id')})")
            skipped += 1
            continue

        body = fetch_recipe_body(recipe["url"])
        if not body or len(body) < 300:
            print(f"  ✗ FAIL — body too short ({len(body)} chars)")
            continue

        # Prepend an intro line so the reader immediately understands the source & category.
        summary = (
            f"**{recipe['title']}** — una ricetta pro-collagene della "
            f"Somatognostica Scalare Cardiocentrica, pensata per nutrire la Matrice "
            f"Extracellulare, sostenere il collagene e mantenere la fluidità del "
            f"corpo (stato SOL) secondo i principi dell'alimentazione somatognostica.\n\n"
            + body
        )

        doc = {
            "id": str(uuid.uuid4()),
            "title": recipe["title"],
            "summary": summary,
            "category": "Nutrizione",
            "source_url": recipe["url"],
            "image_url": recipe["image"],
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        wc = len(body.split())
        print(f"  ✅ INSERTED ({wc} words)")
        inserted += 1

    print("\n===== SUMMARY =====")
    print(f"Inserted: {inserted}")
    print(f"Skipped:  {skipped}")


if __name__ == "__main__":
    asyncio.run(main())
