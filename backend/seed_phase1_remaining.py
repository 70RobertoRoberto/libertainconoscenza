"""Phase 1 — remaining articles (skip Biocentrismo).

Generates:
  - 1 retry: Onde cerebrali (idx 9 failed)
  - 1: Global Consciousness Project (idx 13)
  - 6: Spiritualità (idx 14-19)

Total: 8 articles.
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

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

TOPICS = [
    # Retry idx 9
    (9,
     "Le onde cerebrali e gli stati di coscienza: descrivi in dettaglio le onde "
     "Delta, Theta, Alpha, Beta e Gamma, quali stati mentali corrispondono a "
     "ciascuna (sonno profondo, ipnagogia, rilassamento vigile, attenzione focalizzata, "
     "estasi meditativa). Include applicazioni pratiche: come raggiungere gli stati "
     "utili tramite respirazione, meditazione, biofeedback.",
     "Coscienza", True,
     "https://images.unsplash.com/photo-1559757175-08d3f97e3c8f?w=1200&auto=format&fit=crop&q=70"),
    # Global Consciousness Project — idx 13
    (13,
     "Il Global Consciousness Project di Princeton: da vent'anni una rete di "
     "generatori di numeri casuali sparsi nel mondo registra anomalie statistiche "
     "in coincidenza con eventi globali carichi emotivamente (11 settembre, "
     "cerimonie, disastri). Descrivi metodologia, risultati principali, ricercatori "
     "coinvolti (Roger Nelson) e cosa suggerisce sull'esistenza di una coscienza "
     "collettiva.",
     "Coscienza", False,
     "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=70"),
    # ─── SPIRITUALITÀ (6) ────────────────────────────────
    (14,
     "Meister Eckhart e la mistica cristiana renana: il monaco domenicano del XIII-XIV "
     "secolo che parlò di 'scintilla dell'anima' e dell'unione senza mediazione con "
     "il Divino. Include contesto storico, insegnamenti chiave (nascita di Dio "
     "nell'anima, distacco, essere e non-essere), condanna ecclesiastica e attualità "
     "del suo messaggio nel dialogo con le tradizioni orientali.",
     "Spirituale", False,
     "https://images.unsplash.com/photo-1470039694102-75bf70174ba9?w=1200&auto=format&fit=crop&q=70"),
    (15,
     "San Giovanni della Croce e la Notte Oscura dell'anima: il carmelitano spagnolo "
     "del XVI secolo che descrisse il percorso mistico come attraversamento di due "
     "notti (dei sensi e dello spirito). Racconta la sua vita, la relazione con "
     "Teresa d'Ávila, il significato della 'notte oscura' come purificazione "
     "necessaria e la sua rilevanza per chi oggi attraversa crisi spirituali.",
     "Spirituale", False,
     "https://images.unsplash.com/photo-1518818419601-72c8673f5852?w=1200&auto=format&fit=crop&q=70"),
    (16,
     "L'Advaita Vedanta: il non-dualismo indiano che afferma l'unità di Atman "
     "(anima individuale) e Brahman (assoluto). Storia della tradizione (Shankara "
     "nel VIII secolo), pratiche di auto-indagine, i grandi maestri del Novecento "
     "(Ramana Maharshi, Nisargadatta Maharaj) e il rinnovato interesse occidentale.",
     "Spirituale", False,
     "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop&q=70"),
    (17,
     "Il cristianesimo esoterico e la Sophia: la corrente della tradizione cristiana "
     "che valorizza la conoscenza (gnosis) e la Sapienza divina personificata come "
     "figura femminile. Presenta gli gnostici antichi, il Vangelo di Tommaso, "
     "l'ortodossia russa (Solov'ëv, Bulgakov), le tradizioni templari e rosacruciane, "
     "e il ritorno contemporaneo della dimensione femminile del sacro.",
     "Spirituale", False,
     "https://images.unsplash.com/photo-1470039694102-75bf70174ba9?w=1200&auto=format&fit=crop&q=70"),
    (18,
     "L'alchimia interiore come percorso di trasformazione: dalla tradizione "
     "occidentale (Nigredo, Albedo, Rubedo, Opus Magnum) all'alchimia interiore "
     "taoista (Nei Dan). Spiega il simbolismo (piombo trasformato in oro come "
     "trasformazione dell'ego in Sé), la lettura psicologica di Jung, e le "
     "pratiche moderne che si ispirano a questa tradizione.",
     "Spirituale", False,
     "https://images.unsplash.com/photo-1518715058427-d33dda13c62b?w=1200&auto=format&fit=crop&q=70"),
    (19,
     "Le esperienze mistiche nella ricerca contemporanea: da 'Le varietà "
     "dell'esperienza religiosa' di William James (1902) a 'Le porte della "
     "percezione' di Aldous Huxley, fino agli studi moderni sulla psilocibina "
     "alla Johns Hopkins University. Descrivi le caratteristiche universali "
     "dell'esperienza mistica, la ricerca psichedelica riportata alla luce, "
     "e le implicazioni per una scienza della spiritualità.",
     "Spirituale", False,
     "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop&q=70"),
]

HEART_NOTE_INSTRUCTION = (
    "IMPORTANTE — nel PENULTIMO paragrafo devi includere una nota di questo tipo, "
    "integrata in modo naturale nella prosa: "
    "\"Le più recenti ricerche in biofisica quantistica stanno spostando l'attenzione "
    "dal cervello al cuore, riconosciuto sempre di più come vera sede della coscienza "
    "e dimora dell'Anima. Il cuore non è più visto solo come pompa idraulica ma come "
    "centro di intelligenza propria, capace di generare campi elettromagnetici che "
    "influenzano tutto l'organismo e possibile ponte tra la dimensione biologica e "
    "quella spirituale dell'essere umano.\" "
    "Riscrivi con parole tue e ancorala organicamente al tema."
)


def system_prompt(need_heart: bool) -> str:
    base = (
        "Sei un redattore editoriale esperto di fisica quantistica, neuroscienze della "
        "coscienza, tradizioni mistiche e spiritualità. Scrivi in italiano fluente, "
        "chiaro e ispirante, con tono divulgativo ma preciso. "
        "Devi produrre un articolo di MASSIMO 1500 parole (idealmente tra 1100 e 1500), "
        "suddiviso in 7-9 paragrafi ben distinti, separati da DOPPIO A CAPO. "
        "Ogni paragrafo circa 130-200 parole. "
        "Non usare titoli di sezione, elenchi puntati, grassetti o marcatori Markdown. "
        "Solo prosa fluida e discorsiva. Cita nomi, esperimenti, date con naturalezza. "
        "Nessuna firma o nota di redazione. "
    )
    if need_heart:
        base += HEART_NOTE_INSTRUCTION + " "
    base += (
        "Rispondi SOLO con JSON: "
        '{"title": "<titolo evocativo e non generico>", "summary": "<articolo>"}'
    )
    return base


def clean_json(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


async def generate(topic, need_heart):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=str(uuid.uuid4()),
        system_message=system_prompt(need_heart),
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    try:
        resp = await chat.send_message(UserMessage(text=f"Argomento:\n\n{topic}\n\nProduci ora il JSON."))
    except Exception as e:
        print(f"  LLM err: {e}")
        return None
    raw = clean_json(resp or "")
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
    t = (d.get("title") or "").strip()
    s = (d.get("summary") or "").strip()
    if not t or not s:
        return None
    return {"title": t, "summary": s}


async def process(db, spec, sem):
    idx, topic, cat, need_heart, img = spec
    async with sem:
        seed_key = f"phase1:{cat}:{idx:02d}"
        if await db.articles.find_one({"source_url": seed_key}):
            print(f"[{idx:02d}] SKIP")
            return {"status": "skipped"}
        best = None; best_wc = 0
        for _ in range(4):
            r = await generate(topic, need_heart)
            if not r:
                continue
            wc = len(r["summary"].split())
            if 1100 <= wc <= 1500:
                best, best_wc = r, wc
                break
            if wc <= 1600 and wc > best_wc:
                best, best_wc = r, wc
        if not best:
            print(f"[{idx:02d}] FAIL")
            return {"status": "failed"}
        if await db.articles.find_one({"title": best["title"]}):
            best["title"] += " – Nuova prospettiva"
        doc = {
            "id": str(uuid.uuid4()),
            "title": best["title"],
            "summary": best["summary"],
            "category": cat,
            "source_url": seed_key,
            "image_url": img,
            "is_premium": False,
            "views": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.articles.insert_one(doc)
        flag = " ❤️" if need_heart else ""
        print(f"[{idx:02d}] ✅ ({best_wc}p) [{cat}]{flag}: {best['title']}")
        return {"status": "inserted", "cat": cat}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    sem = asyncio.Semaphore(3)
    results = await asyncio.gather(*[process(db, s, sem) for s in TOPICS])
    ok = [r for r in results if r and r.get("status") == "inserted"]
    from collections import Counter
    print(f"\n===== SUMMARY: {len(ok)}/{len(TOPICS)} inserted =====")
    for k, v in Counter(r.get("cat") for r in ok).items():
        print(f"  → {k}: {v}")


if __name__ == "__main__":
    asyncio.run(main())
