"""Articles routes: list/detail + admin CRUD + summarize."""
from __future__ import annotations

import re
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from deps import now_iso, EMERGENT_LLM_KEY
from models import ArticleIn, ArticlePatch, SummarizeIn
from constants import CATEGORIES
from serializers import serialize_article
from push import send_push_bg, all_user_ids

logger = logging.getLogger("conoscenza")


def build_articles_router(db, current_user, require_admin) -> APIRouter:
    api = APIRouter(prefix="/api")

    @api.get("/articles")
    async def list_articles(
        category: Optional[str] = None,
        limit: int = 50,
        lang: Optional[str] = None,
        user: dict = Depends(current_user),
    ):
        q = {}
        if category:
            q["category"] = category
        cursor = db.articles.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
        items = [serialize_article(a, lang) async for a in cursor]
        return {"items": items}

    @api.get("/articles/counts")
    async def articles_counts(user: dict = Depends(current_user)):
        pipeline = [
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        ]
        counts = {}
        async for row in db.articles.aggregate(pipeline):
            counts[row["_id"] or ""] = row.get("count", 0)
        total = await db.articles.count_documents({})
        return {"counts": counts, "total": total}

    @api.get("/articles/{article_id}")
    async def get_article(article_id: str, lang: Optional[str] = None, user: dict = Depends(current_user)):
        a = await db.articles.find_one({"id": article_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Non trovato")
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
        return serialize_article(a, lang)

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
        try:
            recipients = await all_user_ids()
            await send_push_bg(recipients, "Nuovo articolo", inp.title, action_url=f"/article/{doc['id']}")
        except Exception as e:
            logger.warning(f"Push failed: {e}")
        return serialize_article(doc)

    @api.delete("/admin/articles/{article_id}", dependencies=[Depends(require_admin)])
    async def delete_article(article_id: str):
        r = await db.articles.delete_one({"id": article_id})
        return {"deleted": r.deleted_count}

    @api.put("/admin/articles/{article_id}", dependencies=[Depends(require_admin)])
    async def update_article(article_id: str, inp: ArticlePatch):
        existing = await db.articles.find_one({"id": article_id}, {"_id": 0})
        if not existing:
            raise HTTPException(404, "Articolo non trovato")
        updates = {k: v for k, v in inp.dict().items() if v is not None}
        if not updates:
            return serialize_article(existing)
        if "category" in updates and updates["category"] not in CATEGORIES:
            raise HTTPException(400, "Categoria non valida")
        updates["updated_at"] = now_iso()
        await db.articles.update_one({"id": article_id}, {"$set": updates})
        doc = await db.articles.find_one({"id": article_id}, {"_id": 0})
        return serialize_article(doc)

    @api.post("/admin/articles/summarize", dependencies=[Depends(require_admin)])
    async def summarize_and_create(inp: SummarizeIn):
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
                    "L'articolo finale deve essere lungo fino a 80 righe (circa 700-900 parole), ben strutturato in paragrafi separati da doppio a-capo. "
                    "Rispondi in JSON con esattamente questi campi: {\"title\": \"...\", \"summary\": \"...\"}. Nessun altro testo."
                ),
            ).with_model("openai", "gpt-4o-mini")

            response = await chat.send_message(UserMessage(text=text))
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
            return serialize_article(doc)
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Summarize failed")
            raise HTTPException(500, f"Errore riassunto: {e}")

    return api
