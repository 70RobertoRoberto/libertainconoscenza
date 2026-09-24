"""Phase 1: 20 original divulgative articles on Quantum Physics, Consciousness, and Spirituality.

Content is generated ex-novo by Claude Sonnet (no external scraping), then inserted
into the app database. Each article is 1000-1500 words in fluent Italian.

Special rule: whenever the article is flagged `heart_note=True`, the last paragraph
must include a note that new research in Quantum Biophysics is shifting attention
from the brain to the heart (Anima/Soul) as the true seat of consciousness.

Run: cd /app/backend && python3 seed_phase1_articles.py
"""

import asyncio
import json
import os
import re
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

# Available app categories.
ALLOWED_CATEGORIES = {
    "Fisica quantistica",
    "Coscienza",
    "Spirituale",
    "Spiritualità",
}

# Article specs: (topic prompt, category, heart_note flag, image_url)
TOPICS = [
    # ─── FISICA QUANTISTICA (7) ────────────────────────────────────────────
    (
        "Il principio di indeterminazione di Heisenberg e come ha rivoluzionato "
        "la visione della realtà: dalla fisica classica deterministica alla natura "
        "probabilistica e osservatore-dipendente della materia. Include cenni "
        "biografici, esperimenti, implicazioni filosofiche e connessioni con la "
        "coscienza dell'osservatore.",
        "Fisica quantistica", False,
        "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "L'entanglement quantistico: come due particelle possono restare connesse "
        "istantaneamente a qualsiasi distanza. Storia (Einstein, Podolsky, Rosen, "
        "l'esperimento di Bell e di Aspect), spiegazione accessibile, implicazioni "
        "per la non-località, e riflessioni sul possibile parallelo con la "
        "connessione tra esseri viventi e sistemi biologici.",
        "Fisica quantistica", False,
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "L'esperimento della doppia fenditura e il ruolo dell'osservatore: la scoperta "
        "che la sola osservazione modifica il comportamento delle particelle. Descrivi "
        "l'esperimento classico, la versione con il quantum eraser, e le implicazioni "
        "profonde per il ruolo della coscienza nel manifestare la realtà.",
        "Fisica quantistica", False,
        "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "I biofotoni: la luce coerente che il corpo umano emette. Le ricerche di "
        "Fritz-Albert Popp all'Università di Marburgo, le proprietà laser-simili di "
        "questa emissione, come si originano nel DNA, e il loro ruolo nella "
        "comunicazione tra cellule. Include applicazioni terapeutiche emergenti.",
        "Fisica quantistica", False,
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "I campi morfici di Rupert Sheldrake: l'ipotesi che una memoria collettiva "
        "invisibile guidi la forma e il comportamento dei sistemi biologici. "
        "Spiegazione accessibile della teoria, esperimenti condotti (topi labirinto, "
        "linguaggi, animali), critiche e possibili implicazioni per medicina, "
        "psicologia collettiva ed evoluzione.",
        "Fisica quantistica", False,
        "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "L'ipotesi Orch-OR di Roger Penrose e Stuart Hameroff: la coscienza come "
        "fenomeno quantistico che si origina nei microtubuli neuronali. Spiega la "
        "teoria in modo divulgativo, le critiche ricevute, gli esperimenti recenti "
        "che la supportano (Bandyopadhyay), e le conseguenze filosofiche per il "
        "problema mente-corpo.",
        "Fisica quantistica", True,
        "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Il vuoto quantistico e il campo unificato: dalla scoperta che il 'vuoto' "
        "è pieno di energia fluttuante alla teoria di Nassim Haramein di un "
        "campo di informazione universale che connette tutta la materia. Include "
        "cenni al lavoro di David Bohm sull'ordine implicato e implicazioni "
        "per la spiritualità e la coscienza collettiva.",
        "Fisica quantistica", False,
        "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1200&auto=format&fit=crop&q=70",
    ),
    # ─── COSCIENZA (7) ─────────────────────────────────────────────────────
    (
        "Cos'è la coscienza: dalle neuroscienze contemporanee (Correlati Neurali della "
        "Coscienza di Christof Koch, teoria dell'informazione integrata di Tononi) al "
        "'hard problem' di David Chalmers. Spiega perché la coscienza resta il mistero "
        "più grande della scienza e come le nuove ricerche stanno spostando lo sguardo "
        "oltre il solo cervello.",
        "Coscienza", True,
        "https://images.unsplash.com/photo-1544216428-8bff2cb03ca7?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Neuroscienze della meditazione: le ricerche di Richard Davidson e Matthieu "
        "Ricard sull'effetto di lungo termine della pratica meditativa. Descrivi i "
        "cambiamenti strutturali (aumento della materia grigia, corteccia prefrontale), "
        "funzionali (onde gamma, connettività) e le applicazioni cliniche (MBSR di "
        "Kabat-Zinn, MBCT).",
        "Coscienza", True,
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Le onde cerebrali e gli stati di coscienza: descrivi in dettaglio le onde "
        "Delta, Theta, Alpha, Beta e Gamma, quali stati mentali corrispondono a "
        "ciascuna (sonno profondo, ipnagogia, rilassamento vigile, attenzione focalizzata, "
        "estasi meditativa). Include applicazioni pratiche: come raggiungere gli stati "
        "utili tramite respirazione, meditazione, biofeedback.",
        "Coscienza", True,
        "https://images.unsplash.com/photo-1559757175-08d3f97e3c8f?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Il cuore energetico: le scoperte del HeartMath Institute. Il cuore possiede "
        "un campo elettromagnetico 5000 volte più intenso di quello cerebrale, ha una "
        "propria rete neurale (40.000 neuroni cardiaci), invia più segnali al cervello "
        "che viceversa. Include coerenza cardiaca, effetti sul benessere e implicazioni "
        "per l'idea che il cuore sia sede di intelligenza propria.",
        "Coscienza", False,
        "https://images.unsplash.com/photo-1518715058427-d33dda13c62b?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Esperienze di pre-morte (NDE): la ricerca scientifica di Pim van Lommel, "
        "Sam Parnia (AWARE Study) e Bruce Greyson. Descrivi le caratteristiche "
        "comuni (esperienza di uscita dal corpo, tunnel, luce, incontro con defunti, "
        "revisione della vita), la difficoltà di spiegarle solo con l'attività cerebrale, "
        "e le implicazioni per la natura non-locale della coscienza.",
        "Coscienza", True,
        "https://images.unsplash.com/photo-1518818419601-72c8673f5852?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Il biocentrismo di Robert Lanza: la teoria che la coscienza precede e crea "
        "la realtà fisica, non viceversa. Presenta i 7 principi del biocentrismo, "
        "gli argomenti scientifici (osservatore quantistico, principio antropico), "
        "e come questa visione capovolga la nostra concezione di universo, tempo, "
        "spazio e morte.",
        "Coscienza", False,
        "https://images.unsplash.com/photo-1465101046530-73398c7f28ca?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Il Global Consciousness Project di Princeton: da vent'anni una rete di "
        "generatori di numeri casuali sparsi nel mondo registra anomalie statistiche "
        "in coincidenza con eventi globali carichi emotivamente (11 settembre, "
        "cerimonie, disastri). Descrivi metodologia, risultati principali, ricercatori "
        "coinvolti (Roger Nelson) e cosa suggerisce sull'esistenza di una coscienza "
        "collettiva.",
        "Coscienza", False,
        "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=70",
    ),
    # ─── SPIRITUALITÀ (6) ──────────────────────────────────────────────────
    (
        "Meister Eckhart e la mistica cristiana renana: il monaco domenicano del XIII-XIV "
        "secolo che parlò di 'scintilla dell'anima' e dell'unione senza mediazione con "
        "il Divino. Include contesto storico, insegnamenti chiave (nascita di Dio "
        "nell'anima, distacco, essere e non-essere), condanna ecclesiastica e attualità "
        "del suo messaggio nel dialogo con le tradizioni orientali.",
        "Spirituale", False,
        "https://images.unsplash.com/photo-1470039694102-75bf70174ba9?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "San Giovanni della Croce e la Notte Oscura dell'anima: il carmelitano spagnolo "
        "del XVI secolo che descrisse il percorso mistico come attraversamento di due "
        "notti (dei sensi e dello spirito). Racconta la sua vita, la relazione con "
        "Teresa d'Ávila, il significato della 'notte oscura' come purificazione "
        "necessaria e la sua rilevanza per chi oggi attraversa crisi spirituali.",
        "Spirituale", False,
        "https://images.unsplash.com/photo-1518818419601-72c8673f5852?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "L'Advaita Vedanta: il non-dualismo indiano che afferma l'unità di Atman "
        "(anima individuale) e Brahman (assoluto). Storia della tradizione (Shankara "
        "nel VIII secolo), pratiche di auto-indagine, i grandi maestri del Novecento "
        "(Ramana Maharshi, Nisargadatta Maharaj) e il rinnovato interesse occidentale.",
        "Spirituale", False,
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Il cristianesimo esoterico e la Sophia: la corrente della tradizione cristiana "
        "che valorizza la conoscenza (gnosis) e la Sapienza divina personificata come "
        "figura femminile. Presenta gli gnostici antichi, il Vangelo di Tommaso, "
        "l'ortodossia russa (Solov'ëv, Bulgakov), le tradizioni templari e rosacruciane, "
        "e il ritorno contemporaneo della dimensione femminile del sacro.",
        "Spirituale", False,
        "https://images.unsplash.com/photo-1470039694102-75bf70174ba9?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "L'alchimia interiore come percorso di trasformazione: dalla tradizione "
        "occidentale (Nigredo, Albedo, Rubedo, Opus Magnum) all'alchimia interiore "
        "taoista (Nei Dan). Spiega il simbolismo (piombo trasformato in oro come "
        "trasformazione dell'ego in Sé), la lettura psicologica di Jung, e le "
        "pratiche moderne che si ispirano a questa tradizione.",
        "Spirituale", False,
        "https://images.unsplash.com/photo-1518715058427-d33dda13c62b?w=1200&auto=format&fit=crop&q=70",
    ),
    (
        "Le esperienze mistiche nella ricerca contemporanea: da 'Le varietà "
        "dell'esperienza religiosa' di William James (1902) a 'Le porte della "
        "percezione' di Aldous Huxley, fino agli studi moderni sulla psilocibina "
        "alla Johns Hopkins University. Descrivi le caratteristiche universali "
        "dell'esperienza mistica, la ricerca psichedelica riportata alla luce, "
        "e le implicazioni per una scienza della spiritualità.",
        "Spirituale", False,
        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop&q=70",
    ),
]


