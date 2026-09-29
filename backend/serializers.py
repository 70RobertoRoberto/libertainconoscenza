"""Content serializers + text/URL helpers + shareable OG HTML template."""
from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request

from constants import MEDITATION_CATEGORIES


# ---------------------------------------------------------------------------
# Content serializers
# ---------------------------------------------------------------------------
def serialize_article(a: dict, lang: Optional[str] = None) -> dict:
    """Serialize an article. When lang == "en" and English translations exist,
    swap them into the primary title/summary fields so the frontend transparently
    receives translated content."""
    title = a["title"]
    summary = a["summary"]
    if lang == "en":
        te = a.get("title_en")
        se = a.get("summary_en")
        if te:
            title = te
        if se:
            summary = se
    return {
        "id": a["id"],
        "title": title,
        "summary": summary,
        "category": a["category"],
        "source_url": a.get("source_url"),
        "image_url": a.get("image_url"),
        "is_premium": a.get("is_premium", False),
        "views": a.get("views", 0),
        "created_at": a.get("created_at", ""),
        "has_translation_en": bool(a.get("title_en") and a.get("summary_en")),
    }


def serialize_media(m: dict, lang: Optional[str] = None) -> dict:
    title = m["title"]
    description = m.get("description", "")
    if lang == "en":
        if m.get("title_en"):
            title = m["title_en"]
        if m.get("description_en"):
            description = m["description_en"]
    return {
        "id": m["id"],
        "title": title,
        "description": description,
        "category": m["category"],
        "kind": m["kind"],
        "meditation_category": m.get("meditation_category"),
        "video_categories": m.get("video_categories") or [],
        "media_url": m["media_url"],
        "thumbnail_url": m.get("thumbnail_url"),
        "duration_sec": m.get("duration_sec"),
        "is_premium": m.get("is_premium", False),
        "views": m.get("views", 0),
        "created_at": m.get("created_at", ""),
        "has_translation_en": bool(m.get("title_en") or m.get("description_en")),
    }


def serialize_playlist(p: dict, media_by_id: Optional[dict] = None, lang: Optional[str] = None) -> dict:
    ids = p.get("media_ids", []) or []
    items = []
    if media_by_id is not None:
        for mid in ids:
            m = media_by_id.get(mid)
            if m:
                items.append(serialize_media(m, lang))
    return {
        "id": p["id"],
        "name": p["name"],
        "media_ids": ids,
        "items": items,
        "count": len(ids),
        "created_at": p.get("created_at", ""),
        "updated_at": p.get("updated_at", ""),
    }


def cat_slug(name: str) -> str:
    s = name.lower()
    s = s.replace("à", "a").replace("è", "e").replace("é", "e").replace("ì", "i").replace("ò", "o").replace("ù", "u")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s


def slug_to_category(slug: str) -> Optional[str]:
    for name in MEDITATION_CATEGORIES:
        if cat_slug(name) == slug:
            return name
    return None


def compute_streak(dates: list) -> tuple[int, int]:
    """Return (current_streak, longest_streak) from YYYY-MM-DD strings."""
    if not dates:
        return 0, 0
    from datetime import date
    day_set = set(dates)
    today = datetime.now(timezone.utc).date()
    current = 0
    cur = today
    while cur.isoformat() in day_set:
        current += 1
        cur = date.fromordinal(cur.toordinal() - 1)
    if current == 0:
        cur = date.fromordinal(today.toordinal() - 1)
        while cur.isoformat() in day_set:
            current += 1
            cur = date.fromordinal(cur.toordinal() - 1)
    sorted_days = sorted(day_set)
    longest = 1
    run = 1
    for i in range(1, len(sorted_days)):
        prev = date.fromisoformat(sorted_days[i - 1])
        curd = date.fromisoformat(sorted_days[i])
        if (curd.toordinal() - prev.toordinal()) == 1:
            run += 1
            longest = max(longest, run)
        else:
            run = 1
    return current, longest


