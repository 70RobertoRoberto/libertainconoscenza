"""Conoscenza Aperta / Libertà in Conoscenza — FastAPI backend entrypoint.

Slim entrypoint. All business logic lives in dedicated modules under this
directory. The endpoints are grouped by domain into factory-built APIRouters
that receive the shared `db`, `current_user` and `require_admin` dependencies.

Module map:
    deps.py                shared JWT/auth/password/user helpers + Mongo client
    constants.py           category constants, subscription plans, ALLOWED_MIME
    models.py              all Pydantic request/response models
    storage.py             Emergent Object Storage helpers (init/put/get)
    push.py                Emergent managed push notifications wrapper
    serializers.py         article/media/playlist serializers, streak, OG HTML

    routes_auth.py         register/login/logout, password reset, email verify
    routes_users.py        me/*, favorites, comments, completions, referrals,
                           stats, messages, push tokens, search
    routes_admin.py        admin/users, admin/stats, admin/messages,
                           admin/password-resets, subscription cron trigger
    routes_articles.py     public + admin articles CRUD + AI summarize
    routes_media.py        media + categories + upload/file + ads + playlists +
                           YouTube import
    routes_payments.py     coupons, /billing/checkout, Stripe (checkout + webhook)
    routes_share.py        Open Graph / SEO share HTML wrappers + /public/*
    routes_courses.py      (existing) LMS Corsi
    routes_support.py      (existing) support tickets
    subscription_scheduler daily cron for subscription reminders/renewals
    stripe_service         thin wrapper on Emergent Stripe proxy
    media_processor        image/audio/video compression pipeline
    emailer                Resend email templates
"""
import logging
import uuid
from datetime import timedelta, timezone, datetime

from fastapi import FastAPI, APIRouter, Depends
from fastapi.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

from deps import (
    client, db, logger,
    ADMIN_PHONE, ADMIN_PASSWORD,
    now_iso, normalize_phone, hash_password, _gen_referral_code,
    current_user, require_admin,
)
from constants import CATEGORIES, MEDITATION_CATEGORIES, VIDEO_CATEGORIES, PLANS

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Conoscenza Aperta API")

# The single "api" router hosts the tiny top-level endpoints (root/plans/
# categories/articles counts). All other endpoints live in dedicated routers
# built by factory functions and included below.
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {"app": "Conoscenza Aperta", "version": "1.0"}


@api.get("/health")
async def health():
    """Kubernetes/Emergent health probe. Verifies the app is up and Mongo
    responds to a ping."""
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "app": "Libertà in Conoscenza",
        "db": "ok" if db_ok else "down",
    }


# Root-level /health so Emergent's non-/api health probe finds it too.
@app.get("/health")
async def health_root():
    try:
        await db.command("ping")
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": "ok" if db_ok else "down"}


@api.get("/categories")
async def get_categories():
    return {"categories": CATEGORIES}


@api.get("/plans")
async def get_plans():
    return {"plans": PLANS}


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
    await db.course_areas.create_index("slug", unique=True)
    await db.support_tickets.create_index("id", unique=True)
    await db.support_tickets.create_index([("user_id", 1), ("created_at", -1)])
    await db.users.create_index(
        "email",
        unique=True,
        partialFilterExpression={"email": {"$type": "string"}},
    )
    await db.login_history.create_index([("user_id", 1), ("at", -1)])
    await db.email_verifications.create_index("token", unique=True)
    await db.email_verifications.create_index([("user_id", 1), ("created_at", -1)])

    # Preseed default course thematic areas (idempotent)
    _default_areas = [
        {"slug": "biofisica-quantistica", "name": "Biofisica Quantistica", "order": 1},
        {"slug": "meditazione", "name": "Meditazione", "order": 2},
        {"slug": "naturopatia", "name": "Naturopatia", "order": 3},
        {"slug": "medicina-integrata", "name": "Medicina Integrata", "order": 4},
        {"slug": "crescita-personale", "name": "Crescita Personale", "order": 5},
        {"slug": "discipline-orientali", "name": "Discipline Orientali", "order": 6},
        {"slug": "filosofia", "name": "Filosofia", "order": 7},
        {"slug": "psicologia", "name": "Psicologia", "order": 8},
        {"slug": "guarigione-energetica", "name": "Guarigione Energetica", "order": 9},
        {"slug": "tradizioni-esoteriche", "name": "Tradizioni Esoteriche", "order": 10},
        {"slug": "nutrizione", "name": "Nutrizione", "order": 11},
    ]
    for a in _default_areas:
        if not await db.course_areas.find_one({"slug": a["slug"]}):
            await db.course_areas.insert_one({
                "id": str(uuid.uuid4()),
                "slug": a["slug"],
                "name": a["name"],
                "order": a["order"],
                "created_at": now_iso(),
            })

    # Init object storage (best-effort)
    try:
        from storage import init_storage_sync
        await run_in_threadpool(init_storage_sync)
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

    # Start daily subscription lifecycle scheduler
    try:
        from subscription_scheduler import start_scheduler
        start_scheduler(db)
    except Exception as e:
        logger.warning(f"Subscription scheduler failed to start: {e}")

    # Stripe bootstrap
    try:
        from stripe_service import is_configured as _stripe_ok
        if _stripe_ok():
            logger.info("[STRIPE] integration enabled (Emergent proxy)")
    except Exception as e:
        logger.warning(f"Stripe bootstrap skipped: {e}")


