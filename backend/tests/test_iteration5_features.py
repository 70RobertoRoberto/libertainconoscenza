"""
Iteration 5 backend tests.
Covers:
  - Personal Stats:       GET /api/me/stats
  - Streak-3 badge via seeded views (Motor direct)
  - Admin Comments list:  GET /api/admin/comments
  - Admin Comments delete DELETE /api/admin/comments/{id}
  - Regression sanity of iteration-4 endpoints
"""
import os
import uuid
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"

# --- shared fixtures ---------------------------------------------------------


def _login(phone: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"phone": phone, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {phone} -> {r.status_code} {r.text}"
    b = r.json()
    return b.get("access_token") or b.get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN_PHONE, ADMIN_PASSWORD)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def admin_me(admin_headers):
    r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def free_user_headers():
    """Register/login a non-admin user to test 403 paths."""
    phone = f"+39333955{uuid.uuid4().int % 10000:04d}"
    pw = "Test2026!"
    r = requests.post(
        f"{API}/auth/register",
        json={"phone": phone, "password": pw, "name": "TEST_FreeUser"},
        timeout=15,
    )
    assert r.status_code in (200, 409), r.text
    if r.status_code == 409:
        tok = _login(phone, pw)
    else:
        tok = r.json().get("access_token") or r.json().get("token")
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def sample_article_id(admin_headers):
    r = requests.get(f"{API}/articles", headers=admin_headers, timeout=15)
    items = r.json().get("items", [])
    assert items
    return items[0]["id"]


# --- Personal Stats ----------------------------------------------------------
class TestPersonalStats:
    def test_stats_shape_and_sensible_values(self, admin_headers, sample_article_id):
        # Force at least one article view + a couple of meditation views so admin has data
        requests.get(f"{API}/articles/{sample_article_id}", headers=admin_headers, timeout=15)
        med = requests.get(f"{API}/media", params={"kind": "meditation"}, headers=admin_headers, timeout=15).json().get("items", [])
        for m in med[:3]:
            requests.get(f"{API}/media/{m['id']}", headers=admin_headers, timeout=15)

        r = requests.get(f"{API}/me/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        for k in ("articles_read", "meditations", "minutes_meditated",
                  "current_streak", "longest_streak", "badges"):
            assert k in b, f"missing {k} in {b}"
        assert isinstance(b["badges"], list)
        assert b["articles_read"] >= 1, b
        assert b["meditations"] >= 1, b
        # seed has two meditations of 600 and 1500 sec -> at least 25min if both viewed;
        # be permissive but non-zero.
        assert b["minutes_meditated"] >= 10, b
        assert b["current_streak"] >= 1, b

    def test_stats_requires_auth(self):
        r = requests.get(f"{API}/me/stats", timeout=15)
        assert r.status_code in (401, 403)


