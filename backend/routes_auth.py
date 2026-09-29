"""Auth routes: register, login, logout, password reset, email verification,
account deletion, login history."""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from deps import (
    now_iso, normalize_phone, hash_password, check_password, make_token,
    _gen_referral_code, parse_ua, to_public_user,
)
from models import (
    RegisterIn, LoginIn, TokenOut, ChangePasswordIn, DeleteMeIn,
    PasswordResetRequestIn,
)
from constants import TRIAL_DAYS

logger = logging.getLogger("conoscenza")


def build_auth_router(db, current_user, require_admin) -> APIRouter:
    api = APIRouter(prefix="/api")

    @api.post("/auth/register", response_model=TokenOut)
    async def register(inp: RegisterIn, request: Request):
        phone = normalize_phone(inp.phone)
        if await db.users.find_one({"phone": phone}):
            raise HTTPException(409, "Numero già registrato")
        email = None
        if inp.email:
            e = inp.email.strip().lower()
            if e:
                if "@" not in e or "." not in e.split("@")[-1]:
                    raise HTTPException(400, "Email non valida")
                if await db.users.find_one({"email": e}):
                    raise HTTPException(409, "Email già registrata")
                email = e
        referred_by = None
        if inp.referral_code:
            code = inp.referral_code.strip().upper()
            ref = await db.users.find_one({"referral_code": code}, {"_id": 0, "id": 1})
            if ref:
                referred_by = ref["id"]
        referral_code = _gen_referral_code(inp.name or "AMICO")
        while await db.users.find_one({"referral_code": referral_code}):
            referral_code = _gen_referral_code(inp.name or "AMICO")
        trial_expires = (datetime.now(timezone.utc) + timedelta(days=TRIAL_DAYS)).isoformat()
        sid = str(uuid.uuid4())
        ua = request.headers.get("user-agent", "") if request else ""
        ip = request.client.host if request and request.client else None
        device_lbl = parse_ua(ua)
        _first = (inp.first_name or "").strip()
        _last = (inp.last_name or "").strip()
        if _first or _last:
            full_name = f"{_first} {_last}".strip()
        else:
            full_name = (inp.name or "").strip()
            parts = full_name.split()
            if not _first and parts:
                _first = parts[0]
            if not _last and len(parts) > 1:
                _last = " ".join(parts[1:])
        if not full_name:
            raise HTTPException(400, "Nome richiesto")
        user = {
            "id": str(uuid.uuid4()),
            "phone": phone,
            "email": email,
            "password_hash": hash_password(inp.password),
            "name": full_name,
            "first_name": _first or None,
            "last_name": _last or None,
            "is_admin": False,
            "subscription": {
                "status": "trial",
                "plan": "trial_15d",
                "expires_at": trial_expires,
            },
            "referral_code": referral_code,
            "referred_by": referred_by,
            "referral_count": 0,
            "current_session_id": sid,
            "last_login_at": now_iso(),
            "last_login_device": device_lbl,
            "last_login_ip": ip,
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
        await db.login_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "at": now_iso(),
            "device": device_lbl,
            "ua": ua[:200],
            "ip": ip,
            "kind": "register",
        })
        if referred_by:
            await db.users.update_one({"id": referred_by}, {"$inc": {"referral_count": 1}})
        return TokenOut(access_token=make_token(user["id"], sid), user=to_public_user(user))

    @api.post("/auth/login", response_model=TokenOut)
    async def login(inp: LoginIn, request: Request):
        phone = normalize_phone(inp.phone)
        u = await db.users.find_one({"phone": phone})
        if not u or not check_password(inp.password, u["password_hash"]):
            raise HTTPException(401, "Credenziali non valide")
        ua = request.headers.get("user-agent", "") if request else ""
        ip = request.client.host if request and request.client else None
        device_lbl = parse_ua(ua)
        if u.get("is_admin"):
            sid = str(uuid.uuid4())
            update = {"$set": {"last_login_at": now_iso(), "last_login_device": device_lbl, "last_login_ip": ip}}
        else:
            sid = str(uuid.uuid4())
            update = {"$set": {
                "current_session_id": sid,
                "last_login_at": now_iso(),
                "last_login_device": device_lbl,
                "last_login_ip": ip,
            }}
        await db.users.update_one({"id": u["id"]}, update)
        await db.login_history.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": u["id"],
            "at": now_iso(),
            "device": device_lbl,
            "ua": ua[:200],
            "ip": ip,
            "kind": "login",
        })
        u = await db.users.find_one({"id": u["id"]}, {"_id": 0, "password_hash": 0})
        return TokenOut(access_token=make_token(u["id"], sid), user=to_public_user(u))

    @api.post("/auth/logout")
    async def logout(user: dict = Depends(current_user)):
        if not user.get("is_admin"):
            await db.users.update_one({"id": user["id"]}, {"$unset": {"current_session_id": ""}})
        return {"ok": True}

    @api.get("/auth/me")
    async def me(user: dict = Depends(current_user)):
        return to_public_user(user)

    @api.get("/verify-email")
    async def verify_email(token: str = ""):
        if not token:
            return {"ok": False, "message": "Token mancante"}
        v = await db.email_verifications.find_one({"token": token}, {"_id": 0})
        if not v:
            return {"ok": False, "message": "Token non valido o già utilizzato"}
        try:
            exp = datetime.fromisoformat(v["expires_at"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                return {"ok": False, "message": "Link scaduto. Torna in app e chiedi un nuovo invio."}
        except Exception:
            pass
        if v.get("used_at"):
            return {"ok": True, "message": "Email già verificata", "already": True}
        await db.users.update_one({"id": v["user_id"], "email": v["email"]}, {"$set": {"email_verified": True, "email_verified_at": now_iso()}})
        await db.email_verifications.update_one({"token": token}, {"$set": {"used_at": now_iso()}})
        return {"ok": True, "message": "Email verificata con successo"}

    @api.get("/me/login-history")
    async def my_login_history(user: dict = Depends(current_user)):
        cur = db.login_history.find({"user_id": user["id"]}, {"_id": 0}).sort("at", -1).limit(30)
        items = await cur.to_list(30)
        return {"items": items}

    @api.post("/auth/change-password")
    async def change_password(inp: ChangePasswordIn, user: dict = Depends(current_user)):
        full = await db.users.find_one({"id": user["id"]})
        if not full:
            raise HTTPException(404, "Utente non trovato")
        if not check_password(inp.current_password, full["password_hash"]):
            raise HTTPException(400, "Password attuale errata")
        if inp.current_password == inp.new_password:
            raise HTTPException(400, "La nuova password deve essere diversa dall'attuale")
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"password_hash": hash_password(inp.new_password)}},
        )
        return {"ok": True}

    @api.post("/auth/delete-me")
    async def delete_me(inp: DeleteMeIn, user: dict = Depends(current_user)):
        full = await db.users.find_one({"id": user["id"]})
        if not full:
            raise HTTPException(404, "Utente non trovato")
        if full.get("is_admin"):
            raise HTTPException(400, "Gli amministratori non possono eliminarsi da soli. Contatta il supporto.")
        if not check_password(inp.current_password, full["password_hash"]):
            raise HTTPException(400, "Password errata")
        uid = user["id"]
        await db.favorites.delete_many({"user_id": uid})
        await db.comments.delete_many({"user_id": uid})
        await db.orders.delete_many({"user_id": uid})
        await db.views.delete_many({"user_id": uid})
        await db.completions.delete_many({"user_id": uid})
        await db.referrals.delete_many({"user_id": uid})
        await db.password_reset_requests.delete_many({"user_id": uid})
        r = await db.users.delete_one({"id": uid})
        return {"deleted": r.deleted_count}

    @api.post("/auth/password-reset-request")
    async def password_reset_request(inp: PasswordResetRequestIn):
        phone = normalize_phone(inp.phone)
        if not phone:
            raise HTTPException(400, "Numero di telefono mancante")
        user = await db.users.find_one({"phone": phone}, {"id": 1, "name": 1, "phone": 1})
        if user:
            await db.password_reset_requests.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "phone": phone,
                "name": user.get("name") or "",
                "email": (inp.email or "").strip()[:120],
                "note": (inp.note or "").strip()[:500],
                "status": "pending",
                "created_at": now_iso(),
            })
        return {"ok": True, "message": "Se il numero è registrato, riceverai istruzioni sulla nuova password via WhatsApp o email."}

    return api
