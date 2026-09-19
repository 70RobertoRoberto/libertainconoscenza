"""Conoscenza Aperta - FastAPI backend."""
import os
import re
import uuid
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import List, Optional

import bcrypt
import jwt
import httpx
import requests
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query, UploadFile, File, Form
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("conoscenza")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ISSUER = os.environ["JWT_ISSUER"]
JWT_TTL_MIN = int(os.environ.get("JWT_TTL_MIN", 43200))
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
ADMIN_PHONE = os.environ["ADMIN_PHONE"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]
EMERGENT_PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
INTEGRATION_PROXY_URL = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = INTEGRATION_PROXY_URL.rstrip("/") + "/objstore/api/v1/storage"
PUSH_BASE_URL = INTEGRATION_PROXY_URL
APP_NAME = "conoscenza-aperta"

# Global storage key cache
_storage_key: Optional[str] = None

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Conoscenza Aperta API")
api = APIRouter(prefix="/api")

CATEGORIES = [
    "Crescita personale",
    "Spirituale",
    "Fisica quantistica",
    "Meditazione",
    "Discipline orientali",
    "Naturopatia",
    "Psicologia",
    "Medicina Integrata",
    "Filosofia",
    "Nutrizione",
    "Somatognostica",
    "Video",
]

PLANS = {
    "3m": {"months": 3, "price_eur": 300, "label": "3 Mesi"},
    "6m": {"months": 6, "price_eur": 500, "label": "6 Mesi"},
    "12m": {"months": 12, "price_eur": 900, "label": "12 Mesi"},
}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    phone: str
    password: str = Field(min_length=6, max_length=128)
    name: Optional[str] = None
    referral_code: Optional[str] = None


class LoginIn(BaseModel):
    phone: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class ArticleIn(BaseModel):
    title: str
    summary: str
    category: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    is_premium: bool = False


class ArticleOut(BaseModel):
    id: str
    title: str
    summary: str
    category: str
    source_url: Optional[str] = None
    image_url: Optional[str] = None
    is_premium: bool
    views: int
    created_at: str


class MediaIn(BaseModel):
    title: str
    description: str = ""
    category: str
    kind: str  # "video" or "meditation"
    media_url: str  # external link or storage URL
    thumbnail_url: Optional[str] = None
    duration_sec: Optional[int] = None
    is_premium: bool = False


class MediaOut(BaseModel):
    id: str
    title: str
    description: str
    category: str
    kind: str
    media_url: str
    thumbnail_url: Optional[str] = None
    duration_sec: Optional[int] = None
    is_premium: bool
    views: int
    created_at: str


class MessageIn(BaseModel):
    title: str
    body: str
    target_user_id: Optional[str] = None  # None = broadcast


class SummarizeIn(BaseModel):
    url: str
    category: str
    is_premium: bool = False


class CheckoutIn(BaseModel):
    plan: str  # "3m" | "6m" | "12m"
    coupon_code: Optional[str] = None


class CouponIn(BaseModel):
    code: str
    percent_off: int = Field(ge=1, le=100)
    max_uses: int = Field(ge=1, default=100)
    expires_at: Optional[str] = None


class FavoriteIn(BaseModel):
    content_id: str
    content_type: str  # "article" | "media"


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


class CommentIn(BaseModel):
    content_id: str
    content_type: str  # "article" | "media"
    body: str = Field(min_length=1, max_length=1000)


class CompletionIn(BaseModel):
    content_id: str
    content_type: str  # "article" | "media"


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def normalize_phone(p: str) -> str:
    p = re.sub(r"[\s().\-]", "", p or "")
    if p.startswith("00"):
        p = "+" + p[2:]
    if not p.startswith("+"):
        # assume Italy
        if p.startswith("3") and len(p) in (9, 10):
            p = "+39" + p
        else:
            p = "+" + p
    if not re.fullmatch(r"\+\d{8,15}", p):
        raise HTTPException(400, "Numero di telefono non valido")
    return p


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=10)).decode()


def check_password(pw: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), h.encode())
    except Exception:
        return False


def make_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iss": JWT_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_TTL_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def current_user(authorization: str = Header(default="")) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=["HS256"], issuer=JWT_ISSUER)
    except Exception:
        raise HTTPException(401, "Invalid token")
    uid = claims.get("sub")
    user = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin required")
    return user


def to_public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "phone": u["phone"],
        "name": u.get("name"),
        "is_admin": u.get("is_admin", False),
        "subscription": u.get("subscription", {"status": "free"}),
        "referral_code": u.get("referral_code"),
    }


def _gen_referral_code(name: str) -> str:
    import random, string
    base = re.sub(r"[^A-Za-z]", "", (name or "AMICO"))[:6].upper() or "AMICO"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{base}-{suffix}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("phone", unique=True)
    await db.users.create_index("id", unique=True)
    await db.articles.create_index("id", unique=True)
    await db.media.create_index("id", unique=True)
    await db.messages.create_index("id", unique=True)
    await db.views.create_index([("content_id", 1), ("date", 1)])
    await db.favorites.create_index([("user_id", 1), ("content_id", 1)], unique=True)
    await db.coupons.create_index("code", unique=True)
    await db.users.create_index("referral_code", unique=True, sparse=True)
    await db.comments.create_index([("content_id", 1), ("created_at", -1)])
    await db.completions.create_index([("user_id", 1), ("content_id", 1)], unique=True)

    # Init object storage (best-effort)
    try:
        await run_in_threadpool(_init_storage_sync)
    except Exception as e:
        logger.warning(f"Storage init failed: {e}")

    # Seed admin user
    admin_phone = normalize_phone(ADMIN_PHONE)
    existing = await db.users.find_one({"phone": admin_phone})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "phone": admin_phone,
            "password_hash": hash_password(ADMIN_PASSWORD),
            "name": "Amministratore",
            "is_admin": True,
            "subscription": {"status": "premium", "plan": "12m", "expires_at": None},
            "referral_code": "MAESTRO-2026",
            "referral_count": 0,
            "created_at": now_iso(),
        })
        logger.info(f"Admin seeded: {admin_phone}")
    else:
        await db.users.update_one(
            {"phone": admin_phone},
            {"$set": {
                "is_admin": True,
                "password_hash": hash_password(ADMIN_PASSWORD),
                "subscription": {"status": "premium", "plan": "12m", "expires_at": None},
            }},
        )
        if not existing.get("referral_code"):
            await db.users.update_one(
                {"phone": admin_phone},
                {"$set": {"referral_code": "MAESTRO-2026", "referral_count": 0}},
            )

    # Backfill referral_code for existing users
    async for u in db.users.find({"referral_code": {"$exists": False}}, {"_id": 0, "id": 1, "name": 1}):
        code = _gen_referral_code(u.get("name") or "AMICO")
        while await db.users.find_one({"referral_code": code}):
            code = _gen_referral_code(u.get("name") or "AMICO")
        await db.users.update_one({"id": u["id"]}, {"$set": {"referral_code": code, "referral_count": 0}})

    # Seed demo articles if empty
    count = await db.articles.count_documents({})
    if count == 0:
        await _seed_demo_content()