def short_desc(html_or_text: str, max_len: int = 220) -> str:
    """Strip HTML tags and truncate to a short marketing teaser."""
    if not html_or_text:
        return ""
    txt = re.sub(r"<[^>]+>", " ", str(html_or_text))
    txt = re.sub(r"\s+", " ", txt).strip()
    return (txt[: max_len - 1] + "…") if len(txt) > max_len else txt


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------
PUBLIC_HOST_ENV = os.environ.get("PUBLIC_HOST", "")


def absolute_url(request: Request, path: str) -> str:
    if path.startswith(("http://", "https://")):
        return path
    base = os.environ.get("PUBLIC_APP_URL") or f"{request.url.scheme}://{request.url.netloc}"
    return f"{base.rstrip('/')}{path if path.startswith('/') else '/' + path}"


def brand_placeholder_cover(request: Request) -> str:
    return absolute_url(request, "/api/files/meditation-covers/hero-c4cc4b71.webp")


def public_base_url(request: Request) -> str:
    """Best-effort external URL that WhatsApp/Telegram can reach."""
    if PUBLIC_HOST_ENV:
        return PUBLIC_HOST_ENV.rstrip("/")
    proto = request.headers.get("x-forwarded-proto", "https")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or "localhost"
    return f"{proto}://{host}"