HEART_NOTE_INSTRUCTION = (
    "IMPORTANTE — nel PENULTIMO paragrafo (non l'ultimo, ma il penultimo, così da chiudere "
    "con una riflessione ampia) devi includere una nota di questo tipo, integrata in "
    "modo naturale nella prosa e non come box separato: "
    "\"Le più recenti ricerche in biofisica quantistica stanno spostando l'attenzione "
    "dal cervello al cuore, riconosciuto sempre di più come vera sede della coscienza "
    "e dimora dell'Anima. Il cuore non è più visto solo come pompa idraulica ma come "
    "centro di intelligenza propria, capace di generare campi elettromagnetici che "
    "influenzano tutto l'organismo e possibile ponte tra la dimensione biologica e "
    "quella spirituale dell'essere umano.\" "
    "Riscrivi questa nota con parole tue mantenendone il senso, e ancorala in modo "
    "organico al tema dell'articolo."
)


def system_prompt(need_heart: bool) -> str:
    base = (
        "Sei un redattore editoriale esperto di fisica quantistica, neuroscienze della "
        "coscienza, tradizioni mistiche e spiritualità. Scrivi in italiano fluente, "
        "chiaro e ispirante, con tono divulgativo ma preciso e scientificamente rigoroso "
        "dove serve. "
        "Devi produrre un articolo di MASSIMO 1500 parole (idealmente tra 1100 e 1500), "
        "suddiviso in 7-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
        "Ogni paragrafo circa 130-200 parole, che sviluppi un aspetto specifico del tema. "
        "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
        "Scrivi solo prosa fluida e discorsiva. Cita nomi di scienziati, esperimenti, "
        "date e riferimenti storici quando pertinenti, ma senza formattarli in modo "
        "speciale. "
        "Non aggiungere firme, saluti o note di redazione. "
    )
    if need_heart:
        base += HEART_NOTE_INSTRUCTION + " "
    base += (
        "Rispondi SOLO con un oggetto JSON valido con questa struttura esatta: "
        '{"title": "<titolo evocativo in italiano, chiaro e non generico>", '
        '"summary": "<il testo completo dell articolo>"}'
    )
    return base


