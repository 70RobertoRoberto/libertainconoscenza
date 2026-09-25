"""Seed 8 original editorial articles on Guarigione Energetica.

Fresh, redazionali content (no external source) — same pattern as
seed_kabbalah_articles.py. Articles appear as "Articolo di Redazione"
in the app because source_url is a non-http seed marker.

Run: cd /app/backend && python3 seed_guarigione_energetica.py
"""
import asyncio, json, os, re, uuid
from datetime import datetime, timezone
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

CATEGORY = "Guarigione Energetica"

# 8 diverse, complementary topics covering the main branches of energy healing.
TOPICS = [
    ("energy-01",
     "PRIMO ARTICOLO INTRODUTTIVO alla Guarigione Energetica per lettori nuovi. "
     "Titolo suggerito: 'Il campo che ci abita: introduzione alla guarigione energetica'. "
     "Contenuti: cosa si intende per 'energia' nel contesto della guarigione (Chi, Prana, "
     "Ki, Ruach, campi bioelettromagnetici), differenza tra guarigione energetica come "
     "pratica di riequilibrio e medicina convenzionale (complementare, non sostitutiva), "
     "cenni storici brevi (medicina cinese oltre 5000 anni, Ayurveda, culti templari "
     "egizi, medicina ippocratica, guaritori tradizionali europei). "
     "La visione olistica: corpo-mente-emozione-spirito come sistema unico. Il concetto "
     "di 'blocco energetico' e 'flusso'. Le evidenze scientifiche recenti (biofotoni "
     "Popp, campo elettromagnetico del cuore misurato dal HeartMath Institute, "
     "microtubuli e coerenza quantistica secondo Hameroff-Penrose). "
     "Chiudi invitando ad approfondire con i successivi articoli.",
     "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=1200&auto=format&fit=crop&q=70"),

    ("energy-02",
     "SECONDO ARTICOLO: I sette chakra e la mappa energetica del corpo. "
     "Titolo suggerito: 'I sette centri: la mappa energetica dell'essere umano'. "
     "Contenuti: origine del concetto di chakra nella tradizione tantrica indiana "
     "(Upanishad, Yoga Sutra di Patanjali, testi Hatha Yoga Pradipika XV secolo), "
     "descrizione dei 7 chakra principali dall'alto verso il basso con nome sanscrito, "
     "colore, elemento, ghiandola endocrina associata, tema psicologico, sintomi di "
     "squilibrio: Muladhara (radice, rosso, terra, sopravvivenza), Svadhisthana (sacro, "
     "arancio, acqua, creatività ed emozioni), Manipura (plesso solare, giallo, fuoco, "
     "autostima e volontà), Anahata (cuore, verde, aria, amore e connessione), "
     "Vishuddha (gola, blu, etere, espressione autentica), Ajna (terzo occhio, indaco, "
     "luce, intuizione), Sahasrara (corona, viola/bianco, coscienza, spiritualità). "
     "Cenno alla corrispondenza con i plessi nervosi della medicina occidentale. "
     "Pratiche semplici di autoascolto per ciascun chakra.",
     "https://images.unsplash.com/photo-1545389336-cf090694435e?w=1200&auto=format&fit=crop&q=70"),

    ("energy-03",
     "TERZO ARTICOLO: L'aura e il campo biofisico. "
     "Titolo suggerito: 'Il corpo di luce: comprendere l'aura e i corpi sottili'. "
     "Contenuti: cos'è l'aura nella tradizione mistica ed esoterica (Barbara Brennan, "
     "Alice Bailey, Rudolf Steiner con il suo Corpo Eterico, tradizione teosofica). "
     "Descrizione dei 7 corpi sottili classici: fisico, eterico, emozionale, mentale, "
     "causale, buddhico, atmico. La ricerca scientifica sul campo bioelettromagnetico: "
     "esperimenti di Semyon Kirlian negli anni Trenta, misurazioni GDV di Konstantin "
     "Korotkov, la biofotonica di Fritz-Albert Popp. Perché alcune persone 'sentono' "
     "l'aura altrui (empatia energetica). Pratiche di auto-lettura energetica: "
     "scannerizzazione mentale, palme che avvertono calore/formicolio, percezione "
     "cromatica. Come proteggere il proprio campo (visualizzazione della sfera di "
     "luce, docce di sale, contatto con la natura).",
     "https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=1200&auto=format&fit=crop&q=70"),

    ("energy-04",
     "QUARTO ARTICOLO: Reiki, la tecnica di canalizzazione dell'energia universale. "
     "Titolo suggerito: 'Reiki: quando le mani diventano canale'. "
     "Contenuti: origini del Reiki nel Giappone di inizio Novecento con Mikao Usui "
     "(1865-1926), il suo digiuno spirituale sul monte Kurama e la trasmissione a "
     "Chujiro Hayashi e poi ad Hawayo Takata che lo portò in Occidente. Significato "
     "delle parole 'Rei' (universale) e 'Ki' (energia vitale). I tre livelli iniziatici "
     "classici (Shoden, Okuden, Shinpiden) e le armonizzazioni. I cinque principi del "
     "Reiki (Gokai): solo per oggi non arrabbiarti, non preoccuparti, sii grato, lavora "
     "onestamente, sii gentile con ogni essere. Le posizioni delle mani, il trattamento "
     "completo. Le evidenze cliniche moderne (studi su ansia, dolore, chemioterapia). "
     "Chiarire che il Reiki non 'guarisce' malattie: attiva il potenziale di autoguarigione. "
     "Le derivazioni contemporanee (Reiki Karuna, Reiki Tibetano, Seichim).",
     "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=1200&auto=format&fit=crop&q=70"),

    ("energy-05",
     "QUINTO ARTICOLO: La pranoterapia, tradizione italiana del guaritore. "
     "Titolo suggerito: 'Pranoterapia: la scienza delle mani sensibili'. "
     "Contenuti: origine del termine dal sanscrito 'Prana' (soffio vitale). La "
     "tradizione europea dei guaritori: dal 'tocco reale' di Filippo il Bello che "
     "guariva la scrofola, ai magnetizzatori di Franz Anton Mesmer nel Settecento "
     "(magnetismo animale), fino ai grandi pranoterapisti italiani del Novecento "
     "come Nicola Cutolo (Torre Annunziata, il 'guaritore di Torre') e Mauro Battaglia. "
     "Il riconoscimento istituzionale in Italia: la disciplina è tutelata dalla Legge "
     "4/2013 sulle professioni non organizzate. Come lavora un pranoterapista: "
     "scanning delle mani a 5-30 cm dal corpo, imposizione, trasmissione dell'energia. "
     "La differenza con il Reiki (nel Reiki si è canale passivo, in pranoterapia si "
     "usa la propria energia). Sensazioni comuni del ricevente. Controindicazioni e "
     "limiti etici della pratica.",
     "https://images.unsplash.com/photo-1600631308569-57eb1e0e87ac?w=1200&auto=format&fit=crop&q=70"),

    ("energy-06",
     "SESTO ARTICOLO: Cristalloterapia e minerali come alleati energetici. "
     "Titolo suggerito: 'Il popolo silente della Terra: cristalli e minerali come alleati'. "
     "Contenuti: origini antichissime dell'uso dei cristalli: sciamani preistorici, "
     "ka egizio, medicina tibetana, tradizione ippocratica, i Cristalli-Signori di "
     "Ildegarda di Bingen (XII secolo, il suo trattato 'Physica' descrive 26 pietre). "
     "Il fondamento scientifico: struttura reticolare cristallina che vibra a frequenze "
     "specifiche (piezoelettricità del quarzo scoperta da Pierre e Jacques Curie nel "
     "1880, oggi usata negli orologi al quarzo). Presenta 6-7 cristalli fondamentali "
     "con proprietà tradizionalmente attribuite: quarzo ialino (amplificatore universale), "
     "ametista (calma, meditazione, chakra corona), quarzo rosa (amore di sé, cuore), "
     "citrino (abbondanza, plesso solare), lapislazzuli (verità, terzo occhio), "
     "ossidiana nera (protezione, radicamento), selenite (purificazione degli ambienti). "
     "Come pulire, ricaricare e programmare un cristallo. La differenza tra uso "
     "meditativo/simbolico ed effetto placebo non toglie valore alla pratica.",
     "https://images.unsplash.com/photo-1547954575-855750c57bd3?w=1200&auto=format&fit=crop&q=70"),

    ("energy-07",
     "SETTIMO ARTICOLO: Guarigione sonora e frequenze curative. "
     "Titolo suggerito: 'Le frequenze che accordano l'anima: guarigione sonora'. "
     "Contenuti: il suono come vibrazione, la fisica delle onde e la risonanza. "
     "Origini antiche: mantra vedici, canti gregoriani, tamburi sciamanici, corni "
     "tibetani. Le nove frequenze di Solfeggio (396 Hz liberazione paura, 417 Hz "
     "cambiamento, 528 Hz DNA/miracolo, 639 Hz connessioni, 741 Hz espressione, "
     "852 Hz intuizione, 963 Hz coscienza unitaria) presentate come approccio "
     "esperienziale, senza pretese scientifiche assolute. Il bagno di gong e le "
     "campane tibetane a sette metalli. Ricerca scientifica moderna: effetti "
     "misurabili del suono sul sistema nervoso autonomo, riduzione del cortisolo, "
     "coerenza cardiaca. Neuroni specchio e neuroni acustici. Il canto armonico "
     "tibetano e mongolo. Pratica proposta: 10 minuti di ascolto consapevole di "
     "una campana tibetana o di una frequenza a occhi chiusi. Come integrare il "
     "suono nella pratica quotidiana (mattina, prima di dormire, in meditazione).",
     "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=70"),

    ("energy-08",
     "OTTAVO ARTICOLO CONCLUSIVO: Igiene energetica quotidiana e pratiche di autocura. "
     "Titolo suggerito: 'L'igiene invisibile: pratiche quotidiane di autocura energetica'. "
     "Contenuti: perché siamo esposti quotidianamente a 'inquinamento energetico' "
     "(ambienti densi, relazioni tossiche, sovraccarico digitale, stress cumulativo) e "
     "come proteggerci senza cadere in paranoie new-age. Le pratiche fondamentali di "
     "igiene energetica: grounding (radicamento a piedi nudi sulla terra, spiegando "
     "gli studi sulla connessione al potenziale elettrico del pianeta). La doccia "
     "consapevole con visualizzazione del lavaggio. Il rituale del sale grosso (bagno "
     "ai piedi o alle mani). La respirazione quadrata (4-4-4-4). Il taglio dei cordoni "
     "energetici (visualizzazione della lama di luce). La postura del cuore aperto. "
     "L'importanza della coerenza cardiaca (5 respiri profondi per minuto per 5 minuti, "
     "protocollo HeartMath). Pulizia degli ambienti con salvia bianca, palo santo, "
     "incenso di resina, campane. Chiudi con invito ad ascoltare il proprio corpo "
     "come primo strumento di guarigione, e a integrare queste pratiche con "
     "gradualità, senza rigidità.",
     "https://images.unsplash.com/photo-1518715058427-d33dda13c62b?w=1200&auto=format&fit=crop&q=70"),
]


