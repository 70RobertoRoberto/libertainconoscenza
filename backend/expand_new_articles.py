"""Expand the 32 newly-seeded articles to ~2000 words each using the Emergent LLM key.

The 32 target articles are identified by title (matches the list in seed_more_articles.py).
For each, we ask an LLM to produce a long-form Italian article of ~2000 words, coherent with the
current short summary, using paragraphs separated by double newlines.

Run: cd /app/backend && python3 expand_new_articles.py
"""

import asyncio
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")

TARGET_TITLES = [
    "L'arte di dire no: confini sani per una vita piena",
    "Le abitudini invisibili che plasmano il nostro destino",
    "Vulnerabilità: la porta segreta della forza autentica",
    "Il silenzio interiore come porta del sacro",
    "I sette chakra e i centri energetici del corpo",
    "Sincronicità: quando l'universo parla il linguaggio dei simboli",
    "Entanglement quantistico: il mistero delle particelle che comunicano a distanza",
    "L'osservatore quantistico: la coscienza modifica la realtà?",
    "Acqua e memoria: la ricerca di Emoto e i cristalli",
    "La meditazione tonglen: trasformare il dolore in compassione",
    "Meditazione camminata: presenza in movimento",
    "Metta bhavana: la meditazione dell'amore gentile",
    "Qi Gong: la ginnastica energetica della tradizione cinese",
    "Tai Chi: meditazione in movimento per corpo e mente",
    "Ayurveda: i tre dosha e la medicina della natura",
    "Fitoterapia: le piante che curano oggi come ieri",
    "Idroterapia: l'acqua come strumento di guarigione",
    "Digiuno intermittente: pausa metabolica per la longevità",
    "Il bambino interiore: guarire le ferite dell'infanzia",
    "Attaccamento sicuro: le radici invisibili delle relazioni adulte",
    "Trauma e corpo: come le esperienze rimangono impresse nella carne",
    "Psiconeuroendocrinoimmunologia: mente, ormoni, difese in un unico sistema",
    "Agopuntura: la scienza incontra la tradizione millenaria",
    "Il microbiota intestinale: il secondo cervello che ci abita",
    "Stoicismo: la filosofia pratica per tempi turbolenti",
    "Il pensiero taoista: fluire con il Tao",
    "Fenomenologia della vita quotidiana: vedere ciò che è",
    "Dieta mediterranea: patrimonio dell'umanità per la longevità",
    "Zuccheri raffinati: il killer silenzioso che infiamma il corpo",
    "Cibo vivo: enzimi, germogli e fermenti per rigenerarsi",
    "Ascolto corporeo: quando il corpo diventa maestro",
    "Le fasce e il tessuto connettivo: la rete che ci tiene insieme",
]


SYSTEM_PROMPT = (
    "Sei un redattore editoriale esperto di crescita personale, spiritualità, "
    "meditazione, naturopatia, medicina integrata e biofisica quantistica. "
    "Scrivi in italiano fluente, elegante e ispirante, con un tono divulgativo ma profondo, "
    "adatto a lettori adulti che cercano contenuti di qualità. "
    "Devi scrivere un articolo LUNGO ESATTAMENTE di circa 2000 parole (assolutamente tra 1950 e 2100 parole). "
    "È OBBLIGATORIO raggiungere almeno 1950 parole: non fermarti prima. "
    "Struttura l'articolo in 10-14 paragrafi ben distinti, separati da DOPPIO A CAPO (\\n\\n). "
    "Ogni paragrafo deve essere sostanzioso (almeno 130-180 parole) e sviluppare un aspetto specifico del tema. "
    "Non usare titoli di sezione, non usare elenchi puntati, non usare grassetti o marcatori Markdown. "
    "Scrivi solo prosa fluida in italiano. Rispetta le indicazioni del riassunto iniziale, ampliando enormemente ogni concetto, "
    "citando ricerche scientifiche, autori storici, tradizioni sapienziali, esempi concreti, applicazioni pratiche, "
    "storia del concetto, obiezioni comuni, esperienze del lettore, invito alla pratica quotidiana. "
    "Non aggiungere firme, conclusioni tipo 'in questo articolo abbiamo visto...', né riferimenti a te stesso. "
    "Rispondi SOLO con il testo dell'articolo, senza alcun preambolo, senza segnalare la conta parole."
)


async def expand_one(title: str, short_summary: str, category: str) -> str:
    """Ask the LLM to write a ~2000-word article. Returns the expanded text."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    prompt = (
        f"Titolo: {title}\n"
        f"Categoria: {category}\n"
        f"Riassunto breve di partenza (non copiare, ampliare enormemente):\n{short_summary}\n\n"
        f"Scrivi ora l'articolo completo in italiano, RIGOROSAMENTE tra 1950 e 2100 parole, "
        f"seguendo tutte le indicazioni del sistema. Ricorda: minimo 1950 parole, non fermarti prima."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=SYSTEM_PROMPT,
    ).with_model("openai", "gpt-4o")

    response = await chat.send_message(UserMessage(text=prompt))
    return (response or "").strip()


async def process_article(db, title: str, sem: asyncio.Semaphore):
    async with sem:
        doc = await db.articles.find_one({"title": title})
        if not doc:
            print(f"  MISSING: {title}")
            return None
        current = doc.get("summary", "") or ""
        # Skip if already expanded (>1200 words means we already ran)
        if len(current.split()) > 1200:
            print(f"  SKIP (already long): {title[:60]}")
            return None

        category = doc.get("category", "")
        try:
            expanded = await expand_one(title, current, category)
        except Exception as e:
            print(f"  ERROR generating for '{title[:50]}': {e}")
            return None

        # sanity check
        wc = len(expanded.split())
        if wc < 800:
            print(f"  WARN short output ({wc} words) for: {title[:60]}")
            return None

        await db.articles.update_one(
            {"id": doc["id"]},
            {"$set": {"summary": expanded, "expanded_at": datetime.now(timezone.utc).isoformat()}},
        )
        print(f"  DONE ({wc} words): {title[:60]}")
        return wc


async def main():
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    if not EMERGENT_LLM_KEY:
        print("ERROR: EMERGENT_LLM_KEY not set in .env")
        return

    sem = asyncio.Semaphore(4)  # 4 concurrent LLM calls to avoid rate limits
    tasks = [process_article(db, t, sem) for t in TARGET_TITLES]
    results = await asyncio.gather(*tasks)
    done = [r for r in results if r]
    print(f"\nExpanded {len(done)}/{len(TARGET_TITLES)} articles.")
    if done:
        avg = sum(done) / len(done)
        print(f"Average length: {avg:.0f} words. Min: {min(done)}. Max: {max(done)}.")


if __name__ == "__main__":
    asyncio.run(main())