async def _seed_demo_content():
    """Seed initial content from the 3 websites (AI-style summaries)."""
    demo_articles = [
        {
            "title": "Il potere del respiro consapevole",
            "summary": "Il respiro consapevole è la porta d'accesso al momento presente. Le antiche tradizioni orientali, dallo yoga al pranayama, insegnano che modulare il ritmo respiratorio calma il sistema nervoso e riequilibra corpo e mente. Bastano pochi minuti al giorno di respirazione profonda diaframmatica per ridurre lo stress, migliorare la concentrazione e aumentare l'energia vitale. Il respiro è ponte tra volontario e involontario, tra materia e coscienza.",
            "category": "Meditazione",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1636794369713-f3eb3c8a3535?w=800",
        },
        {
            "title": "Biofisica quantistica: la nuova frontiera della salute",
            "summary": "La biofisica quantistica studia i fenomeni sub-atomici che regolano la vita a livello cellulare. Ricerche recenti mostrano che le cellule comunicano tramite biofotoni, particelle di luce debolissime emesse dal DNA. Questo modello supera la visione puramente biochimica e apre la strada a terapie basate su frequenze, campi elettromagnetici coerenti e informazione. La malattia diventa un disordine informazionale prima che biochimico.",
            "category": "Fisica quantistica",
            "source_url": "https://www.scienzebiofisiche.it/",
            "image_url": "https://images.pexels.com/photos/38032287/pexels-photo-38032287.png?w=800",
        },
        {
            "title": "Somatognostica: conoscere sé stessi attraverso il corpo",
            "summary": "La Somatognostica è una disciplina che unisce psicologia, filosofia e discipline corporee per accedere alla conoscenza di sé attraverso l'ascolto del corpo. Ogni tensione, ogni postura racconta una storia personale non narrata. Portando consapevolezza alle sensazioni somatiche si sciolgono blocchi emotivi profondi e si integrano parti dimenticate del sé. Il corpo diventa maestro e testimone del processo di individuazione.",
            "category": "Somatognostica",
            "source_url": "https://www.somatognostica.it/",
            "image_url": "https://images.unsplash.com/photo-1588406320565-9fa6d9901d1d?w=800",
        },
        {
            "title": "L'alchimia interiore secondo la tradizione ermetica",
            "summary": "L'alchimia non è solo trasmutazione di metalli ma anche opera di trasformazione interiore. La tradizione ermetica descrive tre fasi: nigredo (dissoluzione dell'ego), albedo (purificazione), rubedo (integrazione dell'oro spirituale). Ogni fase corrisponde a una crisi esistenziale che, se attraversata con coscienza, conduce a una nuova nascita. L'oro alchemico è la coscienza risvegliata.",
            "category": "Spirituale",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1600181982553-ce7d36051c01?w=800",
        },
        {
            "title": "Naturopatia: la forza vitale come principio guaritore",
            "summary": "La naturopatia si basa sulla vis medicatrix naturae, la forza guaritrice della natura presente in ogni organismo. Non combatte il sintomo ma sostiene l'organismo nel ritrovare l'equilibrio. Fitoterapia, idroterapia, alimentazione consapevole e riflessologia sono strumenti che stimolano l'autoguarigione. Il naturopata è un facilitatore, non un guaritore: lavora con la natura, non contro.",
            "category": "Naturopatia",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1612703508477-00e02a9b170c?w=800",
        },
        {
            "title": "Meditazione mindfulness: la scienza del presente",
            "summary": "La mindfulness, radicata nel buddhismo Theravada, è oggi validata da centinaia di studi neuroscientifici. Praticare 20 minuti al giorno modifica la struttura cerebrale: aumenta la materia grigia nell'ippocampo (memoria) e riduce l'amigdala (paura). La mindfulness non è svuotare la mente ma osservare pensieri e sensazioni senza giudicarli, coltivando presenza e accettazione radicale.",
            "category": "Meditazione",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=800",
        },
        {
            "title": "Il campo morfogenetico e la memoria della natura",
            "summary": "Rupert Sheldrake ha proposto l'esistenza di campi morfogenetici, strutture informazionali non locali che guidano lo sviluppo di ogni forma vivente. Questi campi contengono la memoria della specie e si aggiornano con l'esperienza collettiva. Applicato alla salute umana, questo modello spiega la trasmissione trans-generazionale di traumi e abilità. La natura ricorda, e noi siamo parte di questa memoria vivente.",
            "category": "Fisica quantistica",
            "source_url": "https://www.scienzebiofisiche.it/",
            "image_url": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800",
        },
        {
            "title": "Yoga e le otto membra di Patanjali",
            "summary": "Gli Yoga Sutra di Patanjali descrivono l'ashtanga, gli otto rami dello yoga: yama (etica), niyama (disciplina), asana (postura), pranayama (respiro), pratyahara (ritiro sensi), dharana (concentrazione), dhyana (meditazione), samadhi (unione). Non è ginnastica ma un percorso completo di liberazione. Ogni ramo prepara al successivo, culminando nella dissoluzione dell'ego separato.",
            "category": "Discipline orientali",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1545389336-cf090694435e?w=800",
        },
        {
            "title": "Medicina integrata: unire tradizioni per il paziente",
            "summary": "La medicina integrata unisce il rigore scientifico della biomedicina con la saggezza olistica delle medicine tradizionali. Non è alternativa ma complementare: agopuntura per il dolore cronico, mindfulness per l'ansia, omeopatia per l'autoregolazione. Il paziente al centro, con protocolli personalizzati che considerano corpo, mente e contesto di vita. Il futuro della medicina è integrativo.",
            "category": "Medicina Integrata",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800",
        },
        {
            "title": "Psicologia analitica: l'ombra e l'individuazione",
            "summary": "Carl Gustav Jung ha descritto il processo di individuazione come integrazione degli opposti interiori. L'ombra contiene ciò che rifiutiamo di noi: aggressività, paure, desideri censurati. Non integrando l'ombra proiettiamo sugli altri le nostre parti nascoste. Il lavoro analitico è dialogo con l'inconscio attraverso sogni, sincronicità e immaginazione attiva. Divenire sé stessi è opera di una vita.",
            "category": "Psicologia",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=800",
        },
        {
            "title": "Alimentazione consapevole: cibo come informazione",
            "summary": "Il cibo non è solo carburante ma informazione biochimica ed energetica. Alimenti freschi, di stagione, coltivati con rispetto trasmettono vitalità. La medicina tradizionale cinese classifica i cibi per energia (yin/yang), sapore ed effetto sugli organi. Mangiare consapevolmente significa scegliere, masticare lentamente, riconoscere fame e sazietà. Diventiamo ciò che digeriamo, non solo ciò che mangiamo.",
            "category": "Nutrizione",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=800",
        },
        {
            "title": "Filosofia perenne: l'unità dietro le tradizioni",
            "summary": "Aldous Huxley coniò l'espressione philosophia perennis per indicare il nucleo comune di tutte le grandi tradizioni sapienziali: la realtà ultima è una, il sé profondo la riflette, e il fine dell'esistenza è realizzare tale unione. Vedanta, Sufismo, misticismo cristiano, buddismo Mahayana convergono su questa intuizione. Le differenze sono di linguaggio, non di sostanza.",
            "category": "Filosofia",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1519791883288-dc8bd696e667?w=800",
        },
        {
            "title": "Crescita personale: la responsabilità della propria vita",
            "summary": "La crescita personale inizia quando smettiamo di dare la colpa al passato o agli altri e assumiamo la piena responsabilità della nostra esperienza. Non significa che siamo la causa di tutto ciò che accade, ma che possiamo scegliere come rispondere. Questa scelta è il seme della libertà. Ogni giorno è occasione per praticare consapevolezza, autenticità e coraggio.",
            "category": "Crescita personale",
            "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/",
            "image_url": "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800",
        },
    ]
    for a in demo_articles:
        await db.articles.insert_one({
            "id": str(uuid.uuid4()),
            **a,
            "is_premium": False,
            "views": 0,
            "created_at": now_iso(),
        })

    demo_media = [
        {
            "title": "Meditazione guidata: respiro e presenza",
            "description": "10 minuti di meditazione guidata per riportare l'attenzione al respiro e al momento presente.",
            "category": "Meditazione",
            "kind": "meditation",
            "media_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            "thumbnail_url": "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=800",
            "duration_sec": 600,
            "is_premium": False,
        },
        {
            "title": "Introduzione alla Somatognostica",
            "description": "Video introduttivo sui principi della Somatognostica e sul suo approccio al corpo come veicolo di conoscenza.",
            "category": "Video",
            "kind": "video",
            "media_url": "https://www.youtube.com/watch?v=DWcJFNfaw9c",
            "thumbnail_url": "https://images.unsplash.com/photo-1588406320565-9fa6d9901d1d?w=800",
            "duration_sec": 480,
            "is_premium": False,
        },
        {
            "title": "Meditazione premium: viaggio interiore profondo",
            "description": "Sessione avanzata di 25 minuti per accedere agli stati profondi di coscienza.",
            "category": "Meditazione",
            "kind": "meditation",
            "media_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            "thumbnail_url": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800",
            "duration_sec": 1500,
            "is_premium": True,
        },
    ]
    for m in demo_media:
        await db.media.insert_one({
            "id": str(uuid.uuid4()),
            **m,
            "views": 0,
            "created_at": now_iso(),
        })