# --- Badge streak3 via seeded views -----------------------------------------
class TestStreak3Badge:
    """Seed 3 consecutive-day view rows for a fresh user, then assert streak3 badge."""

    @pytest.fixture(scope="class")
    def seeded(self):
        # Fresh user
        phone = f"+39333944{uuid.uuid4().int % 10000:04d}"
        pw = "Test2026!"
        r = requests.post(
            f"{API}/auth/register",
            json={"phone": phone, "password": pw, "name": "TEST_StreakUser"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        tok = r.json()["access_token"]
        user_id = r.json()["user"]["id"]
        headers = {"Authorization": f"Bearer {tok}"}

        # Insert 3 view rows directly via motor across today/yesterday/2-days-ago
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
        db_name = os.environ.get("DB_NAME", "conoscenza_aperta")

        async def seed():
            client = AsyncIOMotorClient(mongo_url)
            db = client[db_name]
            today = datetime.now(timezone.utc).date()
            for i in range(3):
                d = today - timedelta(days=i)
                await db.views.insert_one({
                    "id": f"TEST_view_{uuid.uuid4().hex[:8]}",
                    "content_id": f"TEST_content_{i}",
                    "content_type": "article",
                    "user_id": user_id,
                    "date": d.isoformat(),
                    "ts": datetime.now(timezone.utc).isoformat(),
                })
            client.close()

        asyncio.get_event_loop().run_until_complete(seed())
        return headers, user_id

    def test_streak3_badge_unlocked(self, seeded):
        headers, _uid = seeded
        r = requests.get(f"{API}/me/stats", headers=headers, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b["current_streak"] >= 3, b
        keys = [x["key"] for x in b["badges"]]
        assert "streak3" in keys, f"streak3 not in {keys}"


# --- Admin Comments moderation ----------------------------------------------
class TestAdminComments:
    def test_list_requires_admin(self, free_user_headers):
        r = requests.get(f"{API}/admin/comments", headers=free_user_headers, timeout=15)
        assert r.status_code == 403, r.status_code

    def test_list_ok_admin(self, admin_headers, sample_article_id):
        # ensure at least one comment exists
        c = requests.post(
            f"{API}/comments",
            headers=admin_headers,
            json={"content_id": sample_article_id, "content_type": "article",
                  "body": "TEST_admin_view"},
            timeout=15,
        )
        assert c.status_code == 200
        cid = c.json()["id"]

        r = requests.get(f"{API}/admin/comments", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "items" in body
        items = body["items"]
        assert isinstance(items, list) and len(items) >= 1

        # each item must have required fields
        top = items[0]
        for k in ("id", "user_id", "user_name", "content_id",
                  "content_type", "body", "created_at", "content_title"):
            assert k in top, f"missing {k} in {top}"

        # order desc by created_at
        if len(items) >= 2:
            assert items[0]["created_at"] >= items[1]["created_at"]

        # cleanup
        requests.delete(f"{API}/admin/comments/{cid}", headers=admin_headers, timeout=15)

    def test_delete_ok_admin(self, admin_headers, sample_article_id):
        c = requests.post(
            f"{API}/comments",
            headers=admin_headers,
            json={"content_id": sample_article_id, "content_type": "article",
                  "body": "TEST_admin_delete"},
            timeout=15,
        )
        assert c.status_code == 200, c.text
        cid = c.json()["id"]

        r = requests.delete(f"{API}/admin/comments/{cid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        # subsequent delete -> 404
        r2 = requests.delete(f"{API}/admin/comments/{cid}", headers=admin_headers, timeout=15)
        assert r2.status_code == 404

    def test_delete_forbidden_non_admin(self, admin_headers, free_user_headers, sample_article_id):
        c = requests.post(
            f"{API}/comments",
            headers=admin_headers,
            json={"content_id": sample_article_id, "content_type": "article",
                  "body": "TEST_admin_delete_forbidden"},
            timeout=15,
        )
        assert c.status_code == 200
        cid = c.json()["id"]
        r = requests.delete(f"{API}/admin/comments/{cid}", headers=free_user_headers, timeout=15)
        assert r.status_code == 403, r.status_code
        # cleanup as admin
        requests.delete(f"{API}/admin/comments/{cid}", headers=admin_headers, timeout=15)

    def test_delete_missing_404(self, admin_headers):
        r = requests.delete(
            f"{API}/admin/comments/does-not-exist-{uuid.uuid4().hex[:8]}",
            headers=admin_headers, timeout=15
        )
        assert r.status_code == 404


# --- Regression sanity -------------------------------------------------------
class TestRegression:
    def test_articles(self, admin_headers):
        assert requests.get(f"{API}/articles", headers=admin_headers, timeout=15).status_code == 200

    def test_media(self, admin_headers):
        assert requests.get(f"{API}/media", headers=admin_headers, timeout=15).status_code == 200

    def test_favorites(self, admin_headers):
        assert requests.get(f"{API}/favorites", headers=admin_headers, timeout=15).status_code == 200

    def test_search(self, admin_headers):
        r = requests.get(f"{API}/search", params={"q": "medita"}, headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_referrals_me(self, admin_headers):
        r = requests.get(f"{API}/referrals/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["code"] == "MAESTRO-2026"

    def test_admin_users(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_admin_stats(self, admin_headers):
        assert requests.get(f"{API}/admin/stats/summary", headers=admin_headers, timeout=15).status_code == 200
