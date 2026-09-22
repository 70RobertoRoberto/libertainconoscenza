"""Iteration 15: backend tests for lang query param on content endpoints.

Covers:
- /articles?lang=en / it / (none)
- /articles/{id}?lang=en / it / (none)
- /media?lang=en&kind=video
- /media/{id}?lang=en (graceful fallback when no translation)
- /search?q=&lang=en
- /favorites?lang=en
- /playlists/{id}?lang=en
- has_translation_en boolean present in article/media serialization
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")

ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"missing token: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# ------------------------------ /articles ---------------------------------
class TestArticles:
    def test_articles_lang_en_returns_translated_titles(self, h):
        r = requests.get(f"{BASE_URL}/api/articles?limit=20&lang=en", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()["items"]
        assert len(items) > 0, "no articles seeded"
        # every article carries has_translation_en boolean
        for a in items:
            assert "has_translation_en" in a and isinstance(a["has_translation_en"], bool)
        # At least one article should have EN translation and its title must differ
        # from the IT title (translation was populated by LLM for 108 articles).
        translated = [a for a in items if a["has_translation_en"]]
        assert translated, "no article with has_translation_en=True found"

    def test_articles_lang_it_returns_italian(self, h):
        r = requests.get(f"{BASE_URL}/api/articles?limit=5&lang=it", headers=h, timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        assert items
        # Confirm titles match Italian source (compare with default no-lang).
        r2 = requests.get(f"{BASE_URL}/api/articles?limit=5", headers=h, timeout=30)
        assert r2.status_code == 200
        default_items = {a["id"]: a["title"] for a in r2.json()["items"]}
        for a in items:
            assert a["title"] == default_items[a["id"]]

    def test_articles_no_lang_is_italian(self, h):
        r_none = requests.get(f"{BASE_URL}/api/articles?limit=5", headers=h, timeout=30)
        r_it = requests.get(f"{BASE_URL}/api/articles?limit=5&lang=it", headers=h, timeout=30)
        assert r_none.status_code == 200 and r_it.status_code == 200
        a1 = {a["id"]: a["title"] for a in r_none.json()["items"]}
        a2 = {a["id"]: a["title"] for a in r_it.json()["items"]}
        assert a1 == a2

    def test_article_detail_en_vs_it(self, h):
        r = requests.get(f"{BASE_URL}/api/articles?limit=50&lang=en", headers=h, timeout=30)
        assert r.status_code == 200
        translated = [a for a in r.json()["items"] if a["has_translation_en"]]
        assert translated, "no translated articles"
        aid = translated[0]["id"]
        # EN
        en = requests.get(f"{BASE_URL}/api/articles/{aid}?lang=en", headers=h, timeout=30)
        assert en.status_code == 200
        en_body = en.json()
        # IT
        it = requests.get(f"{BASE_URL}/api/articles/{aid}?lang=it", headers=h, timeout=30)
        assert it.status_code == 200
        it_body = it.json()
        # no lang == italian
        none = requests.get(f"{BASE_URL}/api/articles/{aid}", headers=h, timeout=30)
        assert none.status_code == 200
        assert none.json()["title"] == it_body["title"]
        assert none.json()["summary"] == it_body["summary"]
        # EN differs from IT
        assert en_body["title"] != it_body["title"], "EN title should differ from IT"
        assert en_body["summary"] != it_body["summary"], "EN summary should differ from IT"
        assert en_body["has_translation_en"] is True

    def test_article_detail_fallback_when_no_translation(self, h):
        # Create an article via admin without EN fields — should fallback to IT under ?lang=en
        payload = {
            "title": f"TEST_iter15_only_it_{uuid.uuid4().hex[:6]}",
            "summary": "Contenuto italiano di prova senza traduzione.",
            "category": "Filosofia",
            "source_url": None,
            "image_url": None,
            "is_premium": False,
        }
        r = requests.post(f"{BASE_URL}/api/admin/articles", json=payload, headers=h, timeout=30)
        assert r.status_code in (200, 201), r.text
        aid = r.json()["id"]
        try:
            en = requests.get(f"{BASE_URL}/api/articles/{aid}?lang=en", headers=h, timeout=30)
            assert en.status_code == 200
            body = en.json()
            assert body["title"] == payload["title"], "fallback to IT title expected"
            assert body["summary"] == payload["summary"], "fallback to IT summary expected"
            assert body["has_translation_en"] is False
        finally:
            requests.delete(f"{BASE_URL}/api/admin/articles/{aid}", headers=h, timeout=30)


# -------------------------------- /media ----------------------------------
class TestMedia:
    def test_media_list_video_lang_en_does_not_error(self, h):
        r = requests.get(f"{BASE_URL}/api/media?kind=video&lang=en", headers=h, timeout=30)
        assert r.status_code == 200
        items = r.json()["items"]
        for m in items:
            assert "has_translation_en" in m and isinstance(m["has_translation_en"], bool)

    def test_media_detail_lang_en_fallback(self, h):
        # Create a meditation via admin without EN fields
        payload = {
            "title": f"TEST_iter15_meditation_{uuid.uuid4().hex[:6]}",
            "description": "Meditazione italiana di prova.",
            "category": "Filosofia",
            "kind": "meditation",
            "meditation_category": "Concentrazione e Attenzione",
            "media_url": "https://example.com/audio.mp3",
            "thumbnail_url": None,
            "duration_sec": 60,
            "is_premium": False,
        }
        r = requests.post(f"{BASE_URL}/api/admin/media", json=payload, headers=h, timeout=30)
        assert r.status_code in (200, 201), r.text
        mid = r.json()["id"]
        try:
            en = requests.get(f"{BASE_URL}/api/media/{mid}?lang=en", headers=h, timeout=30)
            assert en.status_code == 200, en.text
            body = en.json()
            assert body["title"] == payload["title"], "fallback to IT title expected"
            assert body["description"] == payload["description"], "fallback to IT description expected"
            assert body["has_translation_en"] is False
        finally:
            requests.delete(f"{BASE_URL}/api/admin/media/{mid}", headers=h, timeout=30)


# -------------------------------- /search ---------------------------------
class TestSearch:
    def test_search_lang_en(self, h):
        # Pick a translated article and search for a token from EN title
        r = requests.get(f"{BASE_URL}/api/articles?limit=50&lang=en", headers=h, timeout=30)
        assert r.status_code == 200
        translated = [a for a in r.json()["items"] if a["has_translation_en"]]
        assert translated
        title = translated[0]["title"]
        # Take a distinctive-looking word (len>=4 non-generic)
        tokens = [w for w in title.split() if len(w) >= 5 and w.isalpha()]
        token = tokens[0] if tokens else title[:5]
        r2 = requests.get(
            f"{BASE_URL}/api/search?q={token}&lang=en", headers=h, timeout=30
        )
        assert r2.status_code == 200
        body = r2.json()
        assert "articles" in body and "media" in body
        # returned items should have has_translation_en field
        for a in body["articles"]:
            assert "has_translation_en" in a


# -------------------------------- /favorites -------------------------------
class TestFavorites:
    def test_favorites_lang_en(self, h):
        # Add a translated article to favorites
        r = requests.get(f"{BASE_URL}/api/articles?limit=50&lang=en", headers=h, timeout=30)
        translated = [a for a in r.json()["items"] if a["has_translation_en"]]
        assert translated
        aid = translated[0]["id"]
        en_title = translated[0]["title"]
        # Add favorite via toggle
        rfav = requests.post(
            f"{BASE_URL}/api/favorites/toggle",
            json={"content_id": aid, "content_type": "article"},
            headers=h, timeout=30,
        )
        assert rfav.status_code in (200, 201), rfav.text
        try:
            r2 = requests.get(f"{BASE_URL}/api/favorites?lang=en", headers=h, timeout=30)
            assert r2.status_code == 200
            body = r2.json()
            arts = body.get("articles", [])
            found = [a for a in arts if a["id"] == aid]
            assert found, "favorited article missing from EN response"
            assert found[0]["title"] == en_title, "EN title should be served"
        finally:
            # Toggle again to remove
            requests.post(
                f"{BASE_URL}/api/favorites/toggle",
                json={"content_id": aid, "content_type": "article"},
                headers=h, timeout=30,
            )


# -------------------------------- /playlists -------------------------------
class TestPlaylists:
    def test_playlist_lang_en(self, h):
        # Create a playlist, add a meditation, verify lang param is accepted.
        pr = requests.post(
            f"{BASE_URL}/api/playlists",
            json={"name": f"TEST_iter15_pl_{uuid.uuid4().hex[:6]}"},
            headers=h, timeout=30,
        )
        assert pr.status_code in (200, 201), pr.text
        pid = pr.json()["id"]
        # need a media item
        mpayload = {
            "title": f"TEST_iter15_pl_med_{uuid.uuid4().hex[:6]}",
            "description": "Descrizione italiana.",
            "category": "Filosofia",
            "kind": "meditation",
            "meditation_category": "Concentrazione e Attenzione",
            "media_url": "https://example.com/audio.mp3",
            "thumbnail_url": None,
            "duration_sec": 60,
            "is_premium": False,
        }
        mr = requests.post(f"{BASE_URL}/api/admin/media", json=mpayload, headers=h, timeout=30)
        assert mr.status_code in (200, 201), mr.text
        mid = mr.json()["id"]
        try:
            ar = requests.post(
                f"{BASE_URL}/api/playlists/{pid}/items",
                json={"media_id": mid},
                headers=h, timeout=30,
            )
            assert ar.status_code in (200, 201), ar.text
            det = requests.get(f"{BASE_URL}/api/playlists/{pid}?lang=en", headers=h, timeout=30)
            assert det.status_code == 200, det.text
            body = det.json()
            assert "items" in body
            found = [m for m in body["items"] if m["id"] == mid]
            assert found
            # fallback to IT title expected
            assert found[0]["title"] == mpayload["title"]
            assert found[0]["has_translation_en"] is False
        finally:
            requests.delete(f"{BASE_URL}/api/admin/media/{mid}", headers=h, timeout=30)
            requests.delete(f"{BASE_URL}/api/playlists/{pid}", headers=h, timeout=30)
