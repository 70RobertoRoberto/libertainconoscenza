"""Backend tests for YouTube import + Ads system (iteration 2)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://integral-wellness-2.preview.emergentagent.com").rstrip("/")
ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# --- Sanity / regression ---
class TestSanity:
    def test_categories(self):
        r = requests.get(f"{BASE_URL}/api/categories", timeout=15)
        assert r.status_code == 200
        assert "Video" in r.json()["categories"]

    def test_auth_me(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        u = r.json()
        assert u["is_admin"] is True

    def test_articles_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/articles", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert "items" in r.json()

    def test_media_list(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/media", headers=admin_headers, timeout=15)
        assert r.status_code == 200

    def test_stats_summary(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/stats/summary", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        for k in ("users", "articles", "media", "total_views"):
            assert k in r.json()


# --- YouTube Import ---
class TestYouTubeImport:
    def test_import_summaaurea_channel(self, admin_headers):
        body = {"channel_url": "https://www.youtube.com/@SUMMAAUREA", "category": "Video", "is_premium": False}
        r = requests.post(f"{BASE_URL}/api/admin/media/import-youtube", headers=admin_headers, json=body, timeout=60)
        assert r.status_code == 200, f"Import failed: {r.status_code} {r.text}"
        data = r.json()
        assert "imported" in data and "skipped" in data and "total" in data
        assert data["channel_id"].startswith("UC")
        assert data["total"] > 0
        # sum matches
        assert data["imported"] + data["skipped"] == data["total"]

    def test_import_duplicate_skips(self, admin_headers):
        body = {"channel_url": "https://www.youtube.com/@SUMMAAUREA", "category": "Video", "is_premium": False}
        r = requests.post(f"{BASE_URL}/api/admin/media/import-youtube", headers=admin_headers, json=body, timeout=60)
        assert r.status_code == 200
        data = r.json()
        # Second run must skip everything already inserted
        assert data["imported"] == 0
        assert data["skipped"] == data["total"]

    def test_imported_media_shape(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/media?kind=video", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        yt_items = [m for m in items if m["media_url"].startswith("https://www.youtube.com/watch?v=")]
        assert len(yt_items) >= 10, f"Expected >=10 YT videos, got {len(yt_items)}"
        # thumbnails from i.ytimg.com
        has_ytimg = any("ytimg.com" in (m.get("thumbnail_url") or "") for m in yt_items)
        assert has_ytimg, "No thumbnails from ytimg.com"

    def test_import_invalid_url(self, admin_headers):
        body = {"channel_url": "https://not-youtube.com/x", "category": "Video"}
        r = requests.post(f"{BASE_URL}/api/admin/media/import-youtube", headers=admin_headers, json=body, timeout=30)
        # Expect 400 (channel not found) or 500 (fetch error)
        assert r.status_code in (400, 500), f"Expected 400/500, got {r.status_code}"

    def test_import_requires_admin(self):
        r = requests.post(f"{BASE_URL}/api/admin/media/import-youtube", json={"channel_url": "x"}, timeout=15)
        assert r.status_code == 401


# --- Ads ---
class TestAds:
    created_id = None

    def test_create_ad(self, admin_headers):
        body = {
            "image_url": "https://images.unsplash.com/photo-1500673922987-e212871fec22?w=800",
            "caption": "TEST_ad backend",
            "click_url": "https://example.com",
            "is_active": True,
        }
        r = requests.post(f"{BASE_URL}/api/admin/ads", headers=admin_headers, json=body, timeout=15)
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert "id" in data
        assert data["image_url"] == body["image_url"]
        assert data["is_active"] is True
        TestAds.created_id = data["id"]

    def test_list_active_ads(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/ads/active", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(a["id"] == TestAds.created_id for a in items)

    def test_admin_list_ads(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/ads", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(a["id"] == TestAds.created_id for a in items)

    def test_toggle_ad(self, admin_headers):
        assert TestAds.created_id
        r = requests.post(f"{BASE_URL}/api/admin/ads/{TestAds.created_id}/toggle", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        # verify inactive now
        r = requests.get(f"{BASE_URL}/api/ads/active", headers=admin_headers, timeout=15)
        items = r.json()["items"]
        assert not any(a["id"] == TestAds.created_id for a in items), "Ad should be inactive after toggle"

    def test_delete_ad(self, admin_headers):
        assert TestAds.created_id
        r = requests.delete(f"{BASE_URL}/api/admin/ads/{TestAds.created_id}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["deleted"] == 1
        # verify gone
        r = requests.get(f"{BASE_URL}/api/admin/ads", headers=admin_headers, timeout=15)
        items = r.json()["items"]
        assert not any(a["id"] == TestAds.created_id for a in items)

    def test_ads_require_auth(self):
        r = requests.get(f"{BASE_URL}/api/ads/active", timeout=15)
        assert r.status_code == 401