SYSTEM = (
    "Sei un redattore editoriale esperto di guarigione energetica, medicina "
    "tradizionale, pranoterapia, Reiki, cristalloterapia, chakra, aura, suono "
    "terapeutico, biofisica e discipline olistiche. Scrivi in italiano fluente, "
    "chiaro e ispirante, con tono divulgativo ma rigoroso, evitando esagerazioni "
    "new-age o promesse di guarigione. "
    "Presenti sempre la guarigione energetica come approccio complementare e mai "
    "sostitutivo della medicina convenzionale. Cita nomi, date, testi storici, "
    "riferimenti scientifici con naturalezza quando pertinenti. "
    "Produci un articolo di MASSIMO 1500 parole (idealmente 1100-1400), "
    "suddiviso in 7-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
    "Ogni paragrafo circa 130-200 parole. "
    "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
    "Solo prosa fluida e discorsiva. Nessuna firma o nota di redazione. "
    "Non menzionare siti web sorgente né riferimenti a testi esterni concreti. "
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
        print(f"  LLM err: {e}")
        return None
    raw = clean_json(r or "")
    try:
        d = json.loads(raw)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if not m:
            return None
        try:
            d = json.loads(m.group(0))
        except Exception:
            return None
    return {"title": (d.get("title") or "").strip(), "summary": (d.get("summary") or "").strip()}


async def process(db, spec, sem):
    key, topic, img = spec
    async with sem:
        seed = f"editorial:energy:{key}"
        if await db.articles.find_one({"source_url": seed}):
            print(f"[{key}] SKIP")
            return {"status": "skipped"}
        best = None
        best_wc = 0
        for _ in range(4):
            r = await gen(topic)
            if not r or not r["title"] or not r["summary"]:
                continue
            wc = len(r["summary"].split())
            if 1100 <= wc <= 1500:
                best, best_wc = r, wc
                break
            if wc <= 1700 and wc > best_wc:
                best, best_wc = r, wc
        if not best:
            print(f"[{key}] FAIL")
            return {"status": "failed"}
        if await db.articles.find_one({"title": best["title"]}):
            best["title"] += " – Nuova prospettiva"
        doc = {
            "id": str(uuid.uuid4()),
            "title": best["title"],
            "summary": best["summary"],
            "category": CATEGORY,
            "source_url": seed,  # non-http → "Articolo di Redazione"
            "image_url": img,
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        print(f"[{key}] ✅ ({best_wc}p): {best['title']}")
        return {"status": "inserted"}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*[process(db, s, sem) for s in TOPICS])
    ok = sum(1 for r in results if r and r.get("status") == "inserted")
    print(f"\n===== SUMMARY: {ok}/{len(TOPICS)} inserted =====")


if __name__ == "__main__":
    asyncio.run(main())
