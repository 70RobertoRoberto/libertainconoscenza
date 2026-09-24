"""Extra articles: Noether, solitone scalare, Santa Teresa d'Avila, Castello Interiore, QFT semplice."""

import asyncio, json, os, re, uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TOPICS = [
    ("noether",
     "Il Teorema di Noether: come Emmy Noether nel 1918 dimostrò che ogni simmetria "
     "della natura corrisponde a una legge di conservazione (invarianza per traslazione "
     "temporale → conservazione dell'energia; per traslazione spaziale → conservazione "
     "del momento; per rotazione → conservazione del momento angolare). Racconta la sua "
     "vita straordinaria di matematica ebrea a Gottinga, l'importanza del teorema per "
     "la fisica moderna (relatività, meccanica quantistica, teorie di gauge, modello "
     "standard), e le implicazioni filosofiche sull'intima connessione tra bellezza, "
     "simmetria e leggi fisiche fondamentali.",
     "Fisica quantistica",
     "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200&auto=format&fit=crop&q=70"),
    ("solitone",
     "Il solitone scalare: cos'è un'onda solitaria che viaggia mantenendo la propria "
     "forma senza dissiparsi. Origini storiche (John Scott Russell che nel 1834 osserva "
     "un'onda solitaria in un canale scozzese, Korteweg e de Vries che la modellano "
     "matematicamente nel 1895), spiegazione divulgativa del solitone scalare come "
     "soluzione stabile di equazioni non lineari, esempi in natura (onde marine, "
     "tsunami solitari, impulsi ottici nelle fibre, condensati di Bose-Einstein, DNA), "
     "e sue applicazioni in telecomunicazioni ottiche, biofisica e cosmologia. "
     "Aggiungi una riflessione sul solitone come metafora di stabilità coerente in "
     "un universo in continua trasformazione.",
     "Fisica quantistica",
     "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=1200&auto=format&fit=crop&q=70"),
    ("teresa-avila",
     "Santa Teresa d'Ávila (1515-1582): la carmelitana spagnola che rivoluzionò la "
     "mistica cristiana e riformò l'ordine carmelitano. Racconta la sua vita "
     "straordinaria (nobile ebrea conversa, salute fragile, esperienza mistica dopo "
     "i quarant'anni, fondazione dei Carmelitani Scalzi con Giovanni della Croce), la "
     "sua eredità letteraria (Vita, Cammino di perfezione, Fondazioni, Castello "
     "Interiore), le sue esperienze mistiche (raptus, estasi, trafiggimento del cuore) "
     "e la sua canonizzazione e proclamazione a Dottore della Chiesa. Sottolinea come "
     "Teresa unisca profondità mistica e concretezza pratica, spiritualità e amicizia "
     "umana, esperienza intima con Dio e senso della comunità.",
     "Spirituale",
     "https://images.unsplash.com/photo-1470039694102-75bf70174ba9?w=1200&auto=format&fit=crop&q=70"),
    ("castello-interiore",
     "Il Castello Interiore di Santa Teresa d'Ávila: l'opera del 1577 in cui la santa "
     "descrive l'anima come un castello di cristallo con sette Mansioni concentriche, "
     "e il cammino spirituale come un pellegrinaggio verso il centro dove abita Dio. "
     "Descrivi ognuna delle sette Mansioni (Prima: risveglio dell'anima; Seconda: "
     "prova dell'intenzione; Terza: pratica delle virtù; Quarta: preghiera di "
     "quiete; Quinta: unione trasformante; Sesta: matrimonio spirituale ferito; "
     "Settima: matrimonio mistico e chiara visione), la profondità psicologica "
     "dell'opera anticipando temi che Jung svilupperà secoli dopo, e la sua attualità "
     "come mappa del percorso di crescita interiore. Metti in luce l'immagine del "
     "castello come luce dorata che promana dal centro divino.",
     "Spirituale",
     "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=1200&auto=format&fit=crop&q=70"),
    ("qft-semplice",
     "La Teoria Quantistica dei Campi (QFT) spiegata con parole semplici: perché a un "
     "certo punto la fisica ha dovuto abbandonare l'idea di particelle come piccole "
     "sfere e passare ai campi che permeano tutto lo spazio. Spiega senza formule "
     "come ogni particella (elettrone, fotone, quark) sia in realtà una vibrazione "
     "eccitata di un campo sottostante, come le forze fondamentali siano scambio di "
     "particelle mediatrici (fotoni per elettromagnetismo, gluoni per forte, W/Z per "
     "debole), e cosa significhi che il 'vuoto' contenga fluttuazioni virtuali "
     "costanti. Include cenni al modello standard, alle antimateria, all'elettrodinamica "
     "quantistica di Feynman e ai diagrammi di Feynman come strumento visivo. Chiudi "
     "con una riflessione su come la QFT dipinga un universo essenzialmente vibrazionale, "
     "in risonanza con antiche intuizioni spirituali sull'unità del tutto.",
     "Fisica quantistica",
     "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=70"),
]

SYSTEM = (
    "Sei un redattore editoriale esperto di fisica, matematica, mistica cristiana e "
    "spiritualità. Scrivi in italiano fluente, chiaro e ispirante, con tono "
    "divulgativo ma scientificamente e storicamente accurato. "
    "Devi produrre un articolo di MASSIMO 1500 parole (idealmente tra 1100 e 1500), "
    "suddiviso in 7-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo circa 130-200 parole. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Solo prosa fluida e discorsiva. Cita nomi ed esperimenti/eventi con naturalezza. "
    "Nessuna firma o nota di redazione. "
    "Rispondi SOLO con JSON valido: "
    '{"title": "<titolo evocativo>", "summary": "<articolo>"}'
)


def clean_json(raw):
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


async def gen(topic):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=SYSTEM,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        r = await chat.send_message(UserMessage(text=f"Argomento:\n\n{topic}\n\nProduci ora il JSON."))
    except Exception as e:
        print(f"  LLM err: {e}"); return None
    raw = clean_json(r or "")
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m: return None
        try: d = json.loads(m.group(0))
        except Exception: return None
    return {"title": (d.get("title") or "").strip(), "summary": (d.get("summary") or "").strip()}


async def process(db, spec, sem):
    key, topic, cat, img = spec
    async with sem:
        seed = f"phase1-extra:{key}"
        if await db.articles.find_one({"source_url": seed}):
            print(f"[{key}] SKIP"); return {"status": "skipped"}
        best = None; best_wc = 0
        for _ in range(4):
            r = await gen(topic)
            if not r or not r["title"] or not r["summary"]: continue
            wc = len(r["summary"].split())
            if 1100 <= wc <= 1500:
                best, best_wc = r, wc; break
            if wc <= 1600 and wc > best_wc:
                best, best_wc = r, wc
        if not best:
            print(f"[{key}] FAIL"); return {"status": "failed"}
        if await db.articles.find_one({"title": best["title"]}):
            best["title"] += " – Nuova prospettiva"
        doc = {
            "id": str(uuid.uuid4()),
            "title": best["title"],
            "summary": best["summary"],
            "category": cat,
            "source_url": seed,
            "image_url": img,
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        print(f"[{key}] ✅ ({best_wc}p) [{cat}]: {best['title']}")
        return {"status": "inserted", "cat": cat}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*[process(db, s, sem) for s in TOPICS])
    ok = sum(1 for r in results if r and r.get("status") == "inserted")
    print(f"\n===== SUMMARY: {ok}/{len(TOPICS)} inserted =====")


if __name__ == "__main__":
    asyncio.run(main())
