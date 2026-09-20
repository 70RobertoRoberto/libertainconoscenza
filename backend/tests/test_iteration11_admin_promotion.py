"""Iteration 11 — admin-promotion regression tests.

Verifies that:
- Test admin (+393331234567 / Admin2026!) still logs in — regression.
- User +393455119796 (Roberto) is now an admin with a premium subscription.
- `is_admin=True` users count is exactly 2 via GET /api/admin/users.
- Duplicate-phone protection on /api/auth/register (one phone == one account).
- Self-delete on /api/admin/users/{id} returns 400 (safety guard).
- Both admins are still present at the end of the run (state must be preserved).

The tests are read-only w.r.t. persistent data — no admin is deleted or modified.
"""
import os
import uuid
import pytest
import requests

def _load_base_url() -> str:
    url = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
    if not url:
        # Read from frontend/.env as fallback (public preview URL).
        try:
            with open("/app/frontend/.env", "r") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
        except FileNotFoundError:
            pass
    assert url, "EXPO_PUBLIC_BACKEND_URL not set (env or /app/frontend/.env)"
    return url.rstrip("/")


BASE_URL = _load_base_url()

TEST_ADMIN_PHONE = "+393331234567"
TEST_ADMIN_PASSWORD = "Admin2026!"
REAL_USER_ADMIN_PHONE = "+393455119796"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(api):
    r = api.post(
        f"{BASE_URL}/api/auth/login",
        json={"phone": TEST_ADMIN_PHONE, "password": TEST_ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert body.get("access_token"), "no access_token in login response"
    assert body.get("user", {}).get("is_admin") is True, "test admin user.is_admin must be True"
    return body["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def users_list(api, admin_headers):
    r = api.get(f"{BASE_URL}/api/admin/users", headers=admin_headers, timeout=15)
    assert r.status_code == 200, f"/admin/users returned {r.status_code}: {r.text}"
    body = r.json()
    assert "items" in body and isinstance(body["items"], list)
    return body["items"]


# --- Regression: test admin can still log in --------------------------------
class TestTestAdminLoginRegression:
    def test_login_returns_200_and_is_admin(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"phone": TEST_ADMIN_PHONE, "password": TEST_ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["phone"] == TEST_ADMIN_PHONE
        assert data["user"]["is_admin"] is True


# --- Real user promoted to admin --------------------------------------------
class TestRobertoIsAdmin:
    def test_roberto_present_in_admin_users_list(self, users_list):
        matches = [u for u in users_list if u["phone"] == REAL_USER_ADMIN_PHONE]
        assert len(matches) == 1, (
            f"expected exactly one user with phone {REAL_USER_ADMIN_PHONE}, "
            f"got {len(matches)}"
        )

    def test_roberto_is_admin_flag_true(self, users_list):
        roberto = next(u for u in users_list if u["phone"] == REAL_USER_ADMIN_PHONE)
        assert roberto["is_admin"] is True, f"Roberto.is_admin != True: {roberto}"

    def test_roberto_has_premium_subscription(self, users_list):
        roberto = next(u for u in users_list if u["phone"] == REAL_USER_ADMIN_PHONE)
        sub = roberto.get("subscription") or {}
        assert sub.get("status") == "premium", (
            f"Roberto.subscription.status != 'premium', got: {sub}"
        )


# --- Exactly 2 admins in the collection -------------------------------------
class TestAdminCount:
    def test_exactly_two_is_admin_true(self, users_list):
        admins = [u for u in users_list if u.get("is_admin") is True]
        phones = sorted(u["phone"] for u in admins)
        assert len(admins) == 2, (
            f"expected exactly 2 admins, got {len(admins)}: {phones}"
        )
        assert TEST_ADMIN_PHONE in phones
        assert REAL_USER_ADMIN_PHONE in phones


# --- Duplicate-phone protection on registration -----------------------------
class TestDuplicatePhoneRegistration:
    def test_register_existing_phone_returns_4xx(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "phone": REAL_USER_ADMIN_PHONE,
                "password": "AnyPwd123!",
                "name": "Duplicate Attempt",
            },
            timeout=15,
        )
        assert 400 <= r.status_code < 500, (
            f"expected 4xx for duplicate phone, got {r.status_code}: {r.text}"
        )
        # Server currently returns 409
        assert r.status_code in (400, 409), (
            f"expected 400/409 for duplicate phone, got {r.status_code}"
        )

    def test_register_existing_test_admin_phone_returns_4xx(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "phone": TEST_ADMIN_PHONE,
                "password": "AnyPwd123!",
                "name": "Duplicate Attempt 2",
            },
            timeout=15,
        )
        assert r.status_code in (400, 409)


# --- Self-delete safety guard -----------------------------------------------
class TestSelfDeleteGuard:
    def test_admin_cannot_delete_self(self, api, admin_headers):
        # Fetch caller id via /auth/me
        r = api.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        me_id = r.json()["id"]

        r = api.delete(
            f"{BASE_URL}/api/admin/users/{me_id}", headers=admin_headers, timeout=15
        )
        assert r.status_code == 400, (
            f"expected 400 when admin tries to delete self, got {r.status_code}: {r.text}"
        )
        # Optional: message check (Italian)
        try:
            detail = r.json().get("detail", "")
            assert "te stesso" in detail.lower() or "yourself" in detail.lower(), (
                f"unexpected error detail: {detail}"
            )
        except Exception:
            pass

    def test_delete_nonexistent_user_returns_404(self, api, admin_headers):
        bogus = str(uuid.uuid4())
        r = api.delete(
            f"{BASE_URL}/api/admin/users/{bogus}", headers=admin_headers, timeout=15
        )
        assert r.status_code == 404, f"expected 404, got {r.status_code}: {r.text}"


# --- Final state preservation -----------------------------------------------
class TestFinalState:
    def test_both_admins_still_exist(self, api, admin_headers):
        r = api.get(f"{BASE_URL}/api/admin/users", headers=admin_headers, timeout=15)
        assert r.status_code == 200
        items = r.json()["items"]
        admins = [u for u in items if u.get("is_admin") is True]
        phones = sorted(u["phone"] for u in admins)
        assert TEST_ADMIN_PHONE in phones, "test admin missing at end of run"
        assert REAL_USER_ADMIN_PHONE in phones, "roberto admin missing at end of run"
        assert len(admins) == 2, f"admin count changed to {len(admins)}"

    def test_test_admin_login_still_works(self, api):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"phone": TEST_ADMIN_PHONE, "password": TEST_ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200, "regression: test admin login broken at end"
