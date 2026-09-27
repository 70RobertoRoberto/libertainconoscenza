"""
Support / Help ticket system.

Endpoints (mounted on the shared /api prefix):
- POST   /support/tickets                 → user creates a ticket
- GET    /me/support/tickets              → user lists own tickets
- GET    /me/support/tickets/{id}         → user reads own ticket
- POST   /me/support/tickets/{id}/reply   → user replies on own ticket
- GET    /admin/support/tickets           → admin lists all tickets (filter by status)
- GET    /admin/support/tickets/{id}      → admin reads a ticket
- POST   /admin/support/tickets/{id}/reply → admin replies + optional status update
- POST   /admin/support/tickets/{id}/close → admin closes a ticket

Ticket model:
{
  id: uuid,
  ticket_no: "ASST-XXXX",  # 5-digit incremental for humans
  user_id, user_phone, user_name,
  subject, category, status: "open" | "waiting_user" | "resolved" | "closed",
  messages: [ {author: "user"|"admin", text, at} ],
  created_at, updated_at,
}
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TicketCreateIn(BaseModel):
    subject: str = Field(min_length=3, max_length=140)
    message: str = Field(min_length=5, max_length=5000)
    category: str = Field(default="generico")  # generico | tecnico | account | fatturazione | contenuto


class TicketReplyIn(BaseModel):
    message: str = Field(min_length=1, max_length=5000)
    new_status: Optional[str] = None  # admin can set


VALID_CATEGORIES = {"generico", "tecnico", "account", "fatturazione", "contenuto"}
VALID_STATUSES = {"open", "waiting_user", "resolved", "closed"}


def build_support_router(db, current_user, require_admin) -> APIRouter:
    router = APIRouter(prefix="/api")

    async def _next_ticket_no() -> str:
        # Simple counter using support_counters collection
        r = await db.support_counters.find_one_and_update(
            {"_id": "tickets"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True,
        )
        seq = (r or {}).get("seq", 1)
        return f"ASST-{seq:05d}"

    @router.post("/support/tickets", dependencies=[Depends(current_user)])
    async def create_ticket(inp: TicketCreateIn, user: dict = Depends(current_user)):
        cat = inp.category.strip().lower()
        if cat not in VALID_CATEGORIES:
            cat = "generico"
        ticket_no = await _next_ticket_no()
        doc = {
            "id": str(uuid.uuid4()),
            "ticket_no": ticket_no,
            "user_id": user["id"],
            "user_phone": user.get("phone"),
            "user_name": user.get("name"),
            "subject": inp.subject.strip(),
            "category": cat,
            "status": "open",
            "messages": [{
                "author": "user",
                "text": inp.message.strip(),
                "at": _now(),
            }],
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.support_tickets.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @router.get("/me/support/tickets", dependencies=[Depends(current_user)])
    async def list_my_tickets(user: dict = Depends(current_user)):
        cur = db.support_tickets.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(200)
        items = await cur.to_list(200)
        return {"items": items}

    @router.get("/me/support/tickets/{ticket_id}", dependencies=[Depends(current_user)])
    async def get_my_ticket(ticket_id: str, user: dict = Depends(current_user)):
        t = await db.support_tickets.find_one({"id": ticket_id, "user_id": user["id"]}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Ticket non trovato")
        return t

    @router.post("/me/support/tickets/{ticket_id}/reply", dependencies=[Depends(current_user)])
    async def reply_ticket(ticket_id: str, inp: TicketReplyIn, user: dict = Depends(current_user)):
        t = await db.support_tickets.find_one({"id": ticket_id, "user_id": user["id"]})
        if not t:
            raise HTTPException(404, "Ticket non trovato")
        if t.get("status") == "closed":
            raise HTTPException(400, "Ticket chiuso, apri una nuova richiesta")
        msg = {"author": "user", "text": inp.message.strip(), "at": _now()}
        await db.support_tickets.update_one(
            {"id": ticket_id},
            {"$push": {"messages": msg}, "$set": {"status": "open", "updated_at": _now()}},
        )
        return {"ok": True}

    @router.get("/admin/support/tickets", dependencies=[Depends(require_admin)])
    async def admin_list_tickets(status: Optional[str] = None):
        q: dict = {}
        if status and status in VALID_STATUSES:
            q["status"] = status
        cur = db.support_tickets.find(q, {"_id": 0}).sort("updated_at", -1).limit(500)
        items = await cur.to_list(500)
        return {"items": items}

    @router.get("/admin/support/tickets/{ticket_id}", dependencies=[Depends(require_admin)])
    async def admin_get_ticket(ticket_id: str):
        t = await db.support_tickets.find_one({"id": ticket_id}, {"_id": 0})
        if not t:
            raise HTTPException(404, "Ticket non trovato")
        return t

    @router.post("/admin/support/tickets/{ticket_id}/reply", dependencies=[Depends(require_admin)])
    async def admin_reply_ticket(ticket_id: str, inp: TicketReplyIn):
        t = await db.support_tickets.find_one({"id": ticket_id})
        if not t:
            raise HTTPException(404, "Ticket non trovato")
        msg = {"author": "admin", "text": inp.message.strip(), "at": _now()}
        new_status = inp.new_status if inp.new_status in VALID_STATUSES else "waiting_user"
        await db.support_tickets.update_one(
            {"id": ticket_id},
            {"$push": {"messages": msg}, "$set": {"status": new_status, "updated_at": _now()}},
        )
        return {"ok": True}

    @router.post("/admin/support/tickets/{ticket_id}/close", dependencies=[Depends(require_admin)])
    async def admin_close_ticket(ticket_id: str):
        r = await db.support_tickets.update_one(
            {"id": ticket_id},
            {"$set": {"status": "closed", "updated_at": _now()}},
        )
        if r.matched_count == 0:
            raise HTTPException(404, "Ticket non trovato")
        return {"ok": True}

    @router.get("/admin/support/stats", dependencies=[Depends(require_admin)])
    async def admin_stats():
        open_c = await db.support_tickets.count_documents({"status": "open"})
        waiting = await db.support_tickets.count_documents({"status": "waiting_user"})
        resolved = await db.support_tickets.count_documents({"status": "resolved"})
        closed = await db.support_tickets.count_documents({"status": "closed"})
        return {"open": open_c, "waiting_user": waiting, "resolved": resolved, "closed": closed}

    return router