# ---------------------------------------------------------------------------
# Object Storage helpers
# ---------------------------------------------------------------------------
def _init_storage_sync() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def _put_object_sync(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = _init_storage_sync()
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=300,
        )
        if resp.status_code == 503:
            _storage_key = None
            key = _init_storage_sync()
            resp = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=300,
            )
        resp.raise_for_status()
    except requests.HTTPError as e:
        raise HTTPException(e.response.status_code, f"Storage error: {e.response.text[:200]}")
    return resp.json()


def _get_object_sync(path: str) -> tuple[bytes, str]:
    global _storage_key
    key = _init_storage_sync()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    if resp.status_code == 503:
        _storage_key = None
        key = _init_storage_sync()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Push notifications
# ---------------------------------------------------------------------------
_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": EMERGENT_PUSH_KEY},
    timeout=10.0,
)


async def send_push_bg(recipients: list, title: str, message: str, action_url: Optional[str] = None):
    """Fire-and-forget: never blocks the caller."""
    if not recipients:
        return
    try:
        # chunk to 100 per call
        for i in range(0, len(recipients), 100):
            chunk = recipients[i : i + 100]
            data = {"title": title, "message": message}
            if action_url:
                data["action_url"] = action_url
            resp = await _push_client.post(
                "/api/v1/push/trigger",
                json={"recipients": chunk, "data": data},
            )
            if resp.status_code >= 400:
                logger.warning(f"Push trigger returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Push send failed (non-blocking): {e}")


async def _all_user_ids(exclude: Optional[str] = None) -> list:
    ids = []
    async for u in db.users.find({}, {"_id": 0, "id": 1}):
        if u["id"] != exclude:
            ids.append(u["id"])
    return ids


@api.get("/")
async def root():
    return {"app": "Conoscenza Aperta", "version": "1.0"}


@api.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}


@api.get("/plans")
async def get_plans():
    return {"plans": PLANS}


# ---------------------------------------------------------------------------
# Search
# ---------------------------------------------------------------------------
@api.get("/search")
async def search(q: str = Query(..., min_length=2), user: dict = Depends(current_user)):
    rgx = {"$regex": re.escape(q), "$options": "i"}
    articles = []
    async for a in db.articles.find(
        {"$or": [{"title": rgx}, {"summary": rgx}, {"category": rgx}]},
        {"_id": 0},
    ).limit(30):
        articles.append(_serialize_article(a))
    media = []
    async for m in db.media.find(
        {"$or": [{"title": rgx}, {"description": rgx}, {"category": rgx}]},
        {"_id": 0},
    ).limit(30):
        media.append(_serialize_media(m))
    return {"articles": articles, "media": media}


# ---------------------------------------------------------------------------
# Comments
# ---------------------------------------------------------------------------
@api.post("/comments")
async def add_comment(inp: CommentIn, user: dict = Depends(current_user)):
    if inp.content_type not in ("article", "media"):
        raise HTTPException(400, "content_type non valido")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name") or user["phone"],
        "content_id": inp.content_id,
        "content_type": inp.content_type,
        "body": inp.body.strip(),
        "created_at": now_iso(),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/comments")
async def list_comments(content_id: str, user: dict = Depends(current_user)):
    cursor = db.comments.find({"content_id": content_id}, {"_id": 0}).sort("created_at", -1).limit(200)
    items = []
    async for c in cursor:
        items.append(c)
    return {"items": items}


