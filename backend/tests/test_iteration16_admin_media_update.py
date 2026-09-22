"""
Iteration 16 — Test the new PUT /api/admin/media/{media_id} endpoint.

Covers:
  - Admin login
  - Partial update (title, thumbnail_url, is_premium, duration_sec)
  - Persistence verification via GET /media/{id}
  - Category validation (400)
  - Meditation category validation (400)
  - Auth: missing token -> 401
  - Auth: non-admin user -> 403
  - 404 for non-existent id
  - Restore original values (teardown)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: try reading /app/frontend/.env
    try:
        with open("/app/frontend/.env", "r") as f:
            for line in f:
                if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")
                    break
    except Exception:
        pass

API = f"{BASE_URL}/api"

ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


# --- fixtures ---------------------------------------------------------------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def regular_user(session):
    """Register a fresh non-admin user, return (token, phone)."""
    phone = f"+3934{uuid.uuid4().int % 10**8:08d}"
    payload = {"phone": phone, "password": "Password123!", "name": "TEST_regular"}
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return r.json()["access_token"], phone


@pytest.fixture(scope="module")
def target_media(session, admin_headers):
    """Pick an existing meditation media (fallback: any media). Return the full doc."""
    # /media requires auth -> use admin token
    r = session.get(f"{API}/media", headers=admin_headers)
    assert r.status_code == 200, f"list media failed: {r.status_code} {r.text}"
    items = r.json().get("items") or r.json()
    assert isinstance(items, list) and len(items) > 0, "no media in DB to test with"
    med = next((m for m in items if m.get("kind") == "meditation"), items[0])
    return med


# --- tests ------------------------------------------------------------------
class TestAdminMediaUpdate:

    def test_01_admin_login(self, admin_token):
        assert admin_token and isinstance(admin_token, str)

    def test_02_list_media_pick_target(self, target_media):
        assert "id" in target_media
        assert "title" in target_media

    def test_03_update_partial_fields(self, session, admin_headers, target_media):
        mid = target_media["id"]
        body = {
            "title": "TEST_Nuovo titolo test",
            "thumbnail_url": "https://example.com/test.jpg",
            "is_premium": True,
            "duration_sec": 600,
        }
        r = session.put(f"{API}/admin/media/{mid}", json=body, headers=admin_headers)
        assert r.status_code == 200, f"update failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["id"] == mid
        assert data["title"] == "TEST_Nuovo titolo test"
        assert data["thumbnail_url"] == "https://example.com/test.jpg"
        assert data["is_premium"] is True
        assert data["duration_sec"] == 600

    def test_04_get_confirms_persistence(self, session, admin_headers, target_media):
        mid = target_media["id"]
        r = session.get(f"{API}/media/{mid}", headers=admin_headers)
        assert r.status_code == 200, f"get failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["title"] == "TEST_Nuovo titolo test"
        assert data["thumbnail_url"] == "https://example.com/test.jpg"
        assert data["is_premium"] is True
        assert data["duration_sec"] == 600

    def test_05_invalid_category_returns_400(self, session, admin_headers, target_media):
        mid = target_media["id"]
        r = session.put(
            f"{API}/admin/media/{mid}",
            json={"category": "FakeCategory"},
            headers=admin_headers,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_06_invalid_meditation_category_returns_400(self, session, admin_headers, target_media):
        mid = target_media["id"]
        r = session.put(
            f"{API}/admin/media/{mid}",
            json={"meditation_category": "NotARealMeditationCategory"},
            headers=admin_headers,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_07_missing_token_returns_401_or_403(self, session, target_media):
        mid = target_media["id"]
        r = requests.put(f"{API}/admin/media/{mid}", json={"title": "x"})
        assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text}"

    def test_08_non_admin_user_returns_403(self, session, regular_user, target_media):
        token, _phone = regular_user
        mid = target_media["id"]
        r = requests.put(
            f"{API}/admin/media/{mid}",
            json={"title": "hacker"},
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_09_nonexistent_id_returns_404(self, session, admin_headers):
        r = session.put(
            f"{API}/admin/media/nonexistent-id-xyz-123",
            json={"title": "nope"},
            headers=admin_headers,
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"

    def test_10_restore_original_values(self, session, admin_headers, target_media):
        """Restore the fields we mutated back to the original values captured before mutation."""
        mid = target_media["id"]
        restore = {
            "title": target_media.get("title"),
            "thumbnail_url": target_media.get("thumbnail_url"),
            "is_premium": bool(target_media.get("is_premium", False)),
            "duration_sec": target_media.get("duration_sec"),
        }
        # drop None values that would be ignored anyway
        restore = {k: v for k, v in restore.items() if v is not None}
        r = session.put(f"{API}/admin/media/{mid}", json=restore, headers=admin_headers)
        assert r.status_code == 200, f"restore failed: {r.status_code} {r.text}"
        data = r.json()
        assert data["title"] == target_media["title"]
        assert bool(data.get("is_premium", False)) == bool(target_media.get("is_premium", False))
