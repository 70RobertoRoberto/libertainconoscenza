"""Admin routes: user management, comments moderation, statistics, messages,
password resets, subscription cron trigger."""
from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from deps import now_iso, hash_password, subscription_view
from models import MessageIn, AdminResetPasswordIn
from push import send_push_bg, all_user_ids

logger = logging.getLogger("conoscenza")


def build_admin_router(db, current_user, require_admin) -> APIRouter:
    api = APIRouter(prefix="/api")

    # ---- Comments moderation ------------------------------------------
    @api.get("/admin/comments", dependencies=[Depends(require_admin)])
    async def admin_list_comments(limit: int = 200):
        cursor = db.comments.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
        items = []
        async for c in cursor:
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

    # ---- Login history (admin view) -----------------------------------
    @api.get("/admin/users/{user_id}/login-history", dependencies=[Depends(require_admin)])
    async def admin_login_history(user_id: str):
        cur = db.login_history.find({"user_id": user_id}, {"_id": 0}).sort("at", -1).limit(50)
        items = await cur.to_list(50)
        from collections import Counter
        now = datetime.now(timezone.utc)
        recent_ips = Counter()
        for it in items:
            try:
                at = datetime.fromisoformat(str(it.get("at")).replace("Z", "+00:00"))
                if (now - at).total_seconds() <= 86400:
                    if it.get("ip"):
                        recent_ips[it["ip"]] += 1
            except Exception:
                pass
        return {"items": items, "distinct_ips_24h": len(recent_ips), "suspicious": len(recent_ips) > 5}

    # ---- Password reset requests --------------------------------------
    @api.get("/admin/password-reset-requests", dependencies=[Depends(require_admin)])
    async def list_password_reset_requests():
        items = []
        async for r in db.password_reset_requests.find({}, {"_id": 0}).sort("created_at", -1):
            items.append(r)
        return {"items": items}

    @api.post("/admin/reset-user-password")
    async def admin_reset_user_password(inp: AdminResetPasswordIn, admin: dict = Depends(current_user)):
        if not admin.get("is_admin"):
            raise HTTPException(403, "Solo admin")
        target = await db.users.find_one({"id": inp.user_id})
        if not target:
            raise HTTPException(404, "Utente non trovato")
        await db.users.update_one(
            {"id": inp.user_id},
            {"$set": {"password_hash": hash_password(inp.new_password)}},
        )
        if inp.request_id:
            await db.password_reset_requests.update_one(
                {"id": inp.request_id},
                {"$set": {"status": "done", "resolved_at": now_iso(), "resolved_by": admin["id"]}},
            )
        return {"ok": True, "phone": target["phone"]}

    # ---- Users management ---------------------------------------------
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
                "subscription": subscription_view(u),
                "created_at": u.get("created_at", ""),
            })
        return {"items": items}

    @api.delete("/admin/users/{user_id}")
    async def delete_user(user_id: str, admin: dict = Depends(current_user)):
        if not admin.get("is_admin"):
            raise HTTPException(403, "Solo admin")
        target = await db.users.find_one({"id": user_id})
        if not target:
            raise HTTPException(404, "Utente non trovato")
        if target["id"] == admin["id"]:
            raise HTTPException(400, "Non puoi eliminare te stesso")
        if target.get("is_admin"):
            remaining_admins = await db.users.count_documents({"is_admin": True, "id": {"$ne": user_id}})
            if remaining_admins <= 0:
                raise HTTPException(400, "Impossibile eliminare l'ultimo amministratore")
        await db.favorites.delete_many({"user_id": user_id})
        await db.comments.delete_many({"user_id": user_id})
        await db.orders.delete_many({"user_id": user_id})
        await db.views.delete_many({"user_id": user_id})
        await db.completions.delete_many({"user_id": user_id})
        await db.referrals.delete_many({"user_id": user_id})
        r = await db.users.delete_one({"id": user_id})
        return {"deleted": r.deleted_count, "phone": target["phone"]}

    @api.post("/admin/users/bulk-delete")
    async def bulk_delete_users(payload: dict, admin: dict = Depends(current_user)):
        if not admin.get("is_admin"):
            raise HTTPException(403, "Solo admin")
        ids = payload.get("ids") or []
        if not isinstance(ids, list) or not ids:
            raise HTTPException(400, "Lista ids mancante")
        to_delete = []
        async for u in db.users.find({"id": {"$in": ids}}, {"id": 1, "is_admin": 1}):
            if u["id"] == admin["id"]:
                continue
            if u.get("is_admin"):
                continue
            to_delete.append(u["id"])
        if not to_delete:
            return {"deleted": 0}
        await db.favorites.delete_many({"user_id": {"$in": to_delete}})
        await db.comments.delete_many({"user_id": {"$in": to_delete}})
        await db.orders.delete_many({"user_id": {"$in": to_delete}})
        await db.views.delete_many({"user_id": {"$in": to_delete}})
        await db.completions.delete_many({"user_id": {"$in": to_delete}})
        await db.referrals.delete_many({"user_id": {"$in": to_delete}})
        r = await db.users.delete_many({"id": {"$in": to_delete}})
        return {"deleted": r.deleted_count}

    # ---- Statistics ----------------------------------------------------
    @api.get("/admin/stats/summary", dependencies=[Depends(require_admin)])
    async def stats_summary():
        total_users = await db.users.count_documents({})
        total_articles = await db.articles.count_documents({})
        total_media = await db.media.count_documents({})
        total_views = await db.views.count_documents({})
        now_iso_str = datetime.now(timezone.utc).isoformat()
        premium_users = await db.users.count_documents({
            "subscription.status": "premium",
            "$or": [{"subscription.expires_at": None}, {"subscription.expires_at": {"$gte": now_iso_str}}],
        })
        trial_users = await db.users.count_documents({
            "subscription.status": "trial",
            "subscription.expires_at": {"$gte": now_iso_str},
        })

        app_start_date: Optional[str] = None
        earliest_view = await db.views.find_one({}, sort=[("date", 1)])
        if earliest_view and earliest_view.get("date"):
            app_start_date = earliest_view["date"]
        else:
            earliest_user = await db.users.find_one({}, sort=[("created_at", 1)])
            if earliest_user and earliest_user.get("created_at"):
                app_start_date = earliest_user["created_at"][:10]
            else:
                app_start_date = datetime.utcnow().strftime("%Y-%m-%d")

        now = datetime.utcnow()
        month_prefix = now.strftime("%Y-%m")
        year_prefix = now.strftime("%Y")

        views_month = await db.views.count_documents({"date": {"$regex": f"^{month_prefix}"}})
        views_year = await db.views.count_documents({"date": {"$regex": f"^{year_prefix}"}})
        today_str = now.strftime("%Y-%m-%d")
        views_today = await db.views.count_documents({"date": today_str})

        return {
            "users": total_users,
            "premium_users": premium_users,
            "trial_users": trial_users,
            "articles": total_articles,
            "media": total_media,
            "total_views": total_views,
            "app_start_date": app_start_date,
            "views_today": views_today,
            "views_month": views_month,
            "views_year": views_year,
            "current_month": month_prefix,
            "current_year": year_prefix,
        }

    @api.get("/admin/stats/daily", dependencies=[Depends(require_admin)])
    async def stats_daily(days: int = 14):
        from datetime import timedelta
        today = datetime.utcnow().date()
        start_date = today - timedelta(days=days - 1)
        start_str = start_date.strftime("%Y-%m-%d")

        pipeline = [
            {"$match": {"date": {"$gte": start_str}}},
            {"$group": {"_id": "$date", "count": {"$sum": 1}}},
        ]
        counts: dict = {}
        async for row in db.views.aggregate(pipeline):
            counts[row["_id"]] = row.get("count", 0)

        result = []
        for i in range(days):
            d = start_date + timedelta(days=i)
            ds = d.strftime("%Y-%m-%d")
            result.append({"date": ds, "views": counts.get(ds, 0)})
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

    # ---- Messages (admin push) ----------------------------------------
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
            recipients = [inp.target_user_id] if inp.target_user_id else await all_user_ids()
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

    # ---- Subscription cron trigger ------------------------------------
    @api.post("/admin/subscriptions/run-daily-job", dependencies=[Depends(require_admin)])
    async def admin_run_subscription_job():
        from subscription_scheduler import run_subscription_lifecycle
        result = await run_subscription_lifecycle(db)
        return {"ok": True, "result": result}

    @api.post("/admin/subscriptions/purge-expired", dependencies=[Depends(require_admin)])
    async def admin_purge_expired_users(dry_run: bool = True):
        """Manually purge progress data for users whose grace window ended.

        DESTRUCTIVE — the daily cron never runs this automatically. Only an
        admin can invoke it, and by default we run in `dry_run=True` mode
        (returns the list of user IDs that would be purged without deleting
        anything). Pass `?dry_run=false` explicitly to actually delete.
        """
        from subscription_scheduler import _purge_user_progress, _parse_iso, _now_utc
        now = _now_utc()
        candidates = []
        async for u in db.users.find({"subscription.purge_at": {"$ne": None}}):
            purge_at = _parse_iso((u.get("subscription") or {}).get("purge_at"))
            if purge_at and purge_at <= now:
                candidates.append({
                    "user_id": u["id"],
                    "phone": u.get("phone"),
                    "email": u.get("email"),
                    "purge_at": (u.get("subscription") or {}).get("purge_at"),
                })
        if dry_run:
            return {
                "ok": True,
                "dry_run": True,
                "would_purge": len(candidates),
                "candidates": candidates[:50],
                "note": "Chiama con ?dry_run=false per eliminare davvero.",
            }
        purged = 0
        errors = 0
        for c in candidates:
            try:
                await _purge_user_progress(db, c["user_id"])
                purged += 1
            except Exception as e:
                logger.warning(f"Purge failed for {c['user_id']}: {e}")
                errors += 1
        return {"ok": True, "dry_run": False, "purged": purged, "errors": errors}

    return api
