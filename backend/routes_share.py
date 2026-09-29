"""Public preview + share HTML routes (Open Graph / SEO).

These are the endpoints that WhatsApp, Telegram, Facebook, LinkedIn and Google
scrape to build rich preview cards for shared links.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from serializers import (
    short_desc, absolute_url, brand_placeholder_cover, public_base_url, og_html,
)


def build_share_router(db, current_user, require_admin) -> APIRouter:
    api = APIRouter(prefix="/api")

    # ---- Public JSON previews (used by GatedLanding on unauthenticated pages)
    @api.get("/public/meditation/{item_id}")
    async def public_meditation_preview(item_id: str, lang: str = "it"):
        doc = await db.media.find_one({"id": item_id})
        if not doc:
            raise HTTPException(404, "Contenuto non trovato")
        return {
            "id": doc["id"],
            "type": "meditation",
            "title": doc.get("title") or doc.get("title_it") or "",
            "cover_url": doc.get("cover_url") or doc.get("thumbnail_url") or "",
            "category": doc.get("category") or doc.get("category_slug") or "",
            "duration_sec": int(doc.get("duration_sec") or doc.get("duration") or 0),
            "short_description": short_desc(
                doc.get("description") or doc.get("description_it") or doc.get("summary") or ""
            ),
            "is_premium": bool(doc.get("is_premium") or doc.get("premium")),
        }

    @api.get("/public/course/{item_id}")
    async def public_course_preview(item_id: str):
        doc = await db.courses.find_one({"id": item_id})
        if not doc:
            raise HTTPException(404, "Corso non trovato")
        topics_count = await db.course_topics.count_documents({"course_id": item_id})
        return {
            "id": doc["id"],
            "type": "course",
            "title": doc.get("title") or "",
            "cover_url": doc.get("cover_url") or "",
            "short_description": short_desc(doc.get("description_html") or doc.get("description") or ""),
            "kind": doc.get("kind") or "base",
            "is_premium": doc.get("kind") == "premium",
            "price_eur": int(doc.get("price_eur") or doc.get("price") or 0) if doc.get("kind") == "premium" else 0,
            "topics_count": topics_count,
            "author": doc.get("author") or doc.get("teacher") or "",
            "is_active": bool(doc.get("is_active")),
        }

    @api.get("/public/article/{item_id}")
    async def public_article_preview(item_id: str):
        doc = await db.articles.find_one({"id": item_id})
        if not doc:
            raise HTTPException(404, "Articolo non trovato")
        return {
            "id": doc["id"],
            "type": "article",
            "title": doc.get("title") or "",
            "cover_url": doc.get("cover_url") or doc.get("image_url") or "",
            "category": doc.get("category") or doc.get("category_slug") or "",
            "short_description": short_desc(
                doc.get("summary") or doc.get("excerpt") or doc.get("body") or "",
                max_len=280,
            ),
            "is_premium": bool(doc.get("is_premium")),
        }

    # ---- Legacy rich HTML share pages (gated landing) —
    #      /api/share/article/{id} and /api/share/media/{id}
    #      MUST be declared BEFORE the catch-all /share/{type}/{id} route so
    #      that "article" and "media" don't get swallowed by the generic
    #      content_type validator (which only accepts meditation/course/article).
    @api.get("/share/article/{article_id}")
    async def share_article_page(article_id: str, request: Request):
        a = await db.articles.find_one({"id": article_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Non trovato")
        base = public_base_url(request)
        image = a.get("image_url") or f"{base}/api/share/placeholder.png"
        url = f"{base}/api/share/article/{article_id}"
        html = og_html(a["title"], a.get("summary", ""), image, url, kind="articolo")
        return Response(content=html, media_type="text/html; charset=utf-8")

    @api.get("/share/media/{media_id}")
    async def share_media_page(media_id: str, request: Request):
        m = await db.media.find_one({"id": media_id}, {"_id": 0})
        if not m:
            raise HTTPException(404, "Non trovato")
        base = public_base_url(request)
        image = m.get("thumbnail_url") or f"{base}/api/share/placeholder.png"
        url = f"{base}/api/share/media/{media_id}"
        kind = "meditazione" if m.get("kind") == "meditation" else "video"
        html = og_html(m["title"], m.get("description", ""), image, url, kind=kind)
        return Response(content=html, media_type="text/html; charset=utf-8")

    # ---- Compact HTML wrapper (SEO + redirect) — /api/share/{type}/{id}
    @api.get("/share/{content_type}/{item_id}", response_class=Response)
    async def share_page(content_type: str, item_id: str, request: Request):
        if content_type not in ("meditation", "course", "article"):
            raise HTTPException(404, "Tipo di contenuto non valido")

        doc = None
        if content_type == "meditation":
            doc = await db.media.find_one({"id": item_id})
        elif content_type == "course":
            doc = await db.courses.find_one({"id": item_id})
        elif content_type == "article":
            doc = await db.articles.find_one({"id": item_id})
        if not doc:
            raise HTTPException(404, "Contenuto non trovato")

        title = doc.get("title") or doc.get("title_it") or "Libertà in Conoscenza"
        desc_raw = (
            doc.get("description")
            or doc.get("description_it")
            or doc.get("summary")
            or doc.get("excerpt")
            or doc.get("description_html")
            or ""
        )
        description = short_desc(desc_raw, max_len=200) or (
            "Un cammino di consapevolezza attraverso corsi, meditazioni e biblioteca."
        )
        cover = doc.get("cover_url") or doc.get("thumbnail_url") or doc.get("image_url") or ""
        cover_abs = absolute_url(request, cover) if cover else brand_placeholder_cover(request)

        type_label = {"meditation": "Meditazione", "course": "Corso", "article": "Articolo"}[content_type]
        frontend_path = {
            "meditation": f"/media/{item_id}",
            "course": f"/course/{item_id}",
            "article": f"/article/{item_id}",
        }[content_type]
        canonical = absolute_url(request, f"/api/share/{content_type}/{item_id}")
        redirect_to = absolute_url(request, frontend_path)

        def esc(s: str) -> str:
            return (
                (s or "")
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace('"', "&quot;")
                .replace("'", "&#39;")
            )

        html = f"""<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{esc(title)} — Libertà in Conoscenza</title>
  <meta name="description" content="{esc(description)}">
  <link rel="canonical" href="{esc(canonical)}">

  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Libertà in Conoscenza">
  <meta property="og:title" content="{esc(title)}">
  <meta property="og:description" content="{esc(description)}">
  <meta property="og:image" content="{esc(cover_abs)}">
  <meta property="og:image:alt" content="{esc(title)}">
  <meta property="og:url" content="{esc(canonical)}">
  <meta property="og:locale" content="it_IT">
  <meta property="article:section" content="{esc(type_label)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{esc(title)}">
  <meta name="twitter:description" content="{esc(description)}">
  <meta name="twitter:image" content="{esc(cover_abs)}">

  <script type="application/ld+json">{{
    "@context":"https://schema.org",
    "@type":"Article",
    "headline":"{esc(title)}",
    "description":"{esc(description)}",
    "image":"{esc(cover_abs)}",
    "publisher":{{"@type":"Organization","name":"Libertà in Conoscenza"}}
  }}</script>

  <meta http-equiv="refresh" content="0; url={esc(redirect_to)}">
  <link rel="preload" as="image" href="{esc(cover_abs)}">
  <style>
    body{{margin:0;background:#0A0F0D;color:#F0F0EA;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}}
    .wrap{{max-width:520px}}
    img{{max-width:100%;border-radius:12px;margin-bottom:16px}}
    h1{{color:#D4AF37;font-size:22px;margin:0 0 8px}}
    p{{color:#B8B8AE;margin:6px 0;font-size:14px;line-height:1.5}}
    a{{color:#D4AF37;font-weight:700;text-decoration:none}}
  </style>
</head>
<body>
  <div class="wrap">
    <img src="{esc(cover_abs)}" alt="{esc(title)}">
    <h1>{esc(title)}</h1>
    <p>{esc(description)}</p>
    <p>Ti stiamo portando su Libertà in Conoscenza…</p>
    <p><a href="{esc(redirect_to)}">Se non vieni reindirizzato automaticamente, clicca qui →</a></p>
  </div>
  <script>setTimeout(function(){{window.location.replace({redirect_to!r});}}, 150);</script>
</body>
</html>"""
        return Response(content=html, media_type="text/html; charset=utf-8", headers={
            "Cache-Control": "public, max-age=600",
        })

    return api
