"""Iteration 10 - Phone normalization on login/register + change-password regression."""
import os
import uuid
import pytest
import requests
from pathlib import Path


def _load_backend_url():
    for key in ("EXPO_PUBLIC_BACKEND_URL", "EXPO_BACKEND_URL"):
        v = os.environ.get(key)
        if v:
            return v.rstrip("/")
    env_path = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not configured")


BASE_URL = _load_backend_url()

API = f"{BASE_URL}/api"

ADMIN_PHONE_CLEAN = "+393331234567"
ADMIN_PHONE_SPACES = "+39 333 1234567"
ADMIN_PWD = "Admin2026!"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Login: phone normalization ----------
class TestLoginPhoneNormalization:
    def test_login_admin_clean_phone(self, client):
        r = client.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE_CLEAN, "password": ADMIN_PWD}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and data["access_token"]
        assert data.get("user", {}).get("is_admin") is True

    def test_login_admin_phone_with_spaces(self, client):
        r = client.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE_SPACES, "password": ADMIN_PWD}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and data["access_token"]
        assert data.get("user", {}).get("is_admin") is True

    def test_login_admin_phone_with_dashes_and_dots(self, client):
        # backend strips  . - ( ) whitespace
        r = client.post(f"{API}/auth/login", json={"phone": "+39.333-123.4567", "password": ADMIN_PWD}, timeout=15)
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()

    def test_login_wrong_password_still_401(self, client):
        r = client.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE_SPACES, "password": "wrong-pwd-xxx"}, timeout=15)
        assert r.status_code in (400, 401), r.text


# ---------- Register: phone normalization ----------
class TestRegisterPhoneNormalization:
    def test_register_with_spaces(self, client):
        # Use random 9-digit suffix for uniqueness
        suffix = str(uuid.uuid4().int)[:9]
        phone_spaced = f"+39 3{suffix[:2]} {suffix[2:5]} {suffix[5:]}"
        expected = "+393" + suffix  # what backend should store (no spaces)
        r = client.post(
            f"{API}/auth/register",
            json={"phone": phone_spaced, "password": "TestPwd123!", "name": "TEST_norm"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user"]["phone"] == expected, f"expected {expected} got {data['user']['phone']}"
        assert data.get("access_token")

        # verify we can login with the SAME spaced number
        r2 = client.post(f"{API}/auth/login", json={"phone": phone_spaced, "password": "TestPwd123!"}, timeout=15)
        assert r2.status_code == 200, r2.text
        assert r2.json()["user"]["phone"] == expected


# ---------- Change password regression ----------
class TestChangePasswordRegression:
    def _login(self, client, phone, pwd):
        r = client.post(f"{API}/auth/login", json={"phone": phone, "password": pwd}, timeout=15)
        assert r.status_code == 200, r.text
        return r.json()["access_token"]

    def test_wrong_current_password_returns_400(self, client):
        token = self._login(client, ADMIN_PHONE_CLEAN, ADMIN_PWD)
        r = client.post(
            f"{API}/auth/change-password",
            json={"current_password": "definitely-wrong", "new_password": "NewPwd2026!"},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 400, r.text

    def test_change_and_restore_admin_password(self, client):
        # Login with clean phone
        token = self._login(client, ADMIN_PHONE_CLEAN, ADMIN_PWD)
        temp_pwd = "TempPwd2026!"

        # Change to temp
        r = client.post(
            f"{API}/auth/change-password",
            json={"current_password": ADMIN_PWD, "new_password": temp_pwd},
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text

        # Confirm new password works
        r2 = client.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE_SPACES, "password": temp_pwd}, timeout=15)
        assert r2.status_code == 200, r2.text
        new_token = r2.json()["access_token"]

        # Restore original password
        r3 = client.post(
            f"{API}/auth/change-password",
            json={"current_password": temp_pwd, "new_password": ADMIN_PWD},
            headers={"Authorization": f"Bearer {new_token}"},
            timeout=15,
        )
        assert r3.status_code == 200, r3.text

        # Final verification: original admin login works again (with spaces variant)
        r4 = client.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE_SPACES, "password": ADMIN_PWD}, timeout=15)
        assert r4.status_code == 200, r4.text