# ---------------------------------------------------------------------------
# Open Graph HTML template (used by /share/article/{id} and /share/media/{id})
# ---------------------------------------------------------------------------
def og_html(title: str, description: str, image: str, url: str, kind: str = "articolo") -> str:
    def esc(s: str) -> str:
        return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    title_e = esc(title)
    teaser = (description or "")[:220].rsplit(" ", 1)[0] + "…" if len(description or "") > 220 else (description or "")
    desc_e = esc(teaser)
    action = {
        "articolo": "Iscriviti per leggere l'articolo completo",
        "meditazione": "Iscriviti per ascoltare la meditazione",
        "video": "Iscriviti per guardare il video",
    }.get(kind, "Iscriviti per continuare")
    from urllib.parse import urlparse
    parsed = urlparse(url)
    web_base = f"{parsed.scheme}://{parsed.netloc}"
    web_register_url = f"{web_base}/register"
    web_login_url = f"{web_base}/login"
    ref_slug = esc(url.split('/')[-1])
    deep_link = f"conoscenzaaperta://register?ref={ref_slug}"
    return f"""<!doctype html>
<html lang=\"it\">
<head>
<meta charset=\"utf-8\"/>
<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/>
<title>{title_e} — Libertà in Conoscenza</title>
<meta name=\"description\" content=\"{desc_e}\"/>
<meta property=\"og:type\" content=\"article\"/>
<meta property=\"og:site_name\" content=\"Libertà in Conoscenza\"/>
<meta property=\"og:title\" content=\"{title_e}\"/>
<meta property=\"og:description\" content=\"{desc_e}\"/>
<meta property=\"og:image\" content=\"{esc(image)}\"/>
<meta property=\"og:image:width\" content=\"800\"/>
<meta property=\"og:image:height\" content=\"600\"/>
<meta property=\"og:url\" content=\"{esc(url)}\"/>
<meta name=\"twitter:card\" content=\"summary_large_image\"/>
<meta name=\"twitter:title\" content=\"{title_e}\"/>
<meta name=\"twitter:description\" content=\"{desc_e}\"/>
<meta name=\"twitter:image\" content=\"{esc(image)}\"/>
<style>
  body{{font-family:Georgia,'Times New Roman',serif;background:#0A0F0D;color:#F0F0EA;margin:0;padding:0;}}
  .wrap{{max-width:720px;margin:0 auto;padding:24px;}}
  .brand{{color:#D4AF37;letter-spacing:6px;font-size:12px;text-align:center;margin:16px 0 24px;font-family:system-ui,sans-serif;font-weight:700;}}
  img{{width:100%;height:auto;border-radius:14px;margin:8px 0 24px;}}
  h1{{color:#F0F0EA;font-weight:400;font-size:30px;line-height:1.25;margin:0 0 12px;}}
  .cat{{color:#B38B4D;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;font-family:system-ui,sans-serif;font-weight:700;}}
  p{{color:#C5C5B5;font-size:17px;line-height:1.7;}}
  .gate{{margin-top:28px;padding:24px;border-radius:14px;background:linear-gradient(180deg,#151E1A,#0A0F0D);border:1px solid #D4AF37;}}
  .gate h2{{color:#D4AF37;font-family:system-ui,sans-serif;font-size:19px;font-weight:700;margin:0 0 8px;}}
  .gate p{{color:#E0E0D5;font-size:14px;margin:0 0 16px;font-family:system-ui,sans-serif;}}
  .cta-row{{display:flex;flex-wrap:wrap;gap:10px;}}
  .cta{{display:inline-block;padding:14px 22px;background:#D4AF37;color:#0A0F0D;border-radius:999px;text-decoration:none;font-weight:800;font-family:system-ui,sans-serif;letter-spacing:0.5px;border:none;cursor:pointer;font-size:15px;}}
  .cta.secondary{{background:transparent;color:#D4AF37;border:1px solid #D4AF37;}}
  .cta:hover{{opacity:0.9;}}
  .login-link{{display:block;margin-top:12px;color:#B38B4D;font-family:system-ui,sans-serif;font-size:13px;text-decoration:underline;}}
  .foot{{text-align:center;color:#88948E;font-size:11px;margin-top:32px;font-family:system-ui,sans-serif;}}
</style>
</head>
<body>
<div class=\"wrap\">
  <div class=\"brand\">LIBERTÀ IN CONOSCENZA</div>
  <div class=\"cat\">{esc(kind)}</div>
  <h1>{title_e}</h1>
  <img src=\"{esc(image)}\" alt=\"{title_e}\"/>
  <p>{desc_e}</p>
  <div class=\"gate\">
    <h2>🔐 {action}</h2>
    <p>Unisciti alla community <b>Libertà in Conoscenza</b> e accedi a corsi, meditazioni, video, articoli approfonditi e messaggi personali dalla community.</p>
    <div class=\"cta-row\">
      <a class=\"cta\" id=\"ctaJoin\" href=\"{esc(web_register_url)}\" onclick=\"return tryDeepLink(event)\">Iscriviti ora</a>
      <a class=\"cta secondary\" href=\"{esc(web_register_url)}\">Apri sul web</a>
    </div>
    <a class=\"login-link\" href=\"{esc(web_login_url)}\">Hai già un account? Accedi</a>
  </div>
  <div class=\"foot\">Sapienza per crescere · Wisdom to grow</div>
</div>
<script>
  var deepLink = \"{deep_link}\";
  var webUrl = \"{esc(web_register_url)}\";
  function tryDeepLink(e) {{
    var ua = (navigator.userAgent||\"\").toLowerCase();
    var isMobile = /android|iphone|ipad|ipod/i.test(ua);
    if (!isMobile) return true;
    e.preventDefault();
    var start = Date.now();
    var fallbackTimer = setTimeout(function() {{
      if (Date.now() - start < 2500 && document.visibilityState === 'visible') {{
        window.location.replace(webUrl);
      }}
    }}, 1400);
    var a = document.createElement('a');
    a.href = deepLink;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.addEventListener('visibilitychange', function() {{
      if (document.visibilityState !== 'visible') {{
        clearTimeout(fallbackTimer);
      }}
    }}, {{ once: true }});
    return false;
  }}
</script>
</body></html>"""


# Backwards-compat aliases used by legacy code paths.
_serialize_article = serialize_article
_serialize_media = serialize_media
_serialize_playlist = serialize_playlist
_cat_slug = cat_slug
_slug_to_category = slug_to_category
_compute_streak = compute_streak
_short_desc = short_desc
_absolute_url = absolute_url
_brand_placeholder_cover = brand_placeholder_cover
_public_base_url = public_base_url
_og_html = og_html
