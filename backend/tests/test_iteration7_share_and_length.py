"""Iteration 7 tests: article length fix, image presence, and OG share endpoints."""
import os
import re
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"
ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(client):
    r = client.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def articles(client, auth_headers):
    r = client.get(f"{API}/articles", headers=auth_headers)
    assert r.status_code == 200, r.text
    data = r.json()
    lst = data.get("items") if isinstance(data, dict) else data
    assert isinstance(lst, list)
    assert len(lst) >= 13, f"expected at least 13 seed articles, got {len(lst)}"
    return lst


# ----- Bug 1: article length >= 1500 chars -----
class TestArticleLength:
    def test_all_articles_have_long_summary(self, articles):
        short = [(a.get("title"), len(a.get("summary", ""))) for a in articles if len(a.get("summary", "")) < 1500]
        assert not short, f"Articles with short summary (<1500 chars): {short}"

    def test_biofisica_quantistica_contains_expected_keywords(self, articles):
        target = next(
            (a for a in articles if "biofisica" in (a.get("title") or "").lower() or "fisica quantistica" in (a.get("title") or "").lower()),
            None,
        )
        assert target is not None, "No article with 'Biofisica' or 'Fisica quantistica' in title found"
        summary = target.get("summary", "")
        assert len(summary) >= 1500, f"summary too short: {len(summary)}"
        # Expect at least one of the reference names/keywords
        keywords = ["Fritz-Albert Popp", "Emilio Del Giudice", "coerenza", "biofoton"]
        matches = [k for k in keywords if k.lower() in summary.lower()]
        assert matches, f"None of {keywords} found in biofisica article summary"


# ----- Bug 2: images present on every article -----
class TestArticleImages:
    def test_all_articles_have_image_url(self, articles):
        missing = [a.get("title") for a in articles if not (a.get("image_url") or "").strip()]
        assert not missing, f"Articles missing image_url: {missing}"

    def test_fisica_quantistica_uses_new_unsplash(self, articles):
        fq = [a for a in articles if (a.get("category") or "").lower() == "fisica quantistica"]
        assert fq, "No article in 'Fisica quantistica' category"
        for a in fq:
            url = a.get("image_url", "")
            assert "unsplash.com" in url, f"Expected unsplash URL, got {url}"
        # At least one should be the new photo id
        assert any("1635070041078" in (a.get("image_url") or "") for a in fq), \
            "Expected at least one 'Fisica quantistica' article with the new Unsplash photo id 1635070041078"

    def test_image_urls_wellformed(self, articles):
        for a in articles:
            url = a.get("image_url", "")
            assert re.match(r"^https?://", url), f"malformed image_url for {a.get('title')}: {url}"


# ----- Bug 3: OG share endpoints -----
class TestShareEndpoints:
    def test_share_article_returns_og_html(self, client, articles):
        aid = articles[0]["id"]
        r = client.get(f"{API}/share/article/{aid}")
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "text/html" in ct, f"unexpected content-type: {ct}"
        body = r.text
        for tag in [
            'property="og:title"',
            'property="og:description"',
            'property="og:image"',
            'property="og:url"',
            'property="og:type"',
            'name="twitter:card"',
            'content="summary_large_image"',
            'name="twitter:image"',
        ]:
            assert tag in body, f"OG tag missing: {tag}"
        # Title of the article should appear in the HTML
        assert articles[0]["title"].split(":")[0][:20] in body

    def test_share_article_404(self, client):
        r = client.get(f"{API}/share/article/does-not-exist-xxxx")
        assert r.status_code == 404

    def test_share_media_returns_og_html(self, client, auth_headers):
        m = client.get(f"{API}/media", headers=auth_headers).json()
        media_list = m if isinstance(m, list) else (m.get("items") or m.get("media", []))
        assert media_list, "no media in db"
        mid = media_list[0]["id"]
        r = client.get(f"{API}/share/media/{mid}")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        body = r.text
        assert 'property="og:title"' in body
        assert 'property="og:image"' in body
        assert 'name="twitter:card"' in body

    def test_share_article_image_present_in_og(self, client, articles):
        aid = articles[0]["id"]
        r = client.get(f"{API}/share/article/{aid}")
        m = re.search(r'property="og:image"\s+content="([^"]+)"', r.text)
        assert m, "og:image tag not found"
        assert m.group(1).startswith("http"), f"og:image not absolute url: {m.group(1)}"


# ----- Regression -----
class TestRegression:
    def test_search_medita(self, client, auth_headers):
        r = client.get(f"{API}/search", params={"q": "medita"}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        # response has articles & media keys
        assert "articles" in data or "media" in data or isinstance(data, list)

    def test_me_stats_shape(self, client, admin_token):
        r = client.get(f"{API}/me/stats", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        d = r.json()
        for k in ["articles_read", "meditations", "minutes_meditated", "current_streak", "longest_streak", "badges"]:
            assert k in d, f"missing key {k} in /me/stats"

    def test_referrals_me_admin(self, client, admin_token):
        r = client.get(f"{API}/referrals/me", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        assert r.json().get("code") == "MAESTRO-2026"

    def test_favorites_toggle(self, client, admin_token, articles):
        aid = articles[0]["id"]
        headers = {"Authorization": f"Bearer {admin_token}"}
        # toggle on
        r1 = client.post(f"{API}/favorites/toggle", json={"content_type": "article", "content_id": aid}, headers=headers)
        assert r1.status_code == 200, r1.text
        # toggle off
        r2 = client.post(f"{API}/favorites/toggle", json={"content_type": "article", "content_id": aid}, headers=headers)
        assert r2.status_code == 200

    def test_media_meditation_soundhelix(self, client, auth_headers):
        r = client.get(f"{API}/media", params={"kind": "meditation"}, headers=auth_headers)
        assert r.status_code == 200
        data = r.json()
        lst = data if isinstance(data, list) else (data.get("items") or data.get("media", []))
        assert lst, "no meditation media"
        assert any("SoundHelix" in (m.get("media_url") or "") or "soundhelix" in (m.get("media_url") or "").lower() for m in lst)
