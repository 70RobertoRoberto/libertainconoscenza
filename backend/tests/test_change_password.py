"""Tests for POST /api/auth/change-password endpoint."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://integral-wellness-2.preview.emergentagent.com").rstrip("/")
ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


class TestChangePasswordValidation:
    def test_wrong_current_password_returns_400(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=auth_headers(admin_token),
            json={"current_password": "WrongPass123!", "new_password": "NewPass456!"},
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "attuale errata" in detail.lower() or "password attuale errata" in detail.lower(), f"Detail: {detail}"

    def test_short_new_password_returns_422(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=auth_headers(admin_token),
            json={"current_password": ADMIN_PASSWORD, "new_password": "abc"},
            timeout=15,
        )
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"

    def test_same_new_password_returns_400_with_diversa(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=auth_headers(admin_token),
            json={"current_password": ADMIN_PASSWORD, "new_password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail", "")
        assert "diversa" in detail.lower(), f"Detail should contain 'diversa': {detail}"

    def test_missing_authorization_returns_401(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Content-Type": "application/json"},
            json={"current_password": ADMIN_PASSWORD, "new_password": "NewPass456!"},
            timeout=15,
        )
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"


class TestChangePasswordSuccess:
    """Verify happy path AND restore original password afterwards."""

    def test_change_password_success_and_login_flip(self):
        # Login with the original password
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200
        token = r.json()["access_token"]

        new_pw = "TempNew2026!"

        # Change password
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=auth_headers(token),
            json={"current_password": ADMIN_PASSWORD, "new_password": new_pw},
            timeout=15,
        )
        assert r.status_code == 200, f"change-password failed: {r.status_code} {r.text}"
        assert r.json() == {"ok": True}

        # OLD password should no longer work
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 401, f"Old password still works! status={r.status_code}"

        # NEW password should work
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": ADMIN_PHONE, "password": new_pw}, timeout=15)
        assert r.status_code == 200, f"New password login failed: {r.status_code} {r.text}"
        new_token = r.json()["access_token"]

        # Restore original password
        r = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=auth_headers(new_token),
            json={"current_password": new_pw, "new_password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert r.status_code == 200, f"Failed to restore password: {r.status_code} {r.text}"

        # Sanity: original password works again
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD}, timeout=15)
        assert r.status_code == 200, "Original admin password not restored"
