"""5 Kabbalah articles (base progressive) + retry Castello Interiore."""

import asyncio, json, os, re, uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

COURSE_NOTE = (
    "Chiudi l'articolo con un breve invito, integrato con naturalezza nel penultimo o "
    "ultimo paragrafo (NON come box separato), del tipo: 'Questo articolo è solo la "
    "porta d'ingresso a una tradizione millenaria. Presto Conoscenza Aperta offrirà "
    "un corso strutturato dedicato alla Kabbalah, per accompagnare chi desidera "
    "approfondire questo percorso di conoscenza interiore in modo progressivo e "
    "guidato.' Riformulalo con parole tue e in continuità con il tema."
)

TOPICS = [
    ("kabbalah-01",
     "PRIMO ARTICOLO INTRODUTTIVO alla Kabbalah, per lettori totalmente nuovi al tema. "
     "Titolo suggerito: 'La Kabbalah spiegata a chi sente il richiamo del Mistero'. "
     "Contenuti: cos'è la Kabbalah (letteralmente 'ricezione'), le sue radici nel "
     "misticismo ebraico (Sefer Yetzirah IV secolo, Sefer HaBahir XII secolo, Zohar "
     "XIII secolo attribuito a Moshè de León), i grandi maestri (Rabbi Shimon bar "
     "Yochai, Isaac Luria di Safed nel Cinquecento), la differenza tra Kabbalah "
     "tradizionale ebraica e Kabbalah cristiana/ermetica occidentale (Pico della "
     "Mirandola, Reuchlin), perché sta tornando a interessare le persone oggi. "
     "Tono divulgativo, accessibile ma rigoroso, senza tecnicismi eccessivi. "
     "Lascia il lettore con la curiosità di sapere di più. "
     + COURSE_NOTE,
     "Tradizioni Esoteriche",
     "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=1200&auto=format&fit=crop&q=70"),

    ("kabbalah-02",
     "SECONDO ARTICOLO: L'Albero della Vita. Titolo suggerito: 'L'Albero della Vita: "
     "la mappa dell'universo e dell'anima'. "
     "Contenuti: presentazione dell'Albero come struttura di 10 Sefirot (emanazioni "
     "divine) collegate da 22 sentieri, disposte in 3 colonne (Misericordia, "
     "Rigore, Equilibrio) e 4 mondi (Atziluth, Beriah, Yetzirah, Assiah). Nomi e "
     "significato delle 10 Sefirot in ordine dall'alto: Keter (Corona), Chokhmah "
     "(Sapienza), Binah (Intelligenza), Chesed (Amore/Misericordia), Gevurah "
     "(Rigore/Giustizia), Tiferet (Bellezza/Armonia), Netzach (Vittoria/Persistenza), "
     "Hod (Splendore/Umiltà), Yesod (Fondamento), Malkuth (Regno). Come 'leggere' "
     "l'Albero come mappa dei processi divini e delle qualità dell'anima umana. "
     "Cenno al Da'at (la conoscenza nascosta). Tono divulgativo, sereno, invitante. "
     + COURSE_NOTE,
     "Tradizioni Esoteriche",
     "https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1200&auto=format&fit=crop&q=70"),

    ("kabbalah-03",
     "TERZO ARTICOLO: Le lettere ebraiche come mattoni della creazione. "
     "Titolo suggerito: 'Le Lettere Ebraiche: quando l'alfabeto diventa preghiera'. "
     "Contenuti: le 22 lettere sacre dell'alfabeto ebraico secondo la Kabbalah "
     "(Sefer Yetzirah dice che Dio ha creato il mondo con lettere e numeri), il "
     "valore numerico di ogni lettera (ghematria) e come questo permetta di "
     "cogliere connessioni nascoste tra parole. Presenta 5-6 lettere significative "
     "con simbolismo: Aleph (silenzio/unità), Bet (casa/abitazione, prima lettera "
     "della Torah), Yod (goccia/scintilla, la più piccola, presente nel Nome), "
     "He (finestra/respiro), Vav (chiodo/connessione), Shin (fuoco/spirito). "
     "Cenno al Tetragramma (YHWH), Nome ineffabile di Dio. La lettura è insieme "
     "esoterica ed etica: le lettere plasmano la coscienza di chi le pronuncia. "
     + COURSE_NOTE,
     "Tradizioni Esoteriche",
     "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=1200&auto=format&fit=crop&q=70"),

    ("kabbalah-04",
     "QUARTO ARTICOLO: Le cinque anime nell'essere umano secondo la Kabbalah. "
     "Titolo suggerito: 'Le Cinque Anime: chi siamo davvero secondo la Kabbalah'. "
     "Contenuti: nella Kabbalah l'anima non è unica ma è formata da livelli "
     "concentrici sempre più elevati. Descrivi ciascuno: Nefesh (anima vitale, "
     "istinti, connessione al corpo), Ruach (spirito, emozioni, respiro, morale), "
     "Neshama (anima superiore, intelletto divino, discernimento etico), Chaya "
     "(essenza vivente, connessione al Trascendente, presente solo nei mistici), "
     "Yechida (unità con il Divino, l'anima come scintilla dell'Uno). Come queste "
     "cinque anime si sviluppano nella vita e nel percorso spirituale. Paralleli "
     "con altre tradizioni (i corpi sottili dello yoga, i tre livelli dell'anima "
     "in Aristotele/Aquino). Applicazioni pratiche: chiedersi 'quale mia anima "
     "sta parlando in questo momento'. "
     + COURSE_NOTE,
     "Tradizioni Esoteriche",
     "https://images.unsplash.com/photo-1518818419601-72c8673f5852?w=1200&auto=format&fit=crop&q=70"),

    ("kabbalah-05",
     "QUINTO ARTICOLO: Kabbalah come pratica quotidiana. "
     "Titolo suggerito: 'La Kabbalah nella vita di tutti i giorni: dalla teoria alla "
     "trasformazione interiore'. "
     "Contenuti: sfatare il mito che la Kabbalah sia solo teoria astratta. Presenta "
     "pratiche concrete accessibili: meditazione sui Nomi Divini (Ana BeKoach), "
     "utilizzo dell'Albero della Vita come strumento di introspezione (quale Sefirah "
     "è squilibrata in me oggi?), Tikkun Olam (la 'riparazione del mondo' come "
     "responsabilità etica quotidiana), Kavanah (l'intenzione cosciente in ogni "
     "azione), il rispetto dello Shabbat come metafora universale di ritmo tra "
     "azione e contemplazione. Cenni alla Kabbalah del cuore (Ba'al Shem Tov e il "
     "chassidismo). Chiudi con un'esortazione forte all'approfondimento e alla "
     "preparazione del corso strutturato in arrivo. "
     + COURSE_NOTE,
     "Tradizioni Esoteriche",
     "https://images.unsplash.com/photo-1470039694102-75bf70174ba9?w=1200&auto=format&fit=crop&q=70"),

    # RETRY Castello Interiore
    ("castello-interiore-retry",
     "Il Castello Interiore di Santa Teresa d'Ávila: l'opera del 1577 in cui la santa "
     "descrive l'anima come un castello di cristallo con sette Mansioni concentriche, "
     "e il cammino spirituale come un pellegrinaggio verso il centro dove abita Dio. "
     "Descrivi ognuna delle sette Mansioni (Prima: risveglio dell'anima; Seconda: "
     "prova dell'intenzione; Terza: pratica delle virtù; Quarta: preghiera di quiete; "
     "Quinta: unione trasformante; Sesta: matrimonio spirituale ferito; Settima: "
     "matrimonio mistico e chiara visione), la profondità psicologica dell'opera che "
     "anticipa temi che Jung svilupperà secoli dopo, l'immagine del castello come "
     "luce dorata che promana dal centro divino, la sua attualità come mappa del "
     "percorso di crescita interiore.",
     "Spirituale",
     "https://images.unsplash.com/photo-1466442929976-97f336a657be?w=1200&auto=format&fit=crop&q=70"),
]

SYSTEM = (
    "Sei un redattore editoriale esperto di Kabbalah ebraica, mistica cristiana, "
    "tradizioni esoteriche e spiritualità. Scrivi in italiano fluente, chiaro, "
    "invitante e ispirante, con tono divulgativo ma rigoroso, evitando esagerazioni "
    "new-age. Il tuo obiettivo è accendere l'interesse del lettore. "
    "Devi produrre un articolo di MASSIMO 1500 parole (idealmente tra 1100 e 1500), "
    "suddiviso in 7-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo circa 130-200 parole. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Solo prosa fluida e discorsiva. "
    "Cita nomi, date, testi storici con naturalezza. "
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
        seed = f"phase1-kab:{key}"
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
