import asyncio, os, uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("/app/backend/.env")


async def run():
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    sys_msg = (
        "Sei un redattore esperto di mistica cristiana. Scrivi in italiano fluente. "
        "Rispondi in linguaggio semplice, prosa continua, senza markdown né elenchi. "
        "L'articolo deve avere tra 1100 e 1500 parole, in 7-9 paragrafi separati "
        "da doppio a capo. Nessun titolo di sezione. Nessuna firma."
    )
    prompt = (
        "Scrivi un articolo divulgativo su 'Il Castello Interiore' di Santa Teresa "
        "d'Avila del 1577. Descrivi le 7 Mansioni concentriche del castello di cristallo: "
        "Prima Mansione (risveglio dell'anima), Seconda (prova dell'intenzione), Terza "
        "(pratica delle virtù), Quarta (preghiera di quiete), Quinta (unione trasformante), "
        "Sesta (matrimonio spirituale ferito), Settima (matrimonio mistico e visione chiara). "
        "Includi la profondità psicologica che anticipa Jung, l'immagine del castello come "
        "luce dorata che promana dal centro divino, l'attualità come mappa del percorso "
        "interiore. INIZIA con un titolo evocativo sulla prima riga (senza #), poi lascia "
        "una riga vuota, poi il corpo dell'articolo."
    )
    for attempt in range(4):
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=str(uuid.uuid4()),
            system_message=sys_msg,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        r = await chat.send_message(UserMessage(text=prompt))
        text = (r or "").strip()
        lines = text.split("\n", 1)
        if len(lines) < 2:
            print(f"attempt {attempt+1}: no split"); continue
        title = lines[0].strip().lstrip("#").strip().strip('"').strip("'")
        body = lines[1].strip()
        # Remove any residual "Titolo:" prefix
        if title.lower().startswith("titolo:"):
            title = title[7:].strip()
        wc = len(body.split())
        print(f"attempt {attempt+1}: title='{title[:60]}...' wc={wc}")
        if not title or wc < 900 or wc > 1700:
            continue
        # Check duplicate title
        if await db.articles.find_one({"title": title}):
            title += " – Nuova prospettiva"
        doc = {
            "id": str(uuid.uuid4()),
            "title": title,
            "summary": body,
            "category": "Spirituale",
            "source_url": "phase1-extra:castello-interiore-final",
            "image_url": "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=1200&auto=format&fit=crop&q=70",
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        print(f"✅ INSERTED: {title} ({wc}p)")
        return
    print("FAILED all attempts")


asyncio.run(run())
