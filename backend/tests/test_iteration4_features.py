"""
Iteration 4 backend tests.
Covers new features:
  - Search: /api/search?q= (articles + media, min 2 chars)
  - Comments: /api/comments POST/GET/DELETE
  - Completions & Certificate: /api/completions (idempotent) + /api/certificate/{id}
  - Referral: /api/referrals/me, register with referral_code
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login {r.status_code}: {r.text}"
    b = r.json()
    return b.get("access_token") or b.get("token")


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def admin_me(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def sample_article_id(admin_headers):
    r = requests.get(f"{API}/articles", headers=admin_headers, timeout=15)
    items = r.json().get("items", [])
    assert items
    return items[0]["id"]


@pytest.fixture(scope="module")
def meditation_media_id(admin_headers):
    r = requests.get(f"{API}/media?kind=meditation", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    items = r.json().get("items", [])
    assert items, "No meditation media"
    # prefer the 10-min guided meditation
    for m in items:
        if "respiro" in (m.get("title") or "").lower():
            return m["id"]
    return items[0]["id"]


# ---------------- Search ----------------
class TestSearch:
    def test_search_medita(self, admin_headers):
        r = requests.get(f"{API}/search", params={"q": "medita"}, headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "articles" in body and "media" in body
        assert isinstance(body["articles"], list)
        assert isinstance(body["media"], list)
        assert len(body["articles"]) >= 3, f"expected >=3 articles, got {len(body['articles'])}: {[a.get('title') for a in body['articles']]}"
        assert len(body["media"]) >= 2, f"expected >=2 media, got {len(body['media'])}: {[m.get('title') for m in body['media']]}"

    def test_search_case_insensitive(self, admin_headers):
        r1 = requests.get(f"{API}/search", params={"q": "MEDITA"}, headers=admin_headers, timeout=15)
        r2 = requests.get(f"{API}/search", params={"q": "medita"}, headers=admin_headers, timeout=15)
        assert r1.status_code == 200 and r2.status_code == 200
        assert len(r1.json()["articles"]) == len(r2.json()["articles"])

    def test_search_short_q_rejected(self, admin_headers):
        r = requests.get(f"{API}/search", params={"q": "a"}, headers=admin_headers, timeout=15)
        assert r.status_code == 422, r.status_code

    def test_search_requires_auth(self):
        r = requests.get(f"{API}/search", params={"q": "medita"}, timeout=15)
        assert r.status_code in (401, 403)


# ---------------- Comments ----------------
class TestComments:
    _created_id = None

    def test_post_comment(self, admin_headers, sample_article_id):
        r = requests.post(
            f"{API}/comments",
            headers=admin_headers,
            json={"content_id": sample_article_id, "content_type": "article", "body": "TEST_ciao"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["body"] == "TEST_ciao"
        assert body["content_id"] == sample_article_id
        assert body["content_type"] == "article"
        assert "id" in body and "user_name" in body
        TestComments._created_id = body["id"]

    def test_list_comments_desc(self, admin_headers, sample_article_id):
        # add a second comment quickly
        time.sleep(1)
        r2 = requests.post(
            f"{API}/comments",
            headers=admin_headers,
            json={"content_id": sample_article_id, "content_type": "article", "body": "TEST_second"},
            timeout=15,
        )
        assert r2.status_code == 200
        second_id = r2.json()["id"]

        r = requests.get(f"{API}/comments", params={"content_id": sample_article_id}, headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 2
        # newest first
        assert items[0]["created_at"] >= items[1]["created_at"]
        # cleanup extra
        requests.delete(f"{API}/comments/{second_id}", headers=admin_headers, timeout=15)

    def test_invalid_content_type(self, admin_headers, sample_article_id):
        r = requests.post(
            f"{API}/comments",
            headers=admin_headers,
            json={"content_id": sample_article_id, "content_type": "wrong", "body": "x"},
            timeout=15,
        )
        assert r.status_code == 400

    def test_delete_own_comment(self, admin_headers):
        assert TestComments._created_id, "no created id from prior test"
        r = requests.delete(f"{API}/comments/{TestComments._created_id}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True


# ---------------- Completions + Certificate ----------------
class TestCompletions:
    def test_mark_completion_and_idempotent(self, admin_headers, meditation_media_id):
        # first call -> may return already:true if a previous run already marked it
        r = requests.post(
            f"{API}/completions",
            headers=admin_headers,
            json={"content_id": meditation_media_id, "content_type": "media"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        b1 = r.json()
        assert b1.get("ok") is True or b1.get("already") is True

        # second call -> must be idempotent
        r2 = requests.post(
            f"{API}/completions",
            headers=admin_headers,
            json={"content_id": meditation_media_id, "content_type": "media"},
            timeout=15,
        )
        assert r2.status_code == 200
        assert r2.json().get("already") is True

    def test_list_completions_includes(self, admin_headers, meditation_media_id):
        r = requests.get(f"{API}/completions", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        ids = [c["content_id"] for c in r.json()["items"]]
        assert meditation_media_id in ids

    def test_certificate_data(self, admin_headers, meditation_media_id):
        r = requests.get(f"{API}/certificate/{meditation_media_id}", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert set(b.keys()) >= {"user_name", "title", "category", "completed_at", "certificate_id"}
        assert b["title"]
        assert b["user_name"]

    def test_certificate_404_when_not_completed(self, admin_headers):
        r = requests.get(f"{API}/certificate/does-not-exist-{uuid.uuid4().hex[:8]}", headers=admin_headers, timeout=15)
        assert r.status_code == 404


# ---------------- Referral ----------------
class TestReferral:
    fresh_phone = "+393330000001"
    fresh_password = "Test2026!"

    def test_admin_referrals_me(self, admin_headers):
        r = requests.get(f"{API}/referrals/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["code"] == "MAESTRO-2026", f"expected MAESTRO-2026, got {b['code']}"
        assert isinstance(b["count"], int)
        assert isinstance(b["invited"], list)

    def test_register_with_admin_referral_increments_count(self, admin_headers):
        # capture pre-count
        pre = requests.get(f"{API}/referrals/me", headers=admin_headers, timeout=15).json()["count"]

        # register a fresh user (unique phone) with referral MAESTRO-2026
        # ensure digits-only tail (uuid4.int → decimal), Italian mobile format
        unique = f"+39333811{uuid.uuid4().int % 10000:04d}"
        r = requests.post(
            f"{API}/auth/register",
            json={
                "phone": unique,
                "password": self.fresh_password,
                "name": "TEST_ReferralUser",
                "referral_code": "MAESTRO-2026",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        b = r.json()
        assert "access_token" in b
        assert b["user"]["referral_code"], "new user should get own referral_code"

        # post-count should have increased by 1
        post = requests.get(f"{API}/referrals/me", headers=admin_headers, timeout=15).json()["count"]
        assert post == pre + 1, f"pre={pre}, post={post}"

    def test_register_with_bogus_code_silently_ok(self):
        unique = f"+39333822{uuid.uuid4().int % 10000:04d}"
        r = requests.post(
            f"{API}/auth/register",
            json={
                "phone": unique,
                "password": "Test2026!",
                "name": "TEST_BogusRef",
                "referral_code": "NO-SUCH-CODE-XYZ",
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        # user gets own code even without valid referrer
        assert r.json()["user"]["referral_code"]

    def test_register_fresh_user_for_frontend(self):
        """Register the phone the frontend test agent expects. Don't delete after."""
        r = requests.post(
            f"{API}/auth/register",
            json={
                "phone": self.fresh_phone,
                "password": self.fresh_password,
                "name": "TEST_Fresh",
                "referral_code": "MAESTRO-2026",
            },
            timeout=15,
        )
        # 200 first time or 409 if already exists in prior run
        assert r.status_code in (200, 409), r.text


# ---------------- Regression sanity ----------------
class TestRegression:
    def test_articles(self, admin_headers):
        r = requests.get(f"{API}/articles", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_media(self, admin_headers):
        r = requests.get(f"{API}/media", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_favorites(self, admin_headers):
        r = requests.get(f"{API}/favorites", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_coupons_list(self, admin_headers):
        r = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_admin_stats(self, admin_headers):
        r = requests.get(f"{API}/admin/stats/summary", headers=admin_headers, timeout=15)
        assert r.status_code == 200