async def _seed_demo_content():
    """Seed initial content — first-run only. Kept here because it's called
    once at startup and does not need to be part of any router module."""
    demo_articles = [
        {"title": "Il potere del respiro consapevole", "summary": "Il respiro consapevole è la porta d'accesso al momento presente. Le antiche tradizioni orientali, dallo yoga al pranayama, insegnano che modulare il ritmo respiratorio calma il sistema nervoso e riequilibra corpo e mente. Bastano pochi minuti al giorno di respirazione profonda diaframmatica per ridurre lo stress, migliorare la concentrazione e aumentare l'energia vitale. Il respiro è ponte tra volontario e involontario, tra materia e coscienza.", "category": "Meditazione", "source_url": "https://www.summaaurea.org/category/summa-aurea-generale/", "image_url": "https://images.unsplash.com/photo-1636794369713-f3eb3c8a3535?w=800"},
        {"title": "Biofisica quantistica: la nuova frontiera della salute", "summary": "La biofisica quantistica studia i fenomeni sub-atomici che regolano la vita a livello cellulare. Ricerche recenti mostrano che le cellule comunicano tramite biofotoni, particelle di luce debolissime emesse dal DNA. Questo modello supera la visione puramente biochimica e apre la strada a terapie basate su frequenze, campi elettromagnetici coerenti e informazione. La malattia diventa un disordine informazionale prima che biochimico.", "category": "Fisica quantistica", "source_url": "https://www.scienzebiofisiche.it/", "image_url": "https://images.pexels.com/photos/38032287/pexels-photo-38032287.png?w=800"},
        {"title": "Somatognostica: conoscere sé stessi attraverso il corpo", "summary": "La Somatognostica è una disciplina che unisce psicologia, filosofia e discipline corporee per accedere alla conoscenza di sé attraverso l'ascolto del corpo. Ogni tensione, ogni postura racconta una storia personale non narrata. Portando consapevolezza alle sensazioni somatiche si sciolgono blocchi emotivi profondi e si integrano parti dimenticate del sé. Il corpo diventa maestro e testimone del processo di individuazione.", "category": "Somatognostica", "source_url": "https://www.somatognostica.it/", "image_url": "https://images.unsplash.com/photo-1588406320565-9fa6d9901d1d?w=800"},
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
        {"title": "Meditazione guidata: respiro e presenza", "description": "10 minuti di meditazione guidata per riportare l'attenzione al respiro e al momento presente.", "category": "Meditazione", "kind": "meditation", "media_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", "thumbnail_url": "https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=800", "duration_sec": 600, "is_premium": False},
        {"title": "Introduzione alla Somatognostica", "description": "Video introduttivo sui principi della Somatognostica e sul suo approccio al corpo come veicolo di conoscenza.", "category": "Video", "kind": "video", "media_url": "https://www.youtube.com/watch?v=DWcJFNfaw9c", "thumbnail_url": "https://images.unsplash.com/photo-1588406320565-9fa6d9901d1d?w=800", "duration_sec": 480, "is_premium": False},
    ]
    for m in demo_media:
        await db.media.insert_one({
            "id": str(uuid.uuid4()),
            **m,
            "views": 0,
            "created_at": now_iso(),
        })


# ---------------------------------------------------------------------------
# Register routers (order does not matter — everything mounts on the same
# /api prefix. Middleware is added AFTER all include_router calls, matching
# the previous behavior of the monolithic server.py).
# ---------------------------------------------------------------------------
app.include_router(api)

# Route modules built with the shared factory pattern.
from routes_auth import build_auth_router  # noqa: E402
from routes_users import build_users_router  # noqa: E402
from routes_admin import build_admin_router  # noqa: E402
from routes_articles import build_articles_router  # noqa: E402
from routes_media import build_media_router  # noqa: E402
from routes_payments import build_payments_router  # noqa: E402
from routes_share import build_share_router  # noqa: E402
from routes_courses import build_courses_router  # noqa: E402
from routes_support import build_support_router  # noqa: E402

app.include_router(build_auth_router(db, current_user, require_admin))
app.include_router(build_users_router(db, current_user, require_admin))
app.include_router(build_admin_router(db, current_user, require_admin))
app.include_router(build_articles_router(db, current_user, require_admin))
app.include_router(build_media_router(db, current_user, require_admin))
app.include_router(build_payments_router(db, current_user, require_admin))
app.include_router(build_share_router(db, current_user, require_admin))
app.include_router(build_courses_router(db, current_user, require_admin))
app.include_router(build_support_router(db, current_user, require_admin))


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    try:
        from subscription_scheduler import stop_scheduler
        stop_scheduler()
    except Exception:
        pass
    client.close()