def clean_json_response(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


async def generate_article(topic: str, need_heart: bool):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    prompt = (
        f"Argomento su cui scrivere l'articolo divulgativo:\n\n{topic}\n\n"
        f"Produci ora il JSON richiesto."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system_prompt(need_heart),
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
    if not title or not summary:
        return None
    return {"title": title, "summary": summary}


async def process_topic(db, spec, idx, sem):
    topic, category, need_heart, image = spec
    async with sem:
        # Idempotency: skip if a very similar seed key exists.
        seed_key = f"phase1:{category}:{idx:02d}"
        existing = await db.articles.find_one({"source_url": seed_key})
        if existing:
            print(f"[{idx:02d}] SKIP already generated: {seed_key}")
            return {"status": "skipped"}

        best = None
        best_wc = 0
        for attempt in range(3):
            result = await generate_article(topic, need_heart)
            if not result:
                continue
            wc = len(result["summary"].split())
            if 1100 <= wc <= 1500:
                best = result
                best_wc = wc
                break
            if wc <= 1600 and wc > best_wc:
                best = result
                best_wc = wc
        if not best:
            print(f"[{idx:02d}] FAIL generation")
            return {"status": "failed"}

        title_exists = await db.articles.find_one({"title": best["title"]})
        if title_exists:
            best["title"] = best["title"] + " – Nuova prospettiva"

        doc = {
            "id": str(uuid.uuid4()),
            "title": best["title"],
            "summary": best["summary"],
            "category": category,
            "source_url": seed_key,
            "image_url": image,
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        heart_flag = " ❤️ (nota cuore inclusa)" if need_heart else ""
        print(f"[{idx:02d}] ✅ ({best_wc}p) [{category}]{heart_flag}: {best['title']}")
        return {"status": "inserted", "cat": category, "wc": best_wc, "heart": need_heart}


async def main():
    if not EMERGENT_LLM_KEY:
        print("EMERGENT_LLM_KEY missing")
        return
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*[process_topic(db, s, i, sem) for i, s in enumerate(TOPICS)])
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
    heart_count = sum(1 for r in ok if r.get("heart"))
    print(f"  Note cuore incluse: {heart_count}")


if __name__ == "__main__":
    asyncio.run(main())
