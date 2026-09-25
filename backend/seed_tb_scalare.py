"""Seed 1 editorial article on 'TB Scalare secondo il Metodo Summa Aurea'
into the 'Guarigione Energetica' category. Authored knowledge base
provided by the app owner (Dr. Roberto Fabbroni).

Run: cd /app/backend && python3 seed_tb_scalare.py
"""
import asyncio, json, os, re, uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

MARKER = "editorial:energy:tb-scalare-summa-aurea"

BRIEF = """
Scrivi un articolo divulgativo completo e autorevole sulla 'TB Scalare
(Tecnica Bioenergetica Scalare) secondo il Metodo Summa Aurea'.
Elementi cardine da includere (tutti):

- Nascita del Metodo Summa Aurea: percorso bioenergetico ideato e sviluppato
  a partire dal 2008 dal Dott. Roberto Fabbroni, all'interno del più ampio
  paradigma della Somatognostica Scalare Cardiocentrica.
- Cornice epistemica: la Somatognostica Scalare Cardiocentrica unifica
  fisica quantistica, biologia, psicoemotività e spiritualità trattando
  l'individuo come unità inscindibile di corpo-mente-spirito.
- Che cosa è la TB Scalare: metodologia operativa del Metodo Summa Aurea,
  forma di trattamento energetico-informazionale, complementare (mai
  sostitutiva) alle discipline sanitarie.
- Cuore del meccanismo: la TB Scalare utilizza l'Energia Scalare Spirituale
  per riportare il Campo Scalare Endogeno del cuore in fase con il Campo
  Primordiale (Vuoto Quantico), facilitando i processi di autoguarigione,
  la riscrittura cellulare e la modulazione sinaptica; il cuore è considerato
  come frequenza portante fondamentale dell'organismo.
- Il protocollo bioenergetico in QUATTRO FASI, spiegate con chiarezza:
    1. Pulizia del Canale — preparazione dell'operatore e liberazione da
       interferenze.
    2. Risonanza Empatica — sintonizzazione con il campo del ricevente.
    3. Richiamo dell'Energia Scalare (o Onda Scalare Spirituale) — accesso
       alla sorgente informazionale.
    4. Consolidamento (o Installazione) — stabilizzazione dei nuovi pattern.
- Ambiti di applicazione: si integra con osteopatia, fisioterapia, massaggio,
  ipnosi, counseling; utile in percorsi di riequilibrio emozionale,
  gestione dello stress, sostegno nei processi di cambiamento.
- Riferimenti bibliografici da citare in modo naturale nel testo:
  il saggio 'TB — Tecnica Bioenergetica secondo il Metodo Summa Aurea'
  (Phasar Edizioni, 2019); le pubblicazioni sulla Rivista Scienze
  Biofisiche; l'Istituto di Bioenergia come luogo formativo di riferimento.

Tono: divulgativo ma rigoroso, evocativo senza deriva new-age, con
chiara indicazione che la disciplina è complementare alla medicina
convenzionale. NON promettere guarigioni.
Lunghezza: 1200–1450 parole, 8–10 paragrafi separati da doppio a capo.
Nessun elenco puntato, nessun titoletto, nessun grassetto/Markdown.
Niente firma, niente saluti, nessuna menzione di siti sorgente o URL.
Titolo evocativo (non riprendere pari pari 'TB Scalare secondo il Metodo Summa Aurea').

Rispondi SOLO in JSON valido:
{"title": "...", "summary": "<testo dell'articolo>"}
"""

SYSTEM = (
    "Sei un redattore editoriale esperto di biofisica della guarigione, "
    "medicina integrata informazionale, energia scalare, coerenza cardiaca "
    "e discipline complementari. Scrivi in italiano fluente, chiaro, "
    "ispirante e rigoroso. Nessuna esagerazione né promesse terapeutiche. "
    "La disciplina è sempre presentata come complementare, mai sostitutiva "
    "della medicina convenzionale. Rispondi SOLO con JSON valido."
)


def clean_json(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


async def generate() -> dict | None:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    r = await chat.send_message(UserMessage(text=BRIEF))
    raw = clean_json(r or "")
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            print("Parse error, raw start:", raw[:200])
            return None
        d = json.loads(m.group(0))
    return {"title": (d.get("title") or "").strip(), "summary": (d.get("summary") or "").strip()}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    if await db.articles.find_one({"source_url": MARKER}):
        print("SKIP: article already exists.")
        return

    best = None
    best_wc = 0
    for attempt in range(4):
        r = await generate()
        if not r or not r["title"] or not r["summary"]:
            print(f"attempt {attempt + 1}: empty result")
            continue
        wc = len(r["summary"].split())
        print(f"attempt {attempt + 1}: {wc} words — {r['title']}")
        if 1150 <= wc <= 1500:
            best, best_wc = r, wc
            break
        if wc > best_wc:
            best, best_wc = r, wc

    if not best:
        print("FAILED to generate.")
        return

    if await db.articles.find_one({"title": best["title"]}):
        best["title"] += " – Approfondimento"

    doc = {
        "id": str(uuid.uuid4()),
        "title": best["title"],
        "summary": best["summary"],
        "category": "Guarigione Energetica",
        "source_url": MARKER,  # non-http -> "Articolo di Redazione"
        "image_url": "https://images.unsplash.com/photo-1518715058427-d33dda13c62b?w=1200&auto=format&fit=crop&q=70",
        "is_premium": False,
        "views": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.articles.insert_one(doc)
    print(f"✅ INSERTED ({best_wc} words): {best['title']}")


if __name__ == "__main__":
    asyncio.run(main())
