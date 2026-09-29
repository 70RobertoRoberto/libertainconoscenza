"""Media routes: list/detail, categories (video + meditation), admin CRUD,
YouTube import, upload, file streaming, ads, playlists."""
from __future__ import annotations

import re
import uuid
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from deps import now_iso, is_subscription_active, YOUTUBE_API_KEY
from models import (
    MediaIn, MediaUpdate, YoutubeImportIn, AdIn,
    PlaylistCreate, PlaylistRename, PlaylistReorder, PlaylistAddItem,
)
from constants import (
    APP_NAME, CATEGORIES, MEDITATION_CATEGORIES, VIDEO_CATEGORIES,
    VIDEO_CATEGORY_SLUGS, ALLOWED_MIME,
)
from serializers import serialize_media, cat_slug, serialize_playlist
from storage import put_object_sync, get_object_sync
from push import send_push_bg, all_user_ids

logger = logging.getLogger("conoscenza")


def build_media_router(db, current_user, require_admin) -> APIRouter:
    api = APIRouter(prefix="/api")

    # ---- Categories & listing -----------------------------------------
    @api.get("/media")
    async def list_media(
        kind: Optional[str] = None,
        category: Optional[str] = None,
        meditation_category: Optional[str] = None,
        video_category: Optional[str] = None,
        lang: Optional[str] = None,
        user: dict = Depends(current_user),
    ):
        q: dict = {}
        if kind:
            q["kind"] = kind
        if category:
            q["category"] = category
        if meditation_category:
            q["meditation_category"] = meditation_category
        if video_category:
            q["video_categories"] = video_category
        cursor = db.media.find(q, {"_id": 0}).sort("created_at", -1)
        items = [serialize_media(m, lang) async for m in cursor]
        return {"items": items}

    @api.get("/video-categories")
    async def list_video_categories(_: dict = Depends(current_user)):
        pipeline = [
            {"$match": {"kind": "video", "video_categories": {"$exists": True, "$ne": None}}},
            {"$unwind": "$video_categories"},
            {"$group": {"_id": "$video_categories", "count": {"$sum": 1}}},
        ]
        counts: dict = {}
        async for row in db.media.aggregate(pipeline):
            counts[row["_id"]] = row.get("count", 0)
        items = [
            {"name": name, "slug": VIDEO_CATEGORY_SLUGS[name], "count": counts.get(name, 0)}
            for name in VIDEO_CATEGORIES
        ]
        return {"items": items}

    @api.get("/meditation-categories")
    async def list_meditation_categories(_: dict = Depends(current_user)):
        pipeline = [
            {"$match": {"kind": "meditation", "meditation_category": {"$ne": None}}},
            {"$group": {"_id": "$meditation_category", "count": {"$sum": 1}}},
        ]
        counts: dict = {}
        async for row in db.media.aggregate(pipeline):
            counts[row["_id"]] = row["count"]
        return {
            "items": [
                {"name": name, "slug": cat_slug(name), "count": counts.get(name, 0)}
                for name in MEDITATION_CATEGORIES
            ]
        }

    @api.get("/media/{media_id}")
    async def get_media(media_id: str, lang: Optional[str] = None, user: dict = Depends(current_user)):
        m = await db.media.find_one({"id": media_id}, {"_id": 0})
        if not m:
            raise HTTPException(404, "Non trovato")
        if m.get("is_premium") and not is_subscription_active(user):
            raise HTTPException(402, "Contenuto premium: abbonamento richiesto")
        await db.media.update_one({"id": media_id}, {"$inc": {"views": 1}})
        from datetime import datetime, timezone
        await db.views.insert_one({
            "id": str(uuid.uuid4()),
            "content_id": media_id,
            "content_type": "media",
            "user_id": user["id"],
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "ts": now_iso(),
        })
        m["views"] = m.get("views", 0) + 1
        return serialize_media(m, lang)

    # ---- Admin CRUD ----------------------------------------------------
    @api.post("/admin/media", dependencies=[Depends(require_admin)])
    async def create_media(inp: MediaIn):
        if inp.category not in CATEGORIES:
            raise HTTPException(400, "Categoria non valida")
        if inp.kind not in ("video", "meditation"):
            raise HTTPException(400, "kind deve essere 'video' o 'meditation'")
        if inp.kind == "meditation" and inp.meditation_category and inp.meditation_category not in MEDITATION_CATEGORIES:
            raise HTTPException(400, "Categoria meditazione non valida")
        if inp.kind == "video" and inp.video_categories:
            if len(inp.video_categories) > 2:
                raise HTTPException(400, "Puoi selezionare al massimo 2 categorie video")
            invalid = [c for c in inp.video_categories if c not in VIDEO_CATEGORIES]
            if invalid:
                raise HTTPException(400, f"Categoria video non valida: {invalid[0]}")
        doc = {
            "id": str(uuid.uuid4()),
            **inp.dict(),
            "views": 0,
            "created_at": now_iso(),
        }
        await db.media.insert_one(doc)
        try:
            recipients = await all_user_ids()
            title = "Nuova meditazione" if inp.kind == "meditation" else "Nuovo video"
            await send_push_bg(recipients, title, inp.title, action_url=f"/media/{doc['id']}")
        except Exception as e:
            logger.warning(f"Push failed: {e}")
        return serialize_media(doc)

    @api.delete("/admin/media/{media_id}", dependencies=[Depends(require_admin)])
    async def delete_media(media_id: str):
        r = await db.media.delete_one({"id": media_id})
        return {"deleted": r.deleted_count}

    @api.put("/admin/media/{media_id}", dependencies=[Depends(require_admin)])
    async def update_media(media_id: str, inp: MediaUpdate):
        existing = await db.media.find_one({"id": media_id})
        if not existing:
            raise HTTPException(404, "Media non trovato")
        update: dict = {}
        for k, v in inp.dict(exclude_unset=True).items():
            if v is not None or k in ("thumbnail_url", "video_categories"):
                update[k] = v
        if "category" in update and update["category"] not in CATEGORIES:
            raise HTTPException(400, "Categoria non valida")
        if "meditation_category" in update and update["meditation_category"] and update["meditation_category"] not in MEDITATION_CATEGORIES:
            raise HTTPException(400, "Categoria meditazione non valida")
        if "video_categories" in update and update["video_categories"]:
            if len(update["video_categories"]) > 2:
                raise HTTPException(400, "Puoi selezionare al massimo 2 categorie video")
            invalid = [c for c in update["video_categories"] if c not in VIDEO_CATEGORIES]
            if invalid:
                raise HTTPException(400, f"Categoria video non valida: {invalid[0]}")
        if update:
            update["updated_at"] = now_iso()
            await db.media.update_one({"id": media_id}, {"$set": update})
        m = await db.media.find_one({"id": media_id})
        return serialize_media(m)

    # ---- Upload + file streaming --------------------------------------
    @api.post("/admin/upload", dependencies=[Depends(require_admin)])
    async def admin_upload(file: UploadFile = File(...)):
        ALLOWED_EXTS = {
            "mp3", "m4a", "mp4", "wav", "ogg", "opus", "aac", "amr", "3gp", "3gpp",
            "flac", "webm", "mov", "jpg", "jpeg", "png", "webp",
        }
        filename = file.filename or ""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        mime_ok = file.content_type in ALLOWED_MIME
        ext_ok = ext in ALLOWED_EXTS
        if not mime_ok and not ext_ok:
            raise HTTPException(415, f"Tipo file non supportato ({file.content_type or ext or 'sconosciuto'})")
        data = await file.read()
        if len(data) > 300 * 1024 * 1024:
            raise HTTPException(413, "File troppo grande (max 300MB)")
        if not ext:
            ext = "bin"
        saved_mime = file.content_type or ""
        if saved_mime in ("", "application/octet-stream"):
            ext_to_mime = {
                "mp3": "audio/mpeg", "m4a": "audio/mp4", "mp4": "audio/mp4",
                "wav": "audio/wav", "ogg": "audio/ogg", "opus": "audio/opus",
                "aac": "audio/aac", "amr": "audio/amr",
                "3gp": "audio/3gpp", "3gpp": "audio/3gpp",
                "flac": "audio/flac", "webm": "audio/webm",
                "mov": "video/quicktime",
                "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "png": "image/png", "webp": "image/webp",
            }
            saved_mime = ext_to_mime.get(ext, "application/octet-stream")

        original_size = len(data)
        try:
            from media_processor import compress_media
            data, ext, saved_mime = await run_in_threadpool(compress_media, data, filename, saved_mime)
        except Exception as e:
            logger.warning(f"Media compression skipped for {filename}: {e}")

        path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
        result = await run_in_threadpool(put_object_sync, path, data, saved_mime)
        stored_path = result.get("path", path)
        await db.uploads.insert_one({
            "id": str(uuid.uuid4()),
            "path": stored_path,
            "mime": saved_mime,
            "size": len(data),
            "original_size": original_size,
            "filename": filename,
            "created_at": now_iso(),
        })
        public_url = f"/api/files/{stored_path}"
        return {
            "path": stored_path,
            "url": public_url,
            "size": len(data),
            "original_size": original_size,
            "mime": saved_mime,
            "filename": filename,
        }

    @api.get("/files/{path:path}")
    async def get_file(path: str, request: Request):
        etag = f'W/"{hash(path) & 0xffffffff:x}"'
        if request.headers.get("if-none-match") == etag:
            return Response(
                status_code=304,
                headers={
                    "ETag": etag,
                    "Cache-Control": "public, max-age=31536000, immutable",
                },
            )
        try:
            data, ctype = await run_in_threadpool(get_object_sync, path)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(404, "File non trovato")
        return Response(
            content=data,
            media_type=ctype,
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "ETag": etag,
                "Accept-Ranges": "bytes",
            },
        )

    # ---- YouTube import -----------------------------------------------
    @api.post("/admin/media/import-youtube", dependencies=[Depends(require_admin)])
    async def import_youtube_channel(inp: YoutubeImportIn):
        if inp.category not in CATEGORIES:
            raise HTTPException(400, "Categoria non valida")
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=20, headers={"User-Agent": "Mozilla/5.0"}) as h:
                r = await h.get(inp.channel_url)
                r.raise_for_status()
            m = re.search(r'"externalId":"(UC[\w-]+)"', r.text) or re.search(r'/channel/(UC[\w-]+)', r.text)
            if not m:
                raise HTTPException(400, "Impossibile trovare il canale YouTube")
            channel_id = m.group(1)

            imported = 0
            skipped = 0
            total = 0

            if YOUTUBE_API_KEY:
                async with httpx.AsyncClient(timeout=30) as h:
                    ch = await h.get(
                        "https://www.googleapis.com/youtube/v3/channels",
                        params={"part": "contentDetails", "id": channel_id, "key": YOUTUBE_API_KEY},
                    )
                    ch.raise_for_status()
                    items = ch.json().get("items", [])
                    if not items:
                        raise HTTPException(400, "Canale non trovato via API")
                    uploads = items[0]["contentDetails"]["relatedPlaylists"]["uploads"]

                    page_token = None
                    while True:
                        params = {
                            "part": "snippet,contentDetails",
                            "playlistId": uploads,
                            "maxResults": 50,
                            "key": YOUTUBE_API_KEY,
                        }
                        if page_token:
                            params["pageToken"] = page_token
                        p = await h.get("https://www.googleapis.com/youtube/v3/playlistItems", params=params)
                        p.raise_for_status()
                        data = p.json()
                        for it in data.get("items", []):
                            total += 1
                            snip = it["snippet"]
                            vid = it["contentDetails"]["videoId"]
                            url = f"https://www.youtube.com/watch?v={vid}"
                            if await db.media.find_one({"media_url": url}):
                                skipped += 1
                                continue
                            thumbs = snip.get("thumbnails", {})
                            thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url") or f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
                            await db.media.insert_one({
                                "id": str(uuid.uuid4()),
                                "title": snip.get("title", f"Video {vid}"),
                                "description": (snip.get("description") or "")[:1000],
                                "category": inp.category,
                                "kind": "video",
                                "media_url": url,
                                "thumbnail_url": thumb,
                                "duration_sec": None,
                                "is_premium": inp.is_premium,
                                "views": 0,
                                "created_at": now_iso(),
                            })
                            imported += 1
                        page_token = data.get("nextPageToken")
                        if not page_token:
                            break
                return {"imported": imported, "skipped": skipped, "total": total, "channel_id": channel_id, "source": "youtube_api"}

            # Fallback: RSS
            async with httpx.AsyncClient(timeout=20) as h:
                rss = await h.get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
                rss.raise_for_status()
            feed = rss.text
            vids = re.findall(r"<yt:videoId>([^<]+)</yt:videoId>", feed)
            titles = re.findall(r"<media:title>([^<]+)</media:title>", feed)
            thumbs = re.findall(r'<media:thumbnail url="([^"]+)"', feed)
            descs = re.findall(r"<media:description>([^<]*)</media:description>", feed, re.S)
            total = len(vids)
            for i, vid in enumerate(vids):
                url = f"https://www.youtube.com/watch?v={vid}"
                if await db.media.find_one({"media_url": url}):
                    skipped += 1
                    continue
                title = titles[i] if i < len(titles) else f"Video {vid}"
                thumb = thumbs[i] if i < len(thumbs) else f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
                desc = (descs[i] if i < len(descs) else "").strip()[:800]
                await db.media.insert_one({
                    "id": str(uuid.uuid4()),
                    "title": title,
                    "description": desc,
                    "category": inp.category,
                    "kind": "video",
                    "media_url": url,
                    "thumbnail_url": thumb,
                    "duration_sec": None,
                    "is_premium": inp.is_premium,
                    "views": 0,
                    "created_at": now_iso(),
                })
                imported += 1
            return {"imported": imported, "skipped": skipped, "total": total, "channel_id": channel_id, "source": "rss"}
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("YouTube import failed")
            raise HTTPException(500, f"Errore import: {e}")

    # ---- Ads -----------------------------------------------------------
    @api.get("/ads/active")
    async def get_active_ads(user: dict = Depends(current_user)):
        cursor = db.ads.find({"is_active": True}, {"_id": 0}).sort("created_at", -1)
        items = []
        async for a in cursor:
            items.append({
                "id": a["id"],
                "image_url": a["image_url"],
                "click_url": a.get("click_url"),
                "caption": a.get("caption"),
            })
        return {"items": items}

    @api.post("/admin/ads", dependencies=[Depends(require_admin)])
    async def create_ad(inp: AdIn):
        doc = {
            "id": str(uuid.uuid4()),
            **inp.dict(),
            "created_at": now_iso(),
        }
        await db.ads.insert_one(doc)
        doc.pop("_id", None)
        return doc

    @api.get("/admin/ads", dependencies=[Depends(require_admin)])
    async def list_ads():
        cursor = db.ads.find({}, {"_id": 0}).sort("created_at", -1)
        items = []
        async for a in cursor:
            items.append(a)
        return {"items": items}

    @api.delete("/admin/ads/{ad_id}", dependencies=[Depends(require_admin)])
    async def delete_ad(ad_id: str):
        r = await db.ads.delete_one({"id": ad_id})
        return {"deleted": r.deleted_count}

    @api.post("/admin/ads/{ad_id}/toggle", dependencies=[Depends(require_admin)])
    async def toggle_ad(ad_id: str):
        a = await db.ads.find_one({"id": ad_id}, {"_id": 0})
        if not a:
            raise HTTPException(404, "Ad non trovato")
        await db.ads.update_one({"id": ad_id}, {"$set": {"is_active": not a.get("is_active", True)}})
        return {"ok": True}

    # ---- Playlists ----------------------------------------------------
    @api.get("/playlists")
    async def list_playlists(user: dict = Depends(current_user)):
        cursor = db.playlists.find({"user_id": user["id"]}, {"_id": 0}).sort("updated_at", -1)
        out = []
        async for p in cursor:
            out.append({
                "id": p["id"],
                "name": p["name"],
                "count": len(p.get("media_ids", []) or []),
                "created_at": p.get("created_at", ""),
                "updated_at": p.get("updated_at", ""),
            })
        return {"items": out}

    @api.post("/playlists")
    async def create_playlist(inp: PlaylistCreate, user: dict = Depends(current_user)):
        now = now_iso()
        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": inp.name.strip(),
            "media_ids": [],
            "created_at": now,
            "updated_at": now,
        }
        await db.playlists.insert_one(doc)
        return serialize_playlist(doc, {})

    @api.get("/playlists/{playlist_id}")
    async def get_playlist(playlist_id: str, lang: Optional[str] = None, user: dict = Depends(current_user)):
        p = await db.playlists.find_one({"id": playlist_id, "user_id": user["id"]}, {"_id": 0})
        if not p:
            raise HTTPException(404, "Playlist non trovata")
        ids = p.get("media_ids", []) or []
        media = {}
        if ids:
            async for m in db.media.find({"id": {"$in": ids}}, {"_id": 0}):
                media[m["id"]] = m
        ordered_items = []
        for mid in ids:
            m = media.get(mid)
            if m:
                ordered_items.append(serialize_media(m, lang))
        return {
            "id": p["id"],
            "name": p["name"],
            "media_ids": ids,
            "items": ordered_items,
            "count": len(ids),
            "created_at": p.get("created_at", ""),
            "updated_at": p.get("updated_at", ""),
        }

    @api.patch("/playlists/{playlist_id}")
    async def rename_playlist(playlist_id: str, inp: PlaylistRename, user: dict = Depends(current_user)):
        r = await db.playlists.update_one(
            {"id": playlist_id, "user_id": user["id"]},
            {"$set": {"name": inp.name.strip(), "updated_at": now_iso()}},
        )
        if r.matched_count == 0:
            raise HTTPException(404, "Playlist non trovata")
        return {"ok": True}

    @api.delete("/playlists/{playlist_id}")
    async def delete_playlist(playlist_id: str, user: dict = Depends(current_user)):
        r = await db.playlists.delete_one({"id": playlist_id, "user_id": user["id"]})
        if r.deleted_count == 0:
            raise HTTPException(404, "Playlist non trovata")
        return {"ok": True}

    @api.post("/playlists/{playlist_id}/items")
    async def add_playlist_item(playlist_id: str, inp: PlaylistAddItem, user: dict = Depends(current_user)):
        p = await db.playlists.find_one({"id": playlist_id, "user_id": user["id"]})
        if not p:
            raise HTTPException(404, "Playlist non trovata")
        m = await db.media.find_one({"id": inp.media_id})
        if not m:
            raise HTTPException(404, "Meditazione non trovata")
        ids = list(p.get("media_ids", []) or [])
        if inp.media_id in ids:
            return {"ok": True, "added": False, "reason": "already_present"}
        ids.append(inp.media_id)
        await db.playlists.update_one(
            {"id": playlist_id},
            {"$set": {"media_ids": ids, "updated_at": now_iso()}},
        )
        return {"ok": True, "added": True, "count": len(ids)}

    @api.delete("/playlists/{playlist_id}/items/{media_id}")
    async def remove_playlist_item(playlist_id: str, media_id: str, user: dict = Depends(current_user)):
        p = await db.playlists.find_one({"id": playlist_id, "user_id": user["id"]})
        if not p:
            raise HTTPException(404, "Playlist non trovata")
        ids = [x for x in (p.get("media_ids", []) or []) if x != media_id]
        await db.playlists.update_one(
            {"id": playlist_id},
            {"$set": {"media_ids": ids, "updated_at": now_iso()}},
        )
        return {"ok": True, "count": len(ids)}

    @api.post("/playlists/{playlist_id}/reorder")
    async def reorder_playlist(playlist_id: str, inp: PlaylistReorder, user: dict = Depends(current_user)):
        p = await db.playlists.find_one({"id": playlist_id, "user_id": user["id"]})
        if not p:
            raise HTTPException(404, "Playlist non trovata")
        current = set(p.get("media_ids", []) or [])
        submitted = list(dict.fromkeys(inp.media_ids))
        if set(submitted) != current:
            raise HTTPException(400, "L'elenco degli ID non corrisponde al contenuto della playlist")
        await db.playlists.update_one(
            {"id": playlist_id},
            {"$set": {"media_ids": submitted, "updated_at": now_iso()}},
        )
        return {"ok": True}

    return api
