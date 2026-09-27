"""
Corsi module for Libertà in Conoscenza — factory-based router.

Handles:
- Course areas (aree tematiche) CRUD
- Courses CRUD (draft/active, Base/Premium, cover, description, price, promo)
- Course topics (argomenti) CRUD with WYSIWYG HTML content
- Course quiz CRUD (4-answer questions, 70% threshold, 3 attempts)
- User endpoints: list areas / list courses

`build_courses_router(db, current_user, require_admin)` returns an APIRouter
ready to be included in the main FastAPI app.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _slugify(text: str) -> str:
    s = text.lower().strip()
    for src, dst in (("àáâã", "a"), ("èéê", "e"), ("ìí", "i"), ("òóô", "o"), ("ùú", "u")):
        s = re.sub(f"[{src}]", dst, s)
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class CourseAreaIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    order: int = 0


class QuizAnswer(BaseModel):
    text: str
    is_correct: bool = False


class QuizQuestion(BaseModel):
    id: str
    text: str
    answers: List[QuizAnswer]
    explanation: str = ""


class QuizIn(BaseModel):
    questions: List[QuizQuestion] = []
    pass_threshold: float = 0.70
    max_attempts: int = 3


class CoursePromo(BaseModel):
    active: bool = False
    price_promo: Optional[float] = None
    starts_at: Optional[str] = None
    ends_at: Optional[str] = None
    duration_days: Optional[int] = None


class CourseIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    cover_url: str
    description_html: str = Field(default="", max_length=10_000_000)
    kind: str = "base"  # base | premium
    price: float = 0.0
    area_id: Optional[str] = None
    is_active: bool = False


class CoursePatch(BaseModel):
    title: Optional[str] = None
    cover_url: Optional[str] = None
    description_html: Optional[str] = Field(default=None, max_length=10_000_000)
    kind: Optional[str] = None
    price: Optional[float] = None
    area_id: Optional[str] = None
    is_active: Optional[bool] = None
    promo: Optional[CoursePromo] = None


class CourseTopicIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    kind: str = Field(default="modulo", max_length=32)
    content_html: str = Field(default="", max_length=5_000_000)
    order: int = 0
    linked_meditation_id: Optional[str] = None
    external_article_url: Optional[str] = None


class ReorderIn(BaseModel):
    topic_ids: List[str]


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------
def _area_out(d: dict) -> dict:
    return {
        "id": d["id"], "name": d["name"], "slug": d["slug"],
        "order": d.get("order", 0), "created_at": d.get("created_at"),
    }


def _course_out(d: dict, area_name: Optional[str], topic_count: int, has_quiz: bool) -> dict:
    return {
        "id": d["id"],
        "title": d.get("title", ""),
        "cover_url": d.get("cover_url", ""),
        "description_html": d.get("description_html", ""),
        "kind": d.get("kind", "base"),
        "price": float(d.get("price", 0)),
        "area_id": d.get("area_id"),
        "area_name": area_name,
        "is_active": bool(d.get("is_active", False)),
        "promo": d.get("promo") or {"active": False},
        "topic_count": topic_count,
        "has_quiz": has_quiz,
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


def _topic_out(d: dict) -> dict:
    return {
        "id": d["id"],
        "course_id": d["course_id"],
        "title": d.get("title", ""),
        "kind": d.get("kind", "modulo"),
        "content_html": d.get("content_html", ""),
        "order": d.get("order", 0),
        "linked_meditation_id": d.get("linked_meditation_id"),
        "external_article_url": d.get("external_article_url"),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


def _quiz_out(d: dict) -> dict:
    return {
        "id": d.get("id"),
        "course_id": d["course_id"],
        "questions": d.get("questions", []),
        "pass_threshold": float(d.get("pass_threshold", 0.7)),
        "max_attempts": int(d.get("max_attempts", 3)),
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------
def build_courses_router(db, current_user, require_admin) -> APIRouter:
    router = APIRouter(prefix="/api")

    # ---------- Admin: AREE ----------
    @router.get("/admin/course-areas", dependencies=[Depends(require_admin)])
    async def list_areas():
        docs = await db.course_areas.find({}).sort([("order", 1), ("name", 1)]).to_list(500)
        return {"items": [_area_out(d) for d in docs]}

    @router.post("/admin/course-areas", dependencies=[Depends(require_admin)])
    async def create_area(inp: CourseAreaIn):
        name = inp.name.strip()
        slug = _slugify(name)
        if not slug:
            raise HTTPException(400, "Nome non valido")
        if await db.course_areas.find_one({"slug": slug}):
            raise HTTPException(409, "Area già esistente")
        doc = {
            "id": str(uuid.uuid4()), "name": name, "slug": slug,
            "order": inp.order, "created_at": _now(),
        }
        await db.course_areas.insert_one(doc)
        return _area_out(doc)

    @router.patch("/admin/course-areas/{area_id}", dependencies=[Depends(require_admin)])
    async def update_area(area_id: str, inp: CourseAreaIn):
        name = inp.name.strip()
        slug = _slugify(name)
        if not slug:
            raise HTTPException(400, "Nome non valido")
        dup = await db.course_areas.find_one({"slug": slug, "id": {"$ne": area_id}})
        if dup:
            raise HTTPException(409, "Un'altra area ha lo stesso nome")
        r = await db.course_areas.update_one(
            {"id": area_id}, {"$set": {"name": name, "slug": slug, "order": inp.order}}
        )
        if r.matched_count == 0:
            raise HTTPException(404, "Area non trovata")
        updated = await db.course_areas.find_one({"id": area_id})
        return _area_out(updated)

    @router.delete("/admin/course-areas/{area_id}", dependencies=[Depends(require_admin)])
    async def delete_area(area_id: str):
        await db.courses.update_many({"area_id": area_id}, {"$set": {"area_id": None}})
        r = await db.course_areas.delete_one({"id": area_id})
        if r.deleted_count == 0:
            raise HTTPException(404, "Area non trovata")
        return {"ok": True}

    # ---------- Admin: CORSI ----------
    @router.get("/admin/courses", dependencies=[Depends(require_admin)])
    async def list_courses(
        status: str = Query("all"),
        area_id: Optional[str] = None,
        kind: Optional[str] = None,
        q: Optional[str] = None,
    ):
        query: dict = {}
        if status == "draft":
            query["is_active"] = False
        elif status == "active":
            query["is_active"] = True
        if area_id:
            query["area_id"] = area_id
        if kind in ("base", "premium"):
            query["kind"] = kind
        if q:
            query["title"] = {"$regex": q, "$options": "i"}
        docs = await db.courses.find(query).sort("created_at", -1).to_list(500)
        area_map = {a["id"]: a["name"] async for a in db.course_areas.find({})}
        out = []
        for d in docs:
            tc = await db.course_topics.count_documents({"course_id": d["id"]})
            qz = await db.course_quizzes.find_one({"course_id": d["id"]})
            out.append(_course_out(d, area_map.get(d.get("area_id")), tc, bool(qz)))
        return {"items": out}

    @router.post("/admin/courses", dependencies=[Depends(require_admin)])
    async def create_course(inp: CourseIn):
        kind = "premium" if inp.kind == "premium" else "base"
        price = float(inp.price or 0)
        if kind == "premium" and price <= 0:
            raise HTTPException(400, "I corsi Premium devono avere un prezzo > 0")
        doc = {
            "id": str(uuid.uuid4()),
            "title": inp.title.strip(),
            "cover_url": inp.cover_url,
            "description_html": inp.description_html or "",
            "kind": kind,
            "price": price if kind == "premium" else 0.0,
            "area_id": inp.area_id,
            "is_active": bool(inp.is_active),
            "promo": {"active": False, "price_promo": None, "starts_at": None, "ends_at": None, "duration_days": None},
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.courses.insert_one(doc)
        area_name = None
        if doc["area_id"]:
            a = await db.course_areas.find_one({"id": doc["area_id"]})
            area_name = a["name"] if a else None
        return _course_out(doc, area_name, 0, False)

    @router.get("/admin/courses/{course_id}", dependencies=[Depends(require_admin)])
    async def get_course(course_id: str):
        doc = await db.courses.find_one({"id": course_id})
        if not doc:
            raise HTTPException(404, "Corso non trovato")
        tc = await db.course_topics.count_documents({"course_id": course_id})
        qz = await db.course_quizzes.find_one({"course_id": course_id})
        area_name = None
        if doc.get("area_id"):
            a = await db.course_areas.find_one({"id": doc["area_id"]})
            area_name = a["name"] if a else None
        return _course_out(doc, area_name, tc, bool(qz))

    @router.patch("/admin/courses/{course_id}", dependencies=[Depends(require_admin)])
    async def update_course(course_id: str, inp: CoursePatch):
        doc = await db.courses.find_one({"id": course_id})
        if not doc:
            raise HTTPException(404, "Corso non trovato")
        update: dict = {"updated_at": _now()}
        if inp.title is not None:
            update["title"] = inp.title.strip()
        if inp.cover_url is not None:
            update["cover_url"] = inp.cover_url
        if inp.description_html is not None:
            update["description_html"] = inp.description_html
        if inp.kind is not None:
            update["kind"] = "premium" if inp.kind == "premium" else "base"
        if inp.price is not None:
            update["price"] = float(inp.price)
        if inp.area_id is not None:
            update["area_id"] = inp.area_id or None
        if inp.is_active is not None:
            update["is_active"] = bool(inp.is_active)
        if inp.promo is not None:
            promo = inp.promo.model_dump()
            if promo.get("active") and promo.get("duration_days"):
                promo["starts_at"] = _now()
                promo["ends_at"] = (
                    datetime.now(timezone.utc) + timedelta(days=int(promo["duration_days"]))
                ).isoformat()
            update["promo"] = promo

        resolved_kind = update.get("kind", doc.get("kind", "base"))
        resolved_price = update.get("price", doc.get("price", 0))
        if resolved_kind == "premium" and (resolved_price or 0) <= 0:
            raise HTTPException(400, "I corsi Premium devono avere un prezzo > 0")

        await db.courses.update_one({"id": course_id}, {"$set": update})
        doc = await db.courses.find_one({"id": course_id})
        tc = await db.course_topics.count_documents({"course_id": course_id})
        qz = await db.course_quizzes.find_one({"course_id": course_id})
        area_name = None
        if doc.get("area_id"):
            a = await db.course_areas.find_one({"id": doc["area_id"]})
            area_name = a["name"] if a else None
        return _course_out(doc, area_name, tc, bool(qz))

    @router.delete("/admin/courses/{course_id}", dependencies=[Depends(require_admin)])
    async def delete_course(course_id: str):
        r = await db.courses.delete_one({"id": course_id})
        if r.deleted_count == 0:
            raise HTTPException(404, "Corso non trovato")
        await db.course_topics.delete_many({"course_id": course_id})
        await db.course_quizzes.delete_many({"course_id": course_id})
        return {"ok": True}

    # ---------- Admin: ARGOMENTI ----------
    @router.get("/admin/courses/{course_id}/topics", dependencies=[Depends(require_admin)])
    async def list_topics(course_id: str):
        docs = await db.course_topics.find({"course_id": course_id}).sort("order", 1).to_list(500)
        return {"items": [_topic_out(d) for d in docs]}

    @router.post("/admin/courses/{course_id}/topics", dependencies=[Depends(require_admin)])
    async def create_topic(course_id: str, inp: CourseTopicIn):
        if not await db.courses.find_one({"id": course_id}):
            raise HTTPException(404, "Corso non trovato")
        last = await db.course_topics.find({"course_id": course_id}).sort("order", -1).limit(1).to_list(1)
        next_order = (last[0]["order"] + 1) if last else 1
        doc = {
            "id": str(uuid.uuid4()),
            "course_id": course_id,
            "title": inp.title.strip(),
            "kind": inp.kind,
            "content_html": inp.content_html or "",
            "order": inp.order or next_order,
            "linked_meditation_id": inp.linked_meditation_id,
            "external_article_url": inp.external_article_url,
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.course_topics.insert_one(doc)
        await db.courses.update_one({"id": course_id}, {"$set": {"updated_at": _now()}})
        return _topic_out(doc)

    @router.get("/admin/topics/{topic_id}", dependencies=[Depends(require_admin)])
    async def get_topic(topic_id: str):
        doc = await db.course_topics.find_one({"id": topic_id})
        if not doc:
            raise HTTPException(404, "Argomento non trovato")
        return _topic_out(doc)

    @router.patch("/admin/topics/{topic_id}", dependencies=[Depends(require_admin)])
    async def update_topic(topic_id: str, inp: CourseTopicIn):
        update = {
            "title": inp.title.strip(),
            "kind": inp.kind,
            "content_html": inp.content_html or "",
            "order": inp.order,
            "linked_meditation_id": inp.linked_meditation_id,
            "external_article_url": inp.external_article_url,
            "updated_at": _now(),
        }
        r = await db.course_topics.update_one({"id": topic_id}, {"$set": update})
        if r.matched_count == 0:
            raise HTTPException(404, "Argomento non trovato")
        doc = await db.course_topics.find_one({"id": topic_id})
        await db.courses.update_one({"id": doc["course_id"]}, {"$set": {"updated_at": _now()}})
        return _topic_out(doc)

    @router.delete("/admin/topics/{topic_id}", dependencies=[Depends(require_admin)])
    async def delete_topic(topic_id: str):
        doc = await db.course_topics.find_one({"id": topic_id})
        if not doc:
            raise HTTPException(404, "Argomento non trovato")
        await db.course_topics.delete_one({"id": topic_id})
        await db.courses.update_one({"id": doc["course_id"]}, {"$set": {"updated_at": _now()}})
        return {"ok": True}

    @router.post("/admin/courses/{course_id}/topics/reorder", dependencies=[Depends(require_admin)])
    async def reorder_topics(course_id: str, inp: ReorderIn):
        for idx, tid in enumerate(inp.topic_ids, 1):
            await db.course_topics.update_one(
                {"id": tid, "course_id": course_id},
                {"$set": {"order": idx, "updated_at": _now()}},
            )
        return {"ok": True}

    # ---------- Admin: QUIZ ----------
    @router.get("/admin/courses/{course_id}/quiz", dependencies=[Depends(require_admin)])
    async def get_quiz(course_id: str):
        doc = await db.course_quizzes.find_one({"course_id": course_id})
        if not doc:
            return {"quiz": None}
        return {"quiz": _quiz_out(doc)}

    @router.put("/admin/courses/{course_id}/quiz", dependencies=[Depends(require_admin)])
    async def upsert_quiz(course_id: str, inp: QuizIn):
        if not await db.courses.find_one({"id": course_id}):
            raise HTTPException(404, "Corso non trovato")
        for i, q in enumerate(inp.questions, 1):
            if len(q.answers) < 2:
                raise HTTPException(400, f"Domanda {i}: servono almeno 2 risposte")
            correct = sum(1 for a in q.answers if a.is_correct)
            if correct != 1:
                raise HTTPException(400, f"Domanda {i}: deve esserci esattamente 1 risposta corretta")
        payload = {
            "questions": [q.model_dump() for q in inp.questions],
            "pass_threshold": float(inp.pass_threshold or 0.7),
            "max_attempts": int(inp.max_attempts or 3),
            "updated_at": _now(),
        }
        existing = await db.course_quizzes.find_one({"course_id": course_id})
        if existing:
            await db.course_quizzes.update_one({"course_id": course_id}, {"$set": payload})
            doc = await db.course_quizzes.find_one({"course_id": course_id})
        else:
            doc = {"id": str(uuid.uuid4()), "course_id": course_id, "created_at": _now(), **payload}
            await db.course_quizzes.insert_one(doc)
        await db.courses.update_one({"id": course_id}, {"$set": {"updated_at": _now()}})
        return _quiz_out(doc)

    @router.delete("/admin/courses/{course_id}/quiz", dependencies=[Depends(require_admin)])
    async def delete_quiz(course_id: str):
        r = await db.course_quizzes.delete_one({"course_id": course_id})
        if r.deleted_count == 0:
            raise HTTPException(404, "Quiz non trovato")
        await db.courses.update_one({"id": course_id}, {"$set": {"updated_at": _now()}})
        return {"ok": True}

    # ---------- User endpoints ----------
    @router.get("/course-areas", dependencies=[Depends(current_user)])
    async def user_list_areas():
        docs = await db.course_areas.find({}).sort([("order", 1), ("name", 1)]).to_list(200)
        return {"items": [_area_out(d) for d in docs]}

    @router.get("/courses", dependencies=[Depends(current_user)])
    async def user_list_courses(area_id: Optional[str] = None, only_active: bool = True):
        query: dict = {}
        if only_active:
            query["is_active"] = True
        if area_id:
            query["area_id"] = area_id
        docs = await db.courses.find(query).sort("created_at", -1).to_list(500)
        area_map = {a["id"]: a["name"] async for a in db.course_areas.find({})}
        out = []
        for d in docs:
            tc = await db.course_topics.count_documents({"course_id": d["id"]})
            qz = await db.course_quizzes.find_one({"course_id": d["id"]})
            out.append(_course_out(d, area_map.get(d.get("area_id")), tc, bool(qz)))
        # Promoted first, then by created_at desc (already sorted).
        out.sort(key=lambda c: (0 if c.get("promo", {}).get("active") else 1))
        return {"items": out}

    return router
