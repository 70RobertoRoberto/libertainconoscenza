"""Iteration 12 tests: /api/share/article/{id} CTA now has a web fallback.

The bug fixed by the main agent: when the recipient of a shared article link
does NOT have the native app installed, tapping the CTA on the OpenGraph
preview page used to do nothing (only a `conoscenzaaperta://` deep-link). The
fix in _og_html:
  (a) primary CTA "Iscriviti ora" -> attempts deep link via `tryDeepLink()`
      and falls back to /register after ~1.4s
  (b) secondary CTA "Apri sul web" -> straight to /register on same host
  (c) "Hai già un account? Accedi" link -> /login on same host
  (d) inline JS defines a `webUrl` variable pointing to the /register web URL
  (e) web fallback URL host must equal the host of the incoming request

Also regression:
  - unknown article id -> 404
  - GET /api/articles listing OK
  - GET /api/articles/{id} OK
  - all OG meta tags still emitted
"""
import os
import re
from urllib.parse import urlparse

import pytest
import requests


def _load_env():
    if "EXPO_PUBLIC_BACKEND_URL" in os.environ:
        return
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    os.environ.setdefault(k, v.strip('"').strip("'"))
    except FileNotFoundError:
        pass


_load_env()
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = BASE_URL + "/api"
EXPECTED_HOST = urlparse(BASE_URL).netloc  # host visible from the outside
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
    assert isinstance(lst, list) and lst, "no seed articles"
    return lst


@pytest.fixture(scope="module")
def share_html(client, articles):
    aid = articles[0]["id"]
    r = client.get(f"{API}/share/article/{aid}")
    assert r.status_code == 200, r.text
    assert "text/html" in r.headers.get("content-type", "")
    # Assert charset=utf-8 exposed in Content-Type
    assert "utf-8" in r.headers.get("content-type", "").lower()
    return r.text


# ---------- Iteration 12 bug fix ----------
class TestShareCTAFallback:
    def test_primary_cta_iscriviti_ora_present(self, share_html):
        assert "Iscriviti ora" in share_html, "primary CTA 'Iscriviti ora' missing"

    def test_secondary_cta_apri_sul_web_present(self, share_html):
        assert "Apri sul web" in share_html, "secondary CTA 'Apri sul web' missing"

    def test_login_link_present(self, share_html):
        assert "Hai già un account? Accedi" in share_html, "login link missing"

    def test_tryDeepLink_function_present(self, share_html):
        # Function declaration must exist (either name form)
        assert re.search(r"function\s+tryDeepLink\s*\(", share_html), \
            "inline JS function tryDeepLink() missing"

    def test_deep_link_string_present(self, share_html):
        # Must contain the exact scheme prefix; ref query param present
        assert "conoscenzaaperta://register?ref=" in share_html, \
            "deep link 'conoscenzaaperta://register?ref=' missing"

    def test_web_fallback_register_url_same_host(self, share_html):
        # There must be at least one /register URL and it must use the
        # exact same host as the incoming request (external host).
        urls = re.findall(r'https?://[^"\s<>]+/register\b', share_html)
        assert urls, "no web fallback URL ending with /register found"
        for u in urls:
            netloc = urlparse(u).netloc
            assert netloc == EXPECTED_HOST, (
                f"/register URL host mismatch: got {netloc!r}, expected {EXPECTED_HOST!r} "
                f"(full url: {u})"
            )

    def test_js_webUrl_variable_points_to_register(self, share_html):
        # regression: previously only deepLink was set inline; webUrl must
        # exist as a JS variable AND point to /register on the same host.
        m = re.search(r'var\s+webUrl\s*=\s*"([^"]+)"', share_html)
        assert m, "inline JS variable `var webUrl = \"...\"` missing"
        val = m.group(1)
        parsed = urlparse(val)
        assert parsed.path.endswith("/register"), f"webUrl not /register: {val}"
        assert parsed.netloc == EXPECTED_HOST, \
            f"webUrl host mismatch: got {parsed.netloc}, expected {EXPECTED_HOST}"

    def test_login_url_same_host(self, share_html):
        # The 'Accedi' link should point to /login on the same host
        m = re.search(r'href="(https?://[^"]+/login)"', share_html)
        assert m, "login href with absolute /login URL missing"
        assert urlparse(m.group(1)).netloc == EXPECTED_HOST


# ---------- OG meta tags regression ----------
class TestShareOGMeta:
    def test_all_og_and_twitter_tags(self, share_html):
        for tag in [
            'property="og:title"',
            'property="og:description"',
            'property="og:image"',
            'property="og:url"',
            'name="twitter:card"',
            'content="summary_large_image"',
        ]:
            assert tag in share_html, f"missing meta tag: {tag}"


# ---------- 404 regression ----------
class TestShare404:
    def test_unknown_id_returns_404(self, client):
        r = client.get(f"{API}/share/article/does-not-exist-xxxxxx")
        assert r.status_code == 404


# ---------- Articles endpoints regression ----------
class TestArticlesRegression:
    def test_articles_list(self, articles):
        # Fixture already asserted status 200 and non-empty
        assert all("id" in a and "title" in a for a in articles)

    def test_article_detail_by_id(self, client, articles, auth_headers):
        aid = articles[0]["id"]
        r = client.get(f"{API}/articles/{aid}", headers=auth_headers)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("id") == aid
        assert data.get("title") == articles[0]["title"]
