"""Shared FastAPI dependencies: DB, auth, JWT, password hashing, user shaping.

Everything here is stateless helper code — no route decorators.
"""
from __future__ import annotations

import os
import re
import uuid
import logging
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, Header, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("conoscenza")

# ---------------------------------------------------------------------------
# Env
# ---------------------------------------------------------------------------
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

# ---------------------------------------------------------------------------
# DB (single client shared by everything)
# ---------------------------------------------------------------------------
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


# ---------------------------------------------------------------------------
# Auth utilities
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


def make_token(user_id: str, session_id: Optional[str] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iss": JWT_ISSUER,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=JWT_TTL_MIN)).timestamp()),
    }
    if session_id:
        payload["sid"] = session_id
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
    # Enforce single-session for non-admin users.
    if not user.get("is_admin"):
        current_sid = user.get("current_session_id")
        if current_sid:
            token_sid = claims.get("sid")
            if token_sid and token_sid != current_sid:
                raise HTTPException(
                    401,
                    "Sessione scaduta: hai effettuato l'accesso da un altro dispositivo",
                )
    return user


async def require_admin(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(403, "Admin required")
    return user


def subscription_view(u: dict) -> dict:
    """Return the user's live subscription with computed trial days remaining and
    active-flag."""
    sub = u.get("subscription") or {"status": "free"}
    status = sub.get("status") or "free"
    expires_at = sub.get("expires_at")
    days_remaining: Optional[int] = None
    if expires_at:
        try:
            exp = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            if exp < now:
                return {"status": "free", "plan": sub.get("plan"), "expires_at": expires_at, "days_remaining": 0, "active": False}
            days_remaining = max(0, (exp - now).days)
        except Exception:
            pass
    active = status in ("premium", "trial")
    return {
        "status": status,
        "plan": sub.get("plan"),
        "expires_at": expires_at,
        "days_remaining": days_remaining,
        "active": active,
        "auto_renew": bool(sub.get("auto_renew", status == "premium")),
        "cancelled_at": sub.get("cancelled_at"),
    }


def is_subscription_active(u: dict) -> bool:
    return bool(subscription_view(u).get("active"))


def to_public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "phone": u["phone"],
        "email": u.get("email"),
        "email_verified": bool(u.get("email_verified", False)),
        "name": u.get("name"),
        "first_name": u.get("first_name"),
        "last_name": u.get("last_name"),
        "is_admin": u.get("is_admin", False),
        "subscription": subscription_view(u),
        "referral_code": u.get("referral_code"),
        "marketing_consent": bool(u.get("marketing_consent", False)),
        "cookie_consent": u.get("cookie_consent"),
        "last_login_at": u.get("last_login_at"),
        "last_login_device": u.get("last_login_device"),
    }


def _gen_referral_code(name: str) -> str:
    base = re.sub(r"[^A-Za-z]", "", (name or "AMICO"))[:6].upper() or "AMICO"
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"{base}-{suffix}"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def parse_ua(ua: str) -> str:
    """Best-effort user-agent → short human label ('Chrome su Windows')."""
    if not ua:
        return "Sconosciuto"
    ua_low = ua.lower()
    if "iphone" in ua_low or "ipad" in ua_low or ("mac os" in ua_low and "mobile" in ua_low):
        os_lbl = "iPhone" if "iphone" in ua_low else ("iPad" if "ipad" in ua_low else "iOS")
    elif "android" in ua_low:
        os_lbl = "Android"
    elif "windows" in ua_low:
        os_lbl = "Windows"
    elif "mac os" in ua_low or "macintosh" in ua_low:
        os_lbl = "macOS"
    elif "linux" in ua_low:
        os_lbl = "Linux"
    else:
        os_lbl = "Sconosciuto"
    if "expo" in ua_low or "okhttp" in ua_low:
        br_lbl = "Expo Go"
    elif "edg/" in ua_low:
        br_lbl = "Edge"
    elif "chrome" in ua_low and "safari" in ua_low:
        br_lbl = "Chrome"
    elif "firefox" in ua_low:
        br_lbl = "Firefox"
    elif "safari" in ua_low:
        br_lbl = "Safari"
    else:
        br_lbl = "App"
    return f"{br_lbl} su {os_lbl}"


# Alias for backwards-compat with server.py internal name
_parse_ua = parse_ua