@api.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user: dict = Depends(current_user)):
    c = await db.comments.find_one({"id": comment_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Non trovato")
    if c["user_id"] != user["id"] and not user.get("is_admin"):
        raise HTTPException(403, "Non autorizzato")
    await db.comments.delete_one({"id": comment_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Completions (for certificates)
# ---------------------------------------------------------------------------
@api.post("/completions")
async def mark_completion(inp: CompletionIn, user: dict = Depends(current_user)):
    if inp.content_type not in ("article", "media"):
        raise HTTPException(400, "content_type non valido")
    key = {"user_id": user["id"], "content_id": inp.content_id}
    if await db.completions.find_one(key):
        return {"already": True}
    # fetch title
    coll = db.articles if inp.content_type == "article" else db.media
    doc = await coll.find_one({"id": inp.content_id}, {"_id": 0, "title": 1, "category": 1})
    if not doc:
        raise HTTPException(404, "Contenuto non trovato")
    await db.completions.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "content_id": inp.content_id,
        "content_type": inp.content_type,
        "title": doc.get("title", ""),
        "category": doc.get("category", ""),
        "completed_at": now_iso(),
    })
    return {"ok": True, "title": doc.get("title", ""), "category": doc.get("category", "")}


@api.get("/completions")
async def list_completions(user: dict = Depends(current_user)):
    cursor = db.completions.find({"user_id": user["id"]}, {"_id": 0}).sort("completed_at", -1)
    items = []
    async for c in cursor:
        items.append(c)
    return {"items": items}


@api.get("/certificate/{content_id}")
async def certificate_data(content_id: str, user: dict = Depends(current_user)):
    """Return data needed by the client to render/print a PDF certificate."""
    c = await db.completions.find_one({"user_id": user["id"], "content_id": content_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Contenuto non completato")
    return {
        "user_name": user.get("name") or user["phone"],
        "title": c["title"],
        "category": c["category"],
        "completed_at": c["completed_at"],
        "certificate_id": c["id"],
    }


# ---------------------------------------------------------------------------
# Referrals
# ---------------------------------------------------------------------------
@api.get("/referrals/me")
async def my_referrals(user: dict = Depends(current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "referral_code": 1, "referral_count": 1})
    invited = []
    async for x in db.users.find({"referred_by": user["id"]}, {"_id": 0, "id": 1, "name": 1, "phone": 1, "subscription": 1, "created_at": 1}):
        invited.append({
            "id": x["id"],
            "name": x.get("name", ""),
            "phone": x["phone"][:6] + "***" + x["phone"][-3:],
            "premium": x.get("subscription", {}).get("status") == "premium",
            "created_at": x.get("created_at", ""),
        })
    return {
        "code": u.get("referral_code"),
        "count": u.get("referral_count", 0),
        "invited": invited,
    }


# ---------------------------------------------------------------------------
# Personal Stats
# ---------------------------------------------------------------------------
def _compute_streak(dates: list) -> tuple[int, int]:
    """Return (current_streak, longest_streak) from a set of YYYY-MM-DD strings."""
    if not dates:
        return 0, 0
    from datetime import date
    day_set = set(dates)
    today = datetime.now(timezone.utc).date()
    # current streak
    current = 0
    cur = today
    while cur.isoformat() in day_set:
        current += 1
        cur = date.fromordinal(cur.toordinal() - 1)
    # If today has no activity, allow starting from yesterday
    if current == 0:
        cur = date.fromordinal(today.toordinal() - 1)
        while cur.isoformat() in day_set:
            current += 1
            cur = date.fromordinal(cur.toordinal() - 1)
    # longest
    sorted_days = sorted(day_set)
    longest = 1
    run = 1
    for i in range(1, len(sorted_days)):
        prev = date.fromisoformat(sorted_days[i - 1])
        curd = date.fromisoformat(sorted_days[i])
        if (curd.toordinal() - prev.toordinal()) == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    return current, longest


@api.get("/me/stats")
async def my_stats(user: dict = Depends(current_user)):
    uid = user["id"]
    # articles read: distinct article content_ids in views
    read_ids = set()
    async for v in db.views.find({"user_id": uid, "content_type": "article"}, {"_id": 0, "content_id": 1}):
        read_ids.add(v["content_id"])
    # meditation minutes: sum durations of unique meditation media viewed or completed
    med_ids = set()
    async for v in db.views.find({"user_id": uid, "content_type": "media"}, {"_id": 0, "content_id": 1}):
        med_ids.add(v["content_id"])
    async for c in db.completions.find({"user_id": uid, "content_type": "media"}, {"_id": 0, "content_id": 1}):
        med_ids.add(c["content_id"])
    minutes = 0
    if med_ids:
        async for m in db.media.find(
            {"id": {"$in": list(med_ids)}, "kind": "meditation"},
            {"_id": 0, "duration_sec": 1},
        ):
            minutes += (m.get("duration_sec") or 0) // 60
    # streak: unique dates of any view
    dates = set()
    async for v in db.views.find({"user_id": uid}, {"_id": 0, "date": 1}):
        dates.add(v["date"])
    current, longest = _compute_streak(list(dates))
    # badges
    badges = []
    if current >= 3:
        badges.append({"key": "streak3", "label": "3 giorni di seguito", "icon": "🌱"})
    if current >= 7:
        badges.append({"key": "streak7", "label": "1 settimana", "icon": "✨"})
    if current >= 30:
        badges.append({"key": "streak30", "label": "1 mese", "icon": "🌟"})
    if longest >= 100:
        badges.append({"key": "streak100", "label": "Maestro 100 giorni", "icon": "🏆"})
    if minutes >= 60:
        badges.append({"key": "min60", "label": "1 ora di meditazione", "icon": "🧘"})
    if minutes >= 600:
        badges.append({"key": "min600", "label": "10 ore di meditazione", "icon": "💫"})
    if len(read_ids) >= 10:
        badges.append({"key": "read10", "label": "10 articoli letti", "icon": "📖"})
    if len(read_ids) >= 50:
        badges.append({"key": "read50", "label": "50 articoli letti", "icon": "📚"})
    return {
        "articles_read": len(read_ids),
        "meditations": len(med_ids),
        "minutes_meditated": minutes,
        "current_streak": current,
        "longest_streak": longest,
        "badges": badges,
    }


# ---------------------------------------------------------------------------
# Admin: comments moderation
# ---------------------------------------------------------------------------
@api.get("/admin/comments", dependencies=[Depends(require_admin)])
async def admin_list_comments(limit: int = 200):
    """List all comments across the app, most recent first."""
    cursor = db.comments.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = []
    async for c in cursor:
        # attach a title snippet from the content
        coll = db.articles if c.get("content_type") == "article" else db.media
        target = await coll.find_one({"id": c["content_id"]}, {"_id": 0, "title": 1})
        items.append({
            **c,
            "content_title": (target or {}).get("title", "(cancellato)"),
        })
    return {"items": items}


@api.delete("/admin/comments/{comment_id}", dependencies=[Depends(require_admin)])
async def admin_delete_comment(comment_id: str):
    r = await db.comments.delete_one({"id": comment_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "Non trovato")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@api.post("/auth/register", response_model=TokenOut)
async def register(inp: RegisterIn):
    phone = normalize_phone(inp.phone)
    if await db.users.find_one({"phone": phone}):
        raise HTTPException(409, "Numero già registrato")
    referred_by = None
    if inp.referral_code:
        code = inp.referral_code.strip().upper()
        ref = await db.users.find_one({"referral_code": code}, {"_id": 0, "id": 1})
        if ref:
            referred_by = ref["id"]
    referral_code = _gen_referral_code(inp.name or "AMICO")
    while await db.users.find_one({"referral_code": referral_code}):
        referral_code = _gen_referral_code(inp.name or "AMICO")
    user = {
        "id": str(uuid.uuid4()),
        "phone": phone,
        "password_hash": hash_password(inp.password),
        "name": inp.name or "",
        "is_admin": False,
        "subscription": {"status": "free"},
        "referral_code": referral_code,
        "referred_by": referred_by,
        "referral_count": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    if referred_by:
        await db.users.update_one({"id": referred_by}, {"$inc": {"referral_count": 1}})
    return TokenOut(access_token=make_token(user["id"]), user=to_public_user(user))


@api.post("/auth/login", response_model=TokenOut)
async def login(inp: LoginIn):
    phone = normalize_phone(inp.phone)
    u = await db.users.find_one({"phone": phone})
    if not u or not check_password(inp.password, u["password_hash"]):
        raise HTTPException(401, "Credenziali non valide")
    return TokenOut(access_token=make_token(u["id"]), user=to_public_user(u))


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return to_public_user(user)


# ---------------------------------------------------------------------------
# Articles
# ---------------------------------------------------------------------------
def _serialize_article(a: dict) -> dict:
    return {
        "id": a["id"],
        "title": a["title"],
        "summary": a["summary"],
        "category": a["category"],
        "source_url": a.get("source_url"),
        "image_url": a.get("image_url"),
        "is_premium": a.get("is_premium", False),
        "views": a.get("views", 0),
        "created_at": a.get("created_at", ""),
    }


@api.get("/articles")
async def list_articles(
    category: Optional[str] = None,
    limit: int = 50,
    user: dict = Depends(current_user),
):
    q = {}
    if category:
        q["category"] = category
    cursor = db.articles.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = [_serialize_article(a) async for a in cursor]
    # Hide premium body for free users? We still show, but frontend gates
    return {"items": items}


@api.get("/articles/{article_id}")
async def get_article(article_id: str, user: dict = Depends(current_user)):
    a = await db.articles.find_one({"id": article_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Non trovato")
    # Track view
    await db.articles.update_one({"id": article_id}, {"$inc": {"views": 1}})
    await db.views.insert_one({
        "id": str(uuid.uuid4()),
        "content_id": article_id,
        "content_type": "article",
        "user_id": user["id"],
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "ts": now_iso(),
    })
    a["views"] = a.get("views", 0) + 1
    return _serialize_article(a)


@api.post("/admin/articles", dependencies=[Depends(require_admin)])
async def create_article(inp: ArticleIn):
    if inp.category not in CATEGORIES:
        raise HTTPException(400, "Categoria non valida")
    doc = {
        "id": str(uuid.uuid4()),
        **inp.dict(),
        "views": 0,
        "created_at": now_iso(),
    }
    await db.articles.insert_one(doc)
    # Notify all users
    try:
        recipients = await _all_user_ids()
        await send_push_bg(recipients, "Nuovo articolo", inp.title, action_url=f"/article/{doc['id']}")
    except Exception as e:
        logger.warning(f"Push failed: {e}")
    return _serialize_article(doc)


@api.delete("/admin/articles/{article_id}", dependencies=[Depends(require_admin)])
async def delete_article(article_id: str):
    r = await db.articles.delete_one({"id": article_id})
    return {"deleted": r.deleted_count}


@api.post("/admin/articles/summarize", dependencies=[Depends(require_admin)])
async def summarize_and_create(inp: SummarizeIn):
    """Fetch a URL, extract text, summarize with GPT-5.4-mini, save article."""
    if inp.category not in CATEGORIES:
        raise HTTPException(400, "Categoria non valida")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import httpx
        async with httpx.AsyncClient(follow_redirects=True, timeout=20) as h:
            r = await h.get(inp.url, headers={"User-Agent": "ConoscenzaAperta/1.0"})
            r.raise_for_status()
        raw = r.text
        text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", raw, flags=re.I | re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text)[:20000]

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=str(uuid.uuid4()),
            system_message=(
                "Sei un editor esperto di crescita personale, spiritualità e discipline olistiche. "
                "Riassumi l'articolo fornito in italiano, in modo semplice, divulgativo e ispirante. "
                "L'articolo finale deve essere lungo fino a 60 righe (circa 500-700 parole), ben strutturato in paragrafi. "
                "Rispondi in JSON con esattamente questi campi: {\"title\": \"...\", \"summary\": \"...\"}. Nessun altro testo."
            ),
        ).with_model("openai", "gpt-4o-mini")

        response = await chat.send_message(UserMessage(text=text))
        # Try parse JSON
        import json
        cleaned = re.sub(r"^```(?:json)?|```$", "", response.strip(), flags=re.M).strip()
        try:
            parsed = json.loads(cleaned)
            title = parsed.get("title", "Articolo")
            summary = parsed.get("summary", cleaned)
        except Exception:
            title = "Articolo sintetizzato"
            summary = cleaned

        doc = {
            "id": str(uuid.uuid4()),
            "title": title,
            "summary": summary,
            "category": inp.category,
            "source_url": inp.url,
            "image_url": None,
            "is_premium": inp.is_premium,
            "views": 0,
            "created_at": now_iso(),
        }
        await db.articles.insert_one(doc)
        return _serialize_article(doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Summarize failed")
        raise HTTPException(500, f"Errore riassunto: {e}")


# ---------------------------------------------------------------------------
# Media (videos + meditations)
# ---------------------------------------------------------------------------
def _serialize_media(m: dict) -> dict:
    return {
        "id": m["id"],
        "title": m["title"],
        "description": m.get("description", ""),
        "category": m["category"],
        "kind": m["kind"],
        "media_url": m["media_url"],
        "thumbnail_url": m.get("thumbnail_url"),
        "duration_sec": m.get("duration_sec"),
        "is_premium": m.get("is_premium", False),
        "views": m.get("views", 0),
        "created_at": m.get("created_at", ""),
    }


@api.get("/media")
async def list_media(
    kind: Optional[str] = None,
    category: Optional[str] = None,
    user: dict = Depends(current_user),
):
    q = {}
    if kind:
        q["kind"] = kind
    if category:
        q["category"] = category
    cursor = db.media.find(q, {"_id": 0}).sort("created_at", -1)
    items = [_serialize_media(m) async for m in cursor]
    return {"items": items}


@api.get("/media/{media_id}")
async def get_media(media_id: str, user: dict = Depends(current_user)):
    m = await db.media.find_one({"id": media_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Non trovato")
    # premium gating
    if m.get("is_premium") and user.get("subscription", {}).get("status") != "premium":
        raise HTTPException(402, "Contenuto premium: abbonamento richiesto")
    await db.media.update_one({"id": media_id}, {"$inc": {"views": 1}})
    await db.views.insert_one({
        "id": str(uuid.uuid4()),
        "content_id": media_id,
        "content_type": "media",
        "user_id": user["id"],
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "ts": now_iso(),
    })
    m["views"] = m.get("views", 0) + 1
    return _serialize_media(m)


@api.post("/admin/media", dependencies=[Depends(require_admin)])
async def create_media(inp: MediaIn):
    if inp.category not in CATEGORIES:
        raise HTTPException(400, "Categoria non valida")
    if inp.kind not in ("video", "meditation"):
        raise HTTPException(400, "kind deve essere 'video' o 'meditation'")
    doc = {
        "id": str(uuid.uuid4()),
        **inp.dict(),
        "views": 0,
        "created_at": now_iso(),
    }
    await db.media.insert_one(doc)
    try:
        recipients = await _all_user_ids()
        title = "Nuova meditazione" if inp.kind == "meditation" else "Nuovo video"
        await send_push_bg(recipients, title, inp.title, action_url=f"/media/{doc['id']}")
    except Exception as e:
        logger.warning(f"Push failed: {e}")
    return _serialize_media(doc)


@api.delete("/admin/media/{media_id}", dependencies=[Depends(require_admin)])
async def delete_media(media_id: str):
    r = await db.media.delete_one({"id": media_id})
    return {"deleted": r.deleted_count}


# ---------------------------------------------------------------------------
# Messages (admin -> users)
# ---------------------------------------------------------------------------
@api.get("/messages")
async def list_messages(user: dict = Depends(current_user)):
    q = {"$or": [{"target_user_id": None}, {"target_user_id": user["id"]}]}
    cursor = db.messages.find(q, {"_id": 0}).sort("created_at", -1).limit(100)
    items = []
    async for m in cursor:
        items.append({
            "id": m["id"],
            "title": m["title"],
            "body": m["body"],
            "is_broadcast": m.get("target_user_id") is None,
            "created_at": m.get("created_at", ""),
            "read": user["id"] in (m.get("read_by") or []),
        })
    return {"items": items}


@api.post("/messages/{message_id}/read")
async def mark_read(message_id: str, user: dict = Depends(current_user)):
    await db.messages.update_one(
        {"id": message_id},
        {"$addToSet": {"read_by": user["id"]}},
    )
    return {"ok": True}


@api.post("/admin/messages", dependencies=[Depends(require_admin)])
async def send_message(inp: MessageIn):
    doc = {
        "id": str(uuid.uuid4()),
        "title": inp.title,
        "body": inp.body,
        "target_user_id": inp.target_user_id,
        "read_by": [],
        "created_at": now_iso(),
    }
    await db.messages.insert_one(doc)
    try:
        recipients = [inp.target_user_id] if inp.target_user_id else await _all_user_ids()
        await send_push_bg(recipients, inp.title, inp.body[:120], action_url="/messages")
    except Exception as e:
        logger.warning(f"Push failed: {e}")
    return {
        "id": doc["id"],
        "title": doc["title"],
        "body": doc["body"],
        "is_broadcast": inp.target_user_id is None,
        "created_at": doc["created_at"],
    }


# ---------------------------------------------------------------------------
# Users (admin)
# ---------------------------------------------------------------------------
@api.get("/admin/users", dependencies=[Depends(require_admin)])
async def list_users():
    cursor = db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1)
    items = []
    async for u in cursor:
        items.append({
            "id": u["id"],
            "phone": u["phone"],
            "name": u.get("name", ""),
            "is_admin": u.get("is_admin", False),
            "subscription": u.get("subscription", {"status": "free"}),
            "created_at": u.get("created_at", ""),
        })
    return {"items": items}


# ---------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------
@api.get("/admin/stats/summary", dependencies=[Depends(require_admin)])
async def stats_summary():
    total_users = await db.users.count_documents({})
    total_articles = await db.articles.count_documents({})
    total_media = await db.media.count_documents({})
    total_views = await db.views.count_documents({})
    premium_users = await db.users.count_documents({"subscription.status": "premium"})
    return {
        "users": total_users,
        "premium_users": premium_users,
        "articles": total_articles,
        "media": total_media,
        "total_views": total_views,
    }


@api.get("/admin/stats/daily", dependencies=[Depends(require_admin)])
async def stats_daily(days: int = 14):
    pipeline = [
        {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        {"$sort": {"_id": -1}},
        {"$limit": days},
    ]
    result = []
    async for row in db.views.aggregate(pipeline):
        result.append({"date": row["_id"], "views": row["count"]})
    result.reverse()
    return {"items": result}


@api.get("/admin/stats/top-content", dependencies=[Depends(require_admin)])
async def stats_top_content(limit: int = 20):
    articles = []
    async for a in db.articles.find({}, {"_id": 0, "id": 1, "title": 1, "views": 1}).sort("views", -1).limit(limit):
        articles.append({"id": a["id"], "title": a["title"], "views": a.get("views", 0), "type": "article"})
    media = []
    async for m in db.media.find({}, {"_id": 0, "id": 1, "title": 1, "views": 1, "kind": 1}).sort("views", -1).limit(limit):
        media.append({"id": m["id"], "title": m["title"], "views": m.get("views", 0), "type": m.get("kind", "media")})
    return {"articles": articles, "media": media}


# ---------------------------------------------------------------------------
# Push tokens
# ---------------------------------------------------------------------------
class PushTokenIn(BaseModel):
    token: str
    platform: Optional[str] = None


@api.post("/me/push-token")
async def save_push_token(inp: PushTokenIn, user: dict = Depends(current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"push_token": inp.token, "push_platform": inp.platform}},
    )
    return {"ok": True}


@api.post("/register-push", status_code=201)
async def register_push_relay(body: RegisterPushBody):
    """Relay to Emergent managed push (SuprSend). Non-blocking — token stored locally regardless."""
    await db.users.update_one(
        {"id": body.user_id},
        {"$set": {"device_token": body.device_token, "push_platform": body.platform}},
    )
    try:
        resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code < 400:
            return {"status": "registered"}
        logger.warning(f"Push registration upstream {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Push registration relay failed (non-blocking): {e}")
    return {"status": "stored_locally"}


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------
@api.post("/favorites/toggle")
async def toggle_favorite(inp: FavoriteIn, user: dict = Depends(current_user)):
    if inp.content_type not in ("article", "media"):
        raise HTTPException(400, "content_type non valido")
    key = {"user_id": user["id"], "content_id": inp.content_id}
    existing = await db.favorites.find_one(key)
    if existing:
        await db.favorites.delete_one(key)
        return {"favorited": False}
    await db.favorites.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "content_id": inp.content_id,
        "content_type": inp.content_type,
        "created_at": now_iso(),
    })
    return {"favorited": True}


@api.get("/favorites")
async def list_favorites(user: dict = Depends(current_user)):
    cursor = db.favorites.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    articles, media = [], []
    async for f in cursor:
        if f["content_type"] == "article":
            a = await db.articles.find_one({"id": f["content_id"]}, {"_id": 0})
            if a:
                articles.append(_serialize_article(a))
        else:
            m = await db.media.find_one({"id": f["content_id"]}, {"_id": 0})
            if m:
                media.append(_serialize_media(m))
    ids = set()
    async for f in db.favorites.find({"user_id": user["id"]}, {"_id": 0, "content_id": 1}):
        ids.add(f["content_id"])
    return {"articles": articles, "media": media, "ids": list(ids)}


# ---------------------------------------------------------------------------
# File upload (Emergent Object Storage)
# ---------------------------------------------------------------------------
ALLOWED_MIME = {
    "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/aac",
    "video/mp4", "video/quicktime", "video/webm",
    "image/jpeg", "image/png", "image/webp",
}


@api.post("/admin/upload", dependencies=[Depends(require_admin)])
async def admin_upload(file: UploadFile = File(...)):
    """Upload a file to Emergent Object Storage; returns a public API URL."""
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(415, f"Tipo file non supportato: {file.content_type}")
    data = await file.read()
    if len(data) > 300 * 1024 * 1024:
        raise HTTPException(413, "File troppo grande (max 300MB)")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    result = await run_in_threadpool(_put_object_sync, path, data, file.content_type)
    stored_path = result.get("path", path)
    # persist metadata
    await db.uploads.insert_one({
        "id": str(uuid.uuid4()),
        "path": stored_path,
        "mime": file.content_type,
        "size": len(data),
        "filename": file.filename,
        "created_at": now_iso(),
    })
    public_url = f"/api/files/{stored_path}"
    return {"path": stored_path, "url": public_url, "size": len(data), "mime": file.content_type}


@api.get("/files/{path:path}")
async def get_file(path: str):
    """Serve a stored file. Public because embedded media needs to load without headers."""
    try:
        data, ctype = await run_in_threadpool(_get_object_sync, path)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(404, "File non trovato")
    return Response(content=data, media_type=ctype)


# ---------------------------------------------------------------------------
# Coupons
# ---------------------------------------------------------------------------
@api.post("/admin/coupons", dependencies=[Depends(require_admin)])
async def create_coupon(inp: CouponIn):
    code = inp.code.strip().upper()
    if not re.fullmatch(r"[A-Z0-9_-]{3,32}", code):
        raise HTTPException(400, "Codice non valido")
    if await db.coupons.find_one({"code": code}):
        raise HTTPException(409, "Codice già esistente")
    doc = {
        "id": str(uuid.uuid4()),
        "code": code,
        "percent_off": inp.percent_off,
        "max_uses": inp.max_uses,
        "used_count": 0,
        "expires_at": inp.expires_at,
        "created_at": now_iso(),
    }
    await db.coupons.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/admin/coupons", dependencies=[Depends(require_admin)])
async def list_coupons():
    cursor = db.coupons.find({}, {"_id": 0}).sort("created_at", -1)
    items = []
    async for c in cursor:
        items.append(c)
    return {"items": items}


@api.delete("/admin/coupons/{code}", dependencies=[Depends(require_admin)])
async def delete_coupon(code: str):
    r = await db.coupons.delete_one({"code": code.upper()})
    return {"deleted": r.deleted_count}


@api.post("/coupons/validate")
async def validate_coupon(payload: dict, user: dict = Depends(current_user)):
    code = (payload.get("code") or "").strip().upper()
    if not code:
        raise HTTPException(400, "Codice mancante")
    c = await db.coupons.find_one({"code": code}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Codice non valido")
    if c.get("used_count", 0) >= c.get("max_uses", 0):
        raise HTTPException(410, "Codice esaurito")
    if c.get("expires_at"):
        try:
            if datetime.fromisoformat(c["expires_at"].replace("Z", "+00:00")) < datetime.now(timezone.utc):
                raise HTTPException(410, "Codice scaduto")
        except ValueError:
            pass
    return {"code": c["code"], "percent_off": c["percent_off"]}


# ---------------------------------------------------------------------------
# Subscription / checkout
# ---------------------------------------------------------------------------
@api.post("/billing/checkout")
async def checkout(inp: CheckoutIn, user: dict = Depends(current_user)):
    if inp.plan not in PLANS:
        raise HTTPException(400, "Piano non valido")
    plan = PLANS[inp.plan]
    amount = plan["price_eur"]
    applied_code = None
    if inp.coupon_code:
        code = inp.coupon_code.strip().upper()
        c = await db.coupons.find_one({"code": code})
        if not c:
            raise HTTPException(404, "Codice sconto non valido")
        if c.get("used_count", 0) >= c.get("max_uses", 0):
            raise HTTPException(410, "Codice sconto esaurito")
        amount = round(amount * (100 - c["percent_off"]) / 100)
        applied_code = code
        await db.coupons.update_one({"code": code}, {"$inc": {"used_count": 1}})
    order = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "plan": inp.plan,
        "amount_eur": amount,
        "original_eur": plan["price_eur"],
        "coupon_code": applied_code,
        "months": plan["months"],
        "status": "pending",
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order)
    return {
        "order_id": order["id"],
        "plan": inp.plan,
        "amount_eur": amount,
        "original_eur": plan["price_eur"],
        "coupon_code": applied_code,
        "status": "pending",
        "message": "Ordine registrato. Sarà attivato dopo conferma del pagamento.",
    }


@api.post("/admin/orders/{order_id}/activate", dependencies=[Depends(require_admin)])
async def activate_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Ordine non trovato")
    expires = datetime.now(timezone.utc) + timedelta(days=30 * order["months"])
    await db.users.update_one(
        {"id": order["user_id"]},
        {"$set": {"subscription": {
            "status": "premium",
            "plan": order["plan"],
            "expires_at": expires.isoformat(),
        }}},
    )
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "active"}})
    return {"ok": True}


@api.get("/admin/orders", dependencies=[Depends(require_admin)])
async def list_orders():
    cursor = db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(200)
    items = []
    async for o in cursor:
        u = await db.users.find_one({"id": o["user_id"]}, {"_id": 0, "phone": 1, "name": 1})
        items.append({**o, "user_phone": (u or {}).get("phone", ""), "user_name": (u or {}).get("name", "")})
    return {"items": items}


# ---------------------------------------------------------------------------
# YouTube channel import
# ---------------------------------------------------------------------------
class YoutubeImportIn(BaseModel):
    channel_url: str
    category: str = "Video"
    is_premium: bool = False


@api.post("/admin/media/import-youtube", dependencies=[Depends(require_admin)])
async def import_youtube_channel(inp: YoutubeImportIn):
    if inp.category not in CATEGORIES:
        raise HTTPException(400, "Categoria non valida")
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=20, headers={"User-Agent": "Mozilla/5.0"}) as h:
            r = await h.get(inp.channel_url)
            r.raise_for_status()
        m = re.search(r'"externalId":"(UC[\w-]+)"', r.text) or re.search(r'/channel/(UC[\w-]+)', r.text)
        if not m:
            raise HTTPException(400, "Impossibile trovare il canale YouTube")
        channel_id = m.group(1)

        # Prefer YouTube Data API v3 if API key configured (full archive), fallback to RSS (last 15)
        imported = 0
        skipped = 0
        total = 0

        if YOUTUBE_API_KEY:
            async with httpx.AsyncClient(timeout=30) as h:
                # 1) get uploads playlistId
                ch = await h.get(
                    "https://www.googleapis.com/youtube/v3/channels",
                    params={"part": "contentDetails", "id": channel_id, "key": YOUTUBE_API_KEY},
                )
                ch.raise_for_status()
                items = ch.json().get("items", [])
                if not items:
                    raise HTTPException(400, "Canale non trovato via API")
                uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]

                # 2) paginate playlistItems
                page_token = None
                while True:
                    params = {
                        "part": "snippet,contentDetails",
                        "playlistId": uploads,
                        "maxResults": 50,
                        "key": YOUTUBE_API_KEY,
                    }
                    if page_token:
                        params["pageToken"] = page_token
                    p = await h.get("https://www.googleapis.com/youtube/v3/playlistItems", params=params)
                    p.raise_for_status()
                    data = p.json()
                    for it in data.get("items", []):
                        total += 1
                        snip = it["snippet"]
                        vid = it["contentDetails"]["videoId"]
                        url = f"https://www.youtube.com/watch?v={vid}"
                        if await db.media.find_one({"media_url": url}):
                            skipped += 1
                            continue
                        thumbs = snip.get("thumbnails", {})
                        thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url") or f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
                        await db.media.insert_one({
                            "id": str(uuid.uuid4()),
                            "title": snip.get("title", f"Video {vid}"),
                            "description": (snip.get("description") or "")[:1000],
                            "category": inp.category,
                            "kind": "video",
                            "media_url": url,
                            "thumbnail_url": thumb,
                            "duration_sec": None,
                            "is_premium": inp.is_premium,
                            "views": 0,
                            "created_at": now_iso(),
                        })
                        imported += 1
                    page_token = data.get("nextPageToken")
                    if not page_token:
                        break
            return {"imported": imported, "skipped": skipped, "total": total, "channel_id": channel_id, "source": "youtube_api"}

        # Fallback: RSS (only last 15)
        async with httpx.AsyncClient(timeout=20) as h:
            rss = await h.get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
            rss.raise_for_status()
        feed = rss.text
        vids = re.findall(r"<yt:videoId>([^<]+)</yt:videoId>", feed)
        titles = re.findall(r"<media:title>([^<]+)</media:title>", feed)
        thumbs = re.findall(r'<media:thumbnail url="([^"]+)"', feed)
        descs = re.findall(r"<media:description>([^<]*)</media:description>", feed, re.S)
        total = len(vids)
        for i, vid in enumerate(vids):
            url = f"https://www.youtube.com/watch?v={vid}"
            if await db.media.find_one({"media_url": url}):
                skipped += 1
                continue
            title = titles[i] if i < len(titles) else f"Video {vid}"
            thumb = thumbs[i] if i < len(thumbs) else f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
            desc = (descs[i] if i < len(descs) else "").strip()[:800]
            await db.media.insert_one({
                "id": str(uuid.uuid4()),
                "title": title,
                "description": desc,
                "category": inp.category,
                "kind": "video",
                "media_url": url,
                "thumbnail_url": thumb,
                "duration_sec": None,
                "is_premium": inp.is_premium,
                "views": 0,
                "created_at": now_iso(),
            })
            imported += 1
        return {"imported": imported, "skipped": skipped, "total": total, "channel_id": channel_id, "source": "rss"}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("YouTube import failed")
        raise HTTPException(500, f"Errore import: {e}")


# ---------------------------------------------------------------------------
# Ads
# ---------------------------------------------------------------------------
class AdIn(BaseModel):
    image_url: str
    click_url: Optional[str] = None
    caption: Optional[str] = None
    is_active: bool = True


@api.get("/ads/active")
async def get_active_ads(user: dict = Depends(current_user)):
    """Return currently active ads. Frontend rotates through them."""
    cursor = db.ads.find({"is_active": True}, {"_id": 0}).sort("created_at", -1)
    items = []
    async for a in cursor:
        items.append({
            "id": a["id"],
            "image_url": a["image_url"],
            "click_url": a.get("click_url"),
            "caption": a.get("caption"),
        })
    return {"items": items}


@api.post("/admin/ads", dependencies=[Depends(require_admin)])
async def create_ad(inp: AdIn):
    doc = {
        "id": str(uuid.uuid4()),
        **inp.dict(),
        "created_at": now_iso(),
    }
    await db.ads.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/admin/ads", dependencies=[Depends(require_admin)])
async def list_ads():
    cursor = db.ads.find({}, {"_id": 0}).sort("created_at", -1)
    items = []
    async for a in cursor:
        items.append(a)
    return {"items": items}


@api.delete("/admin/ads/{ad_id}", dependencies=[Depends(require_admin)])
async def delete_ad(ad_id: str):
    r = await db.ads.delete_one({"id": ad_id})
    return {"deleted": r.deleted_count}


@api.post("/admin/ads/{ad_id}/toggle", dependencies=[Depends(require_admin)])
async def toggle_ad(ad_id: str):
    a = await db.ads.find_one({"id": ad_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Ad non trovato")
    await db.ads.update_one({"id": ad_id}, {"$set": {"is_active": not a.get("is_active", True)}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Register router and CORS
# ---------------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    client.close()
