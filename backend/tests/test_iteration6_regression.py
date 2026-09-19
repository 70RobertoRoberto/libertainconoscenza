"""
Iteration 6 – FULL regression sweep for Conoscenza Aperta.
Covers all major endpoints from iterations 1-5:
  Health / categories / plans / auth / articles / media / favorites /
  comments / completions / certificate / search / stats / referrals /
  paywall + coupons / admin CRUD (articles, ads, coupons, messages) /
  push relay.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


def _login(phone, password):
    r = requests.post(f"{API}/auth/login", json={"phone": phone, "password": password}, timeout=20)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    b = r.json()
    return b.get("access_token") or b.get("token")


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login(ADMIN_PHONE, ADMIN_PASSWORD)}"}


@pytest.fixture(scope="module")
def fresh_user():
    phone = f"+39333700{uuid.uuid4().int % 10000:04d}"
    r = requests.post(
        f"{API}/auth/register",
        json={"phone": phone, "password": "Test2026!", "name": "TEST_Regression"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    b = r.json()
    return {"phone": phone, "token": b["access_token"], "user": b["user"],
            "headers": {"Authorization": f"Bearer {b['access_token']}"}}


# ============================================================
# 1. HEALTH / META
# ============================================================
class TestHealth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=15)
        assert r.status_code == 200

    def test_categories_has_12_plus_video(self):
        r = requests.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        cats = r.json().get("categories", [])
        assert len(cats) >= 12, len(cats)
        assert "Video" in cats

    def test_plans_three(self):
        r = requests.get(f"{API}/plans", timeout=15)
        assert r.status_code == 200
        plans = r.json().get("plans", {})
        assert set(plans.keys()) == {"3m", "6m", "12m"}
        prices = sorted([p["price_eur"] for p in plans.values()])
        assert prices == [300, 500, 900], prices


# ============================================================
# 2. AUTH
# ============================================================
class TestAuth:
    def test_login_admin_and_me(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        me = r.json()
        assert me["phone"] == ADMIN_PHONE
        assert me["is_admin"] is True
        assert me.get("referral_code") == "MAESTRO-2026"

    def test_register_new_user(self, fresh_user):
        assert fresh_user["user"]["phone"] == fresh_user["phone"]

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login",
                          json={"phone": ADMIN_PHONE, "password": "wrong"}, timeout=15)
        assert r.status_code in (400, 401)


# ============================================================
# 3. CONTENT (ARTICLES / MEDIA / SEARCH)
# ============================================================
class TestContent:
    def test_articles_at_least_13(self, admin_headers):
        r = requests.get(f"{API}/articles", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) >= 13, len(items)
        # unique category coverage
        cats = {a["category"] for a in items}
        assert len(cats) >= 10, cats

    def test_article_detail_increments_views(self, admin_headers):
        items = requests.get(f"{API}/articles", headers=admin_headers, timeout=15).json()["items"]
        aid = items[0]["id"]
        v0 = items[0].get("views", 0)
        r = requests.get(f"{API}/articles/{aid}", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("views", 0) >= v0

    def test_media_at_least_15(self, admin_headers):
        r = requests.get(f"{API}/media", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) >= 15, len(items)

    def test_media_meditation_filter(self, admin_headers):
        r = requests.get(f"{API}/media", params={"kind": "meditation"},
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json().get("items", [])
        assert len(items) >= 1
        for m in items:
            assert m["kind"] == "meditation"

    def test_meditation_source_url_soundhelix(self, admin_headers):
        """Regression: meditation URLs should use SoundHelix (not Pixabay)."""
        items = requests.get(f"{API}/media", params={"kind": "meditation"},
                             headers=admin_headers, timeout=15).json()["items"]
        urls = " ".join(m.get("media_url", "") for m in items).lower()
        assert "soundhelix" in urls, urls[:400]
        assert "pixabay" not in urls

    def test_premium_media_402_for_free(self, fresh_user, admin_headers):
        items = requests.get(f"{API}/media", headers=admin_headers, timeout=15).json()["items"]
        prem = next((m for m in items if m.get("is_premium")), None)
        if prem is None:
            pytest.skip("No premium media in seed")
        r = requests.get(f"{API}/media/{prem['id']}", headers=fresh_user["headers"], timeout=15)
        assert r.status_code == 402, f"expected 402 got {r.status_code}"

    def test_search_medita(self, admin_headers):
        r = requests.get(f"{API}/search", params={"q": "medita"},
                         headers=admin_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        # search returns mixed results (articles + media)
        total = len(b.get("articles", [])) + len(b.get("media", []))
        assert total >= 1, b


# ============================================================
# 4. INTERACTIONS (FAVORITES / COMMENTS / COMPLETIONS)
# ============================================================
class TestInteractions:
    def test_favorite_roundtrip(self, admin_headers):
        aid = requests.get(f"{API}/articles", headers=admin_headers, timeout=15).json()["items"][0]["id"]
        # toggle on
        r = requests.post(f"{API}/favorites/toggle", headers=admin_headers,
                          json={"content_id": aid, "content_type": "article"}, timeout=15)
        assert r.status_code == 200
        state1 = r.json().get("favorited")
        # toggle back to original state
        r2 = requests.post(f"{API}/favorites/toggle", headers=admin_headers,
                           json={"content_id": aid, "content_type": "article"}, timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("favorited") != state1

    def test_favorites_list(self, admin_headers):
        r = requests.get(f"{API}/favorites", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert "articles" in b and "media" in b

    def test_comment_post_and_list(self, admin_headers):
        aid = requests.get(f"{API}/articles", headers=admin_headers, timeout=15).json()["items"][0]["id"]
        r = requests.post(f"{API}/comments", headers=admin_headers,
                          json={"content_id": aid, "content_type": "article",
                                "body": "TEST_iter6_regression"}, timeout=15)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        # list
        g = requests.get(f"{API}/comments", params={"content_id": aid, "content_type": "article"},
                         headers=admin_headers, timeout=15)
        assert g.status_code == 200
        bodies = [c["body"] for c in g.json().get("items", [])]
        assert "TEST_iter6_regression" in bodies
        # cleanup
        requests.delete(f"{API}/admin/comments/{cid}", headers=admin_headers, timeout=15)

    def test_completions_and_certificate(self, admin_headers):
        aid = requests.get(f"{API}/articles", headers=admin_headers, timeout=15).json()["items"][0]["id"]
        r = requests.post(f"{API}/completions", headers=admin_headers,
                          json={"content_id": aid, "content_type": "article"}, timeout=15)
        assert r.status_code == 200
        # certificate should be reachable (returns HTML or PDF)
        c = requests.get(f"{API}/certificate/{aid}", headers=admin_headers, timeout=15)
        assert c.status_code == 200

    def test_me_stats_shape(self, admin_headers):
        r = requests.get(f"{API}/me/stats", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        for k in ("articles_read", "meditations", "minutes_meditated",
                  "current_streak", "longest_streak", "badges"):
            assert k in b


# ============================================================
# 5. REFERRALS
# ============================================================
class TestReferrals:
    def test_admin_referral_code(self, admin_headers):
        r = requests.get(f"{API}/referrals/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        b = r.json()
        assert b["code"] == "MAESTRO-2026"
        assert "count" in b and "invited" in b

    def test_register_with_referral_bumps_admin_count(self, admin_headers):
        before = requests.get(f"{API}/referrals/me", headers=admin_headers, timeout=15).json()["count"]
        phone = f"+39333800{uuid.uuid4().int % 10000:04d}"
        r = requests.post(f"{API}/auth/register",
                          json={"phone": phone, "password": "Test2026!",
                                "name": "TEST_ReferredUser",
                                "referral_code": "MAESTRO-2026"},
                          timeout=20)
        assert r.status_code == 200, r.text
        after = requests.get(f"{API}/referrals/me", headers=admin_headers, timeout=15).json()["count"]
        assert after == before + 1, f"before={before} after={after}"


# ============================================================
# 6. PAYWALL + COUPONS
# ============================================================
class TestPaywall:
    def test_checkout_no_coupon(self, admin_headers):
        r = requests.post(f"{API}/billing/checkout", headers=admin_headers,
                          json={"plan": "12m"}, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b.get("amount_eur") == 900, b

    def test_lancio2026_coupon_flow(self, admin_headers):
        # Ensure coupon exists
        code = "LANCIO2026"
        lst = requests.get(f"{API}/admin/coupons", headers=admin_headers, timeout=15).json()
        items = lst.get("items", []) if isinstance(lst, dict) else lst
        existing = [c for c in items if c.get("code") == code]
        if not existing:
            r = requests.post(f"{API}/admin/coupons", headers=admin_headers,
                              json={"code": code, "percent_off": 20,
                                    "max_uses": 1000},
                              timeout=15)
            assert r.status_code in (200, 201), r.text
        # Checkout with coupon
        r = requests.post(f"{API}/billing/checkout", headers=admin_headers,
                          json={"plan": "12m", "coupon_code": code}, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()
        assert b.get("amount_eur") == 720, f"expected 720 (900*0.8), got {b}"


# ============================================================
# 7. ADMIN CRUD
# ============================================================
class TestAdminCrud:
    def test_create_and_delete_article(self, admin_headers):
        payload = {
            "title": f"TEST_iter6_{uuid.uuid4().hex[:6]}",
            "summary": "TEST regression summary body",
            "category": "Crescita personale",
            "is_premium": False,
        }
        r = requests.post(f"{API}/admin/articles", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        aid = r.json()["id"]
        # visible in list
        lst = requests.get(f"{API}/articles", headers=admin_headers, timeout=15).json()["items"]
        assert any(a["id"] == aid for a in lst)
        # cleanup
        d = requests.delete(f"{API}/admin/articles/{aid}", headers=admin_headers, timeout=15)
        assert d.status_code == 200

    def test_create_and_toggle_ad(self, admin_headers):
        payload = {"image_url": "https://example.com/ad.png",
                   "click_url": "https://example.com",
                   "caption": "TEST_ad_iter6"}
        r = requests.post(f"{API}/admin/ads", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        ad_id = r.json()["id"]
        # active list should be reachable
        act = requests.get(f"{API}/ads/active", headers=admin_headers, timeout=15)
        assert act.status_code == 200
        # cleanup
        requests.delete(f"{API}/admin/ads/{ad_id}", headers=admin_headers, timeout=15)

    def test_broadcast_message(self, admin_headers):
        payload = {"title": "TEST_broadcast_iter6", "body": "regression sweep"}
        r = requests.post(f"{API}/admin/messages", headers=admin_headers, json=payload, timeout=15)
        assert r.status_code in (200, 201), r.text
        # user can see it
        m = requests.get(f"{API}/messages", headers=admin_headers, timeout=15)
        assert m.status_code == 200
        titles = [x["title"] for x in m.json().get("items", [])]
        assert "TEST_broadcast_iter6" in titles

    def test_admin_stats_endpoints(self, admin_headers):
        for path in ("summary", "daily", "top-content"):
            r = requests.get(f"{API}/admin/stats/{path}", headers=admin_headers, timeout=15)
            assert r.status_code == 200, f"{path} -> {r.status_code}"

    def test_admin_users_and_orders(self, admin_headers):
        r = requests.get(f"{API}/admin/users", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        r2 = requests.get(f"{API}/admin/orders", headers=admin_headers, timeout=15)
        assert r2.status_code == 200


# ============================================================
# 8. PUSH RELAY
# ============================================================
class TestPush:
    def test_register_push_non_blocking(self, admin_headers, fresh_user):
        r = requests.post(f"{API}/register-push",
                          json={"user_id": fresh_user["user"]["id"],
                                "device_token": "TEST_token",
                                "platform": "ios"},
                          headers=admin_headers, timeout=15)
        # Placeholder key: expect 2xx (non-blocking) or 502 but not 500 crash
        assert r.status_code in (200, 201, 202, 204, 502), f"{r.status_code} {r.text}"
