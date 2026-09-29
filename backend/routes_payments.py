"""Payments & billing routes: coupons, legacy /billing/checkout, Stripe
integration (config, subscription/course checkout, session status, webhook)
and admin orders listing."""
from __future__ import annotations

import re
import uuid
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from deps import now_iso
from models import CheckoutIn, CouponIn, StripeCourseCheckoutIn
from constants import PLANS

logger = logging.getLogger("conoscenza")


def build_payments_router(db, current_user, require_admin) -> APIRouter:
    api = APIRouter(prefix="/api")

    async def _stripe_fulfill_metadata(md: dict) -> None:
        kind = md.get("kind")
        user_id = md.get("user_id")
        if not user_id:
            return

        if kind == "subscription":
            order_id = md.get("order_id")
            if not order_id:
                return
            order = await db.orders.find_one({"id": order_id})
            if not order or order.get("status") == "active":
                return
            expires = datetime.now(timezone.utc) + timedelta(days=order.get("days") or 365)
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"subscription": {
                    "status": "premium",
                    "plan": order.get("plan", "12m"),
                    "expires_at": expires.isoformat(),
                    "auto_renew": True,
                    "activated_at": now_iso(),
                }}},
            )
            await db.orders.update_one(
                {"id": order_id},
                {"$set": {"status": "active", "paid_at": now_iso()}},
            )
            try:
                from emailer import send_email, render_order_receipt
                u = await db.users.find_one({"id": user_id}, {"_id": 0, "name": 1, "email": 1})
                recipient = order.get("email") or (u or {}).get("email")
                if recipient:
                    plan_label = (PLANS.get(order.get("plan", "")) or {}).get("label", order.get("plan", ""))
                    subj, html = render_order_receipt(
                        (u or {}).get("name") or "",
                        plan_label,
                        int(order.get("amount_eur", 0)),
                        order.get("order_no") or order.get("id", "")[:8],
                        expires.isoformat(),
                    )
                    await send_email(to=recipient, subject=subj, html=html)
            except Exception as e:
                logger.warning(f"[STRIPE] receipt email failed: {e}")

        elif kind == "course":
            course_order_id = md.get("course_order_id")
            course_id = md.get("course_id")
            if not course_order_id or not course_id:
                return
            co = await db.course_orders.find_one({"id": course_order_id})
            if not co or co.get("status") == "active":
                return
            await db.course_orders.update_one(
                {"id": course_order_id},
                {"$set": {"status": "active", "paid_at": now_iso()}},
            )
            existing = await db.course_enrollments.find_one({"course_id": course_id, "user_id": user_id})
            if not existing:
                await db.course_enrollments.insert_one({
                    "id": str(uuid.uuid4()),
                    "course_id": course_id,
                    "user_id": user_id,
                    "started_at": now_iso(),
                    "quiz_passed": False,
                    "quiz_attempts": 0,
                    "certificate_id": None,
                    "purchased": True,
                })

    # ---- Coupons -------------------------------------------------------
    @api.post("/admin/coupons", dependencies=[Depends(require_admin)])
    async def create_coupon(inp: CouponIn):
        code = inp.code.strip().upper()
        if not re.fullmatch(r"[A-Z0-9_-]{3,32}", code):
            raise HTTPException(400, "Codice non valido")
        if await db.coupons.find_one({"code": code}):
            raise HTTPException(409, "Codice già esistente")
        scope = inp.scope if inp.scope in ("any", "plan", "course") else "any"
        course_id = inp.course_id if scope == "course" else None
        if scope == "course" and not course_id:
            raise HTTPException(400, "course_id richiesto per coupon con scope 'course'")
        doc = {
            "id": str(uuid.uuid4()),
            "code": code,
            "percent_off": inp.percent_off,
            "max_uses": inp.max_uses,
            "used_count": 0,
            "expires_at": inp.expires_at,
            "scope": scope,
            "course_id": course_id,
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
        course_id = payload.get("course_id")
        plan = payload.get("plan")
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
        scope = c.get("scope", "any")
        if scope == "course":
            if not course_id:
                raise HTTPException(400, "Questo codice è valido solo su un corso specifico")
            if c.get("course_id") and c.get("course_id") != course_id:
                raise HTTPException(400, "Codice non valido per questo corso")
        elif scope == "plan":
            if not plan:
                raise HTTPException(400, "Questo codice è valido solo per l'abbonamento")
        return {"code": c["code"], "percent_off": c["percent_off"], "scope": scope}

    # ---- Legacy /billing/checkout (creates a pending order) -----------
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
            if c.get("scope") == "course":
                raise HTTPException(400, "Questo codice è valido solo su un corso, non sull'abbonamento")
            amount = round(amount * (100 - c["percent_off"]) / 100)
            applied_code = code
            await db.coupons.update_one({"code": code}, {"$inc": {"used_count": 1}})
        provided_email = None
        if inp.email:
            e = inp.email.strip().lower()
            if "@" in e and "." in e.split("@")[-1]:
                existing = await db.users.find_one({"email": e, "id": {"$ne": user["id"]}})
                if not existing:
                    provided_email = e
                    await db.users.update_one({"id": user["id"]}, {"$set": {"email": e}})
        order_no = f"ORD-{int(datetime.now(timezone.utc).timestamp())}"
        order = {
            "id": str(uuid.uuid4()),
            "order_no": order_no,
            "user_id": user["id"],
            "email": provided_email or user.get("email"),
            "plan": inp.plan,
            "amount_eur": amount,
            "original_eur": plan["price_eur"],
            "coupon_code": applied_code,
            "months": plan.get("months", 0),
            "days": plan.get("days", plan.get("months", 0) * 30),
            "status": "pending",
            "created_at": now_iso(),
        }
        await db.orders.insert_one(order)
        return {
            "order_id": order["id"],
            "order_no": order_no,
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
        expires = datetime.now(timezone.utc) + timedelta(days=order.get("days") or 30 * order.get("months", 0))
        await db.users.update_one(
            {"id": order["user_id"]},
            {"$set": {"subscription": {
                "status": "premium",
                "plan": order["plan"],
                "expires_at": expires.isoformat(),
                "auto_renew": True,
                "activated_at": now_iso(),
            }}},
        )
        await db.orders.update_one({"id": order_id}, {"$set": {"status": "active"}})
        try:
            from emailer import send_email, render_order_receipt
            u = await db.users.find_one({"id": order["user_id"]}, {"_id": 0, "name": 1, "email": 1})
            recipient = order.get("email") or (u or {}).get("email")
            if recipient:
                plan_label = (PLANS.get(order.get("plan", "")) or {}).get("label", order.get("plan", ""))
                subj, html = render_order_receipt(
                    (u or {}).get("name") or "",
                    plan_label,
                    int(order.get("amount_eur", 0)),
                    order.get("order_no") or order.get("id", "")[:8],
                    expires.isoformat(),
                )
                await send_email(to=recipient, subject=subj, html=html)
        except Exception as e:
            logger.warning(f"Order receipt email failed: {e}")
        return {"ok": True}

    @api.get("/admin/orders", dependencies=[Depends(require_admin)])
    async def list_orders():
        cursor = db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(200)
        items = []
        async for o in cursor:
            u = await db.users.find_one({"id": o["user_id"]}, {"_id": 0, "phone": 1, "name": 1})
            items.append({**o, "user_phone": (u or {}).get("phone", ""), "user_name": (u or {}).get("name", "")})
        return {"items": items}

    # ---- Stripe --------------------------------------------------------
    @api.get("/payments/stripe/config")
    async def stripe_public_config():
        from stripe_service import is_configured, public_key
        return {"enabled": is_configured(), "publishable_key": public_key()}

    @api.post("/payments/stripe/checkout/subscription", dependencies=[Depends(current_user)])
    async def stripe_checkout_subscription(order_id: str, user: dict = Depends(current_user)):
        from stripe_service import create_subscription_checkout, is_configured
        if not is_configured():
            raise HTTPException(503, "Pagamenti temporaneamente non disponibili")
        order = await db.orders.find_one({"id": order_id, "user_id": user["id"]})
        if not order:
            raise HTTPException(404, "Ordine non trovato")
        if order.get("status") == "active":
            raise HTTPException(400, "Ordine già attivato")
        try:
            res = await create_subscription_checkout(
                user, order_id=order["id"], amount_eur=float(order.get("amount_eur", 12)),
            )
        except Exception as e:
            logger.error(f"[STRIPE] subscription checkout failed: {e}")
            raise HTTPException(500, f"Errore Stripe: {e}")
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {"stripe_session_id": res["session_id"], "payment_provider": "stripe"}},
        )
        return res

    @api.post("/payments/stripe/checkout/course", dependencies=[Depends(current_user)])
    async def stripe_checkout_course(inp: StripeCourseCheckoutIn, user: dict = Depends(current_user)):
        from stripe_service import create_course_checkout, is_configured
        if not is_configured():
            raise HTTPException(503, "Pagamenti temporaneamente non disponibili")
        course = await db.courses.find_one({"id": inp.course_id, "is_active": True})
        if not course:
            raise HTTPException(404, "Corso non disponibile")
        if course.get("kind") != "premium":
            raise HTTPException(400, "Questo corso non è a pagamento")

        base_price = float(course.get("price_eur") or course.get("price") or 0)
        if base_price <= 0:
            raise HTTPException(400, "Prezzo del corso non impostato dall'amministratore")

        amount_eur = base_price
        applied_code: Optional[str] = None
        if inp.coupon_code:
            code = inp.coupon_code.strip().upper()
            c = await db.coupons.find_one({"code": code, "active": True})
            if not c:
                raise HTTPException(404, "Codice sconto non valido")
            if c.get("used_count", 0) >= c.get("max_uses", 10**9):
                raise HTTPException(410, "Codice sconto esaurito")
            scope = c.get("scope") or "all"
            if scope == "course" and c.get("course_id") not in (None, "", inp.course_id):
                raise HTTPException(400, "Questo codice non è valido per questo corso")
            amount_eur = max(1.0, round(base_price * (100 - c["percent_off"]) / 100, 2))
            applied_code = code

        if inp.email:
            e = inp.email.strip().lower()
            if "@" in e and "." in e.split("@")[-1]:
                existing = await db.users.find_one({"email": e, "id": {"$ne": user["id"]}})
                if not existing:
                    await db.users.update_one({"id": user["id"]}, {"$set": {"email": e}})
                    user["email"] = e

        order_no = f"CRS-{int(datetime.now(timezone.utc).timestamp())}"
        course_order_id = str(uuid.uuid4())
        await db.course_orders.insert_one({
            "id": course_order_id,
            "order_no": order_no,
            "user_id": user["id"],
            "course_id": inp.course_id,
            "course_title": course.get("title", ""),
            "amount_eur": amount_eur,
            "original_eur": base_price,
            "coupon_code": applied_code,
            "status": "pending",
            "payment_provider": "stripe",
            "created_at": now_iso(),
        })
        try:
            res = await create_course_checkout(user, course, amount_eur, course_order_id)
        except Exception as e:
            logger.error(f"[STRIPE] course checkout failed: {e}")
            await db.course_orders.update_one({"id": course_order_id}, {"$set": {"status": "failed", "error": str(e)}})
            raise HTTPException(500, f"Errore Stripe: {e}")
        if applied_code:
            await db.coupons.update_one({"code": applied_code}, {"$inc": {"used_count": 1}})
        await db.course_orders.update_one(
            {"id": course_order_id},
            {"$set": {"stripe_session_id": res["session_id"]}},
        )
        return {**res, "course_order_id": course_order_id, "amount_eur": amount_eur, "coupon_code": applied_code}

    @api.get("/payments/stripe/session/{session_id}", dependencies=[Depends(current_user)])
    async def stripe_session_status(session_id: str, user: dict = Depends(current_user)):
        from stripe_service import get_session_status, is_configured
        if not is_configured():
            raise HTTPException(503, "Pagamenti non configurati")
        try:
            status = await get_session_status(session_id)
        except Exception as e:
            raise HTTPException(404, f"Sessione non trovata: {e}")
        md = status.get("metadata") or {}
        if md.get("user_id") not in (user["id"], None):
            raise HTTPException(403, "Sessione non tua")
        paid = (status.get("payment_status") == "paid") or (status.get("status") == "complete")
        if paid:
            await _stripe_fulfill_metadata(md)
        return {
            "session_id": session_id,
            "status": status.get("status"),
            "payment_status": status.get("payment_status"),
            "paid": paid,
            "kind": md.get("kind"),
            "order_id": md.get("order_id"),
            "course_order_id": md.get("course_order_id"),
        }

    @api.post("/payments/stripe/webhook")
    async def stripe_webhook(request: Request):
        from stripe_service import handle_webhook
        raw = await request.body()
        sig = request.headers.get("stripe-signature")
        try:
            event = await handle_webhook(raw, sig)
        except Exception as e:
            logger.warning(f"[STRIPE] Invalid webhook: {e}")
            raise HTTPException(400, "Invalid signature")

        event_id = event.get("event_id")
        if event_id:
            try:
                inserted = await db.stripe_events.update_one(
                    {"id": event_id},
                    {"$setOnInsert": {"id": event_id, "type": event.get("event_type"), "received_at": now_iso()}},
                    upsert=True,
                )
                if not inserted.upserted_id:
                    return {"received": True, "duplicate": True}
            except Exception:
                pass

        if event.get("payment_status") == "paid":
            await _stripe_fulfill_metadata(event.get("metadata") or {})
        return {"received": True}

    return api
