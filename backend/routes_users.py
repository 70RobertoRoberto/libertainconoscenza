"""User-facing routes: profile (me/*), favorites, comments, completions,
referrals, stats, messages, push tokens, search."""
from __future__ import annotations

import os
import re
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from deps import now_iso, hash_password, is_subscription_active
from models import (
    MarketingConsentIn, SetEmailIn, SetNameIn, CookieConsentIn, CommentIn,
    CompletionIn, FavoriteIn, PushTokenIn, RegisterPushBody,
)
from serializers import (
    serialize_article, serialize_media, compute_streak,
)
from push import push_client

logger = logging.getLogger("conoscenza")


def build_users_router(db, current_user, require_admin) -> APIRouter:
    api = APIRouter(prefix="/api")

    # ---- Search --------------------------------------------------------
    @api.get("/search")
    async def search(q: str = Query(..., min_length=2), lang: Optional[str] = None, user: dict = Depends(current_user)):
        rgx = {"$regex": re.escape(q), "$options": "i"}
        text_or_article = [
            {"title": rgx}, {"summary": rgx}, {"category": rgx},
            {"title_en": rgx}, {"summary_en": rgx},
        ]
        text_or_media = [
            {"title": rgx}, {"description": rgx}, {"category": rgx},
            {"title_en": rgx}, {"description_en": rgx},
        ]
        articles = []
        async for a in db.articles.find({"$or": text_or_article}, {"_id": 0}).limit(30):
            articles.append(serialize_article(a, lang))
        media = []
        async for m in db.media.find({"$or": text_or_media}, {"_id": 0}).limit(30):
            media.append(serialize_media(m, lang))
        return {"articles": articles, "media": media}

    # ---- Comments ------------------------------------------------------
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

    # ---- Completions & certificates ------------------------------------
    @api.post("/completions")
    async def mark_completion(inp: CompletionIn, user: dict = Depends(current_user)):
        if inp.content_type not in ("article", "media"):
            raise HTTPException(400, "content_type non valido")
        key = {"user_id": user["id"], "content_id": inp.content_id}
        if await db.completions.find_one(key):
            return {"already": True}
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

    # ---- Referrals -----------------------------------------------------
    @api.get("/referrals/me")
    async def my_referrals(user: dict = Depends(current_user)):
        u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "referral_code": 1, "referral_count": 1})
        invited = []
        async for x in db.users.find({"referred_by": user["id"]}, {"_id": 0, "id": 1, "name": 1, "phone": 1, "subscription": 1, "created_at": 1}):
            invited.append({
                "id": x["id"],
                "name": x.get("name", ""),
                "phone": x["phone"][:6] + "***" + x["phone"][-3:],
                "premium": is_subscription_active(x),
                "created_at": x.get("created_at", ""),
            })
        return {
            "code": u.get("referral_code"),
            "count": u.get("referral_count", 0),
            "invited": invited,
        }

    # ---- Personal stats ------------------------------------------------
    @api.get("/me/stats")
    async def my_stats(user: dict = Depends(current_user)):
        uid = user["id"]
        read_ids = set()
        async for v in db.views.find({"user_id": uid, "content_type": "article"}, {"_id": 0, "content_id": 1}):
            read_ids.add(v["content_id"])
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
        dates = set()
        async for v in db.views.find({"user_id": uid}, {"_id": 0, "date": 1}):
            dates.add(v["date"])
        current, longest = compute_streak(list(dates))
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

    # ---- Subscription self-service ------------------------------------
    @api.post("/me/subscription/cancel-renewal")
    async def cancel_renewal(user: dict = Depends(current_user)):
        sub = user.get("subscription") or {}
        if sub.get("status") != "premium":
            raise HTTPException(400, "Nessun abbonamento attivo da disdire")
        if not sub.get("expires_at"):
            raise HTTPException(400, "Data di scadenza non impostata")
        new_sub = {**sub, "auto_renew": False, "cancelled_at": now_iso()}
        await db.users.update_one({"id": user["id"]}, {"$set": {"subscription": new_sub}})
        return {"ok": True, "message": "Rinnovo automatico disattivato. L'accesso Premium resta valido fino alla scadenza."}

    @api.post("/me/subscription/reactivate-renewal")
    async def reactivate_renewal(user: dict = Depends(current_user)):
        sub = user.get("subscription") or {}
        if sub.get("status") != "premium":
            raise HTTPException(400, "Nessun abbonamento attivo")
        new_sub = {**sub, "auto_renew": True, "cancelled_at": None}
        await db.users.update_one({"id": user["id"]}, {"$set": {"subscription": new_sub}})
        return {"ok": True, "message": "Rinnovo automatico riattivato."}

    # ---- Profile updates ----------------------------------------------
    @api.post("/me/name")
    async def set_my_name(inp: SetNameIn, user: dict = Depends(current_user)):
        first = (inp.first_name or "").strip()
        last = (inp.last_name or "").strip()
        if len(first) < 2:
            raise HTTPException(400, "Nome troppo corto (min 2 caratteri)")
        if len(last) < 2:
            raise HTTPException(400, "Cognome troppo corto (min 2 caratteri)")
        if len(first) > 80 or len(last) > 80:
            raise HTTPException(400, "Nome o cognome troppo lunghi")
        full = f"{first} {last}"
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"first_name": first, "last_name": last, "name": full}},
        )
        return {"ok": True, "name": full, "first_name": first, "last_name": last}

    @api.post("/me/email")
    async def set_my_email(inp: SetEmailIn, user: dict = Depends(current_user)):
        e = (inp.email or "").strip().lower()
        if not e or "@" not in e or "." not in e.split("@")[-1]:
            raise HTTPException(400, "Email non valida")
        if len(e) > 200:
            raise HTTPException(400, "Email troppo lunga")
        existing = await db.users.find_one({"email": e, "id": {"$ne": user["id"]}})
        if existing:
            raise HTTPException(409, "Questa email è già associata a un altro account")
        prev = (user.get("email") or "").lower()
        changed = (e != prev)
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"email": e, **({"email_verified": False} if changed else {})}},
        )
        if changed or not user.get("email_verified"):
            try:
                token = str(uuid.uuid4())
                expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
                await db.email_verifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "token": token,
                    "user_id": user["id"],
                    "email": e,
                    "created_at": now_iso(),
                    "expires_at": expires,
                    "used_at": None,
                })
                base_url = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("APP_PUBLIC_URL") or "https://libertaconoscenza.emergent.host"
                verify_url = f"{base_url.rstrip('/')}/verify-email?token={token}"
                from emailer import send_email, render_email_verification
                subj, html = render_email_verification(user.get("name") or "", verify_url)
                await send_email(to=e, subject=subj, html=html)
            except Exception as ex:
                logger.warning(f"Verification email failed: {ex}")
        return {"ok": True, "email": e, "email_verified": False if changed else bool(user.get("email_verified"))}

    @api.post("/me/email/resend-verification")
    async def resend_email_verification(user: dict = Depends(current_user)):
        e = (user.get("email") or "").lower()
        if not e:
            raise HTTPException(400, "Non hai un'email registrata")
        if user.get("email_verified"):
            return {"ok": True, "message": "Email già verificata"}
        try:
            token = str(uuid.uuid4())
            expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
            await db.email_verifications.insert_one({
                "id": str(uuid.uuid4()),
                "token": token,
                "user_id": user["id"],
                "email": e,
                "created_at": now_iso(),
                "expires_at": expires,
                "used_at": None,
            })
            base_url = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("APP_PUBLIC_URL") or "https://libertaconoscenza.emergent.host"
            verify_url = f"{base_url.rstrip('/')}/verify-email?token={token}"
            from emailer import send_email, render_email_verification
            subj, html = render_email_verification(user.get("name") or "", verify_url)
            await send_email(to=e, subject=subj, html=html)
            return {"ok": True, "message": "Email di verifica inviata"}
        except Exception as ex:
            raise HTTPException(500, f"Invio non riuscito: {ex}")

    @api.post("/me/marketing-consent")
    async def set_marketing_consent(inp: MarketingConsentIn, user: dict = Depends(current_user)):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {
                "marketing_consent": bool(inp.consent),
                "marketing_consent_at": now_iso(),
            }},
        )
        return {"ok": True, "marketing_consent": bool(inp.consent)}

    @api.post("/me/cookie-consent")
    async def set_cookie_consent(inp: CookieConsentIn, request: Request, user: dict = Depends(current_user)):
        doc = {
            "technical": True,
            "analytics_first": bool(inp.analytics_first),
            "analytics_third": bool(inp.analytics_third),
            "marketing": bool(inp.marketing),
            "decided_at": now_iso(),
            "decided_ip": request.client.host if request and request.client else None,
        }
        await db.users.update_one({"id": user["id"]}, {"$set": {"cookie_consent": doc}})
        return {"ok": True, "cookie_consent": doc}

    # ---- Messages -----------------------------------------------------
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

    # ---- Push tokens --------------------------------------------------
    @api.post("/me/push-token")
    async def save_push_token(inp: PushTokenIn, user: dict = Depends(current_user)):
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"push_token": inp.token, "push_platform": inp.platform}},
        )
        return {"ok": True}

    @api.post("/register-push", status_code=201)
    async def register_push_relay(body: RegisterPushBody):
        await db.users.update_one(
            {"id": body.user_id},
            {"$set": {"device_token": body.device_token, "push_platform": body.platform}},
        )
        try:
            resp = await push_client.post("/api/v1/push/users/register", json=body.model_dump())
            if resp.status_code < 400:
                return {"status": "registered"}
            logger.warning(f"Push registration upstream {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Push registration relay failed (non-blocking): {e}")
        return {"status": "stored_locally"}

    # ---- Favorites ----------------------------------------------------
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
    async def list_favorites(lang: Optional[str] = None, user: dict = Depends(current_user)):
        cursor = db.favorites.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
        articles, media = [], []
        async for f in cursor:
            if f["content_type"] == "article":
                a = await db.articles.find_one({"id": f["content_id"]}, {"_id": 0})
                if a:
                    articles.append(serialize_article(a, lang))
            else:
                m = await db.media.find_one({"id": f["content_id"]}, {"_id": 0})
                if m:
                    media.append(serialize_media(m, lang))
        ids = set()
        async for f in db.favorites.find({"user_id": user["id"]}, {"_id": 0, "content_id": 1}):
            ids.add(f["content_id"])
        return {"articles": articles, "media": media, "ids": list(ids)}

    return api
