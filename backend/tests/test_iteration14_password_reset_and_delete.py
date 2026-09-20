"""Iteration 14 backend tests:
- Password reset request flow (public + admin)
- Self-service account deletion (/auth/delete-me)
- Admin protection: admin cannot delete themselves.
"""
import os
import random
import string
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set in frontend/.env"

ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


def _rand_suffix(n=6):
    return "".join(random.choices(string.digits, k=n))


def _new_phone():
    # Unique italian mobile
    return f"+393312{_rand_suffix(6)}"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


def _register(s, phone=None, password="Passw0rd!", name="Testino"):
    phone = phone or _new_phone()
    r = s.post(f"{BASE_URL}/api/auth/register",
               json={"phone": phone, "password": password, "name": name})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    body = r.json()
    tok = body.get("access_token") or body.get("token")
    return {"phone": phone, "password": password, "name": name, "token": tok, "id": body["user"]["id"]}


# ---------------------------------------------------------------------------
# 1. Password reset request (public)
# ---------------------------------------------------------------------------
class TestPasswordResetRequest:
    def test_existing_phone_creates_record(self, s, admin_token):
        user = _register(s)
        r = s.post(f"{BASE_URL}/api/auth/password-reset-request",
                   json={"phone": user["phone"], "note": "TEST_iter14"})
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert "Se il numero è registrato" in body.get("message", "")

        # admin should see it in pending list
        lst = s.get(f"{BASE_URL}/api/admin/password-reset-requests",
                    headers={"Authorization": f"Bearer {admin_token}"})
        assert lst.status_code == 200
        items = lst.json()["items"]
        matching = [it for it in items if it["phone"] == user["phone"]]
        assert len(matching) >= 1
        assert matching[0]["status"] == "pending"

    def test_nonexistent_phone_returns_same_generic_message_but_no_record(self, s, admin_token):
        fake_phone = f"+393991{_rand_suffix(6)}"
        r = s.post(f"{BASE_URL}/api/auth/password-reset-request", json={"phone": fake_phone})
        assert r.status_code == 200
        assert "Se il numero è registrato" in r.json().get("message", "")

        lst = s.get(f"{BASE_URL}/api/admin/password-reset-requests",
                    headers={"Authorization": f"Bearer {admin_token}"})
        assert lst.status_code == 200
        items = lst.json()["items"]
        assert not any(it["phone"] == fake_phone for it in items), "should NOT create a record for unknown phone"


# ---------------------------------------------------------------------------
# 2. Admin listing / admin reset flow
# ---------------------------------------------------------------------------
class TestAdminResetFlow:
    def test_admin_list_requires_auth(self, s):
        r = s.get(f"{BASE_URL}/api/admin/password-reset-requests")
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_admin_list_forbidden_for_regular_user(self, s):
        user = _register(s)
        r = s.get(f"{BASE_URL}/api/admin/password-reset-requests",
                  headers={"Authorization": f"Bearer {user['token']}"})
        assert r.status_code == 403

    def test_admin_reset_flow_updates_password_and_marks_done(self, s, admin_token):
        # user submits reset request
        user = _register(s)
        r = s.post(f"{BASE_URL}/api/auth/password-reset-request", json={"phone": user["phone"]})
        assert r.status_code == 200

        # get req id via admin listing
        lst = s.get(f"{BASE_URL}/api/admin/password-reset-requests",
                    headers={"Authorization": f"Bearer {admin_token}"})
        items = lst.json()["items"]
        pending = [it for it in items if it["phone"] == user["phone"] and it["status"] == "pending"]
        assert pending, "expected pending request"
        req_id = pending[0]["id"]

        # admin resets user password
        new_pw = "NewT3mpPass!"
        r = s.post(f"{BASE_URL}/api/admin/reset-user-password",
                   headers={"Authorization": f"Bearer {admin_token}"},
                   json={"user_id": user["id"], "new_password": new_pw, "request_id": req_id})
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # user should now be able to login with the new password
        lg = s.post(f"{BASE_URL}/api/auth/login", json={"phone": user["phone"], "password": new_pw})
        assert lg.status_code == 200, lg.text

        # old password should fail
        old = s.post(f"{BASE_URL}/api/auth/login", json={"phone": user["phone"], "password": user["password"]})
        assert old.status_code == 401

        # request should be marked done with resolved_at
        lst2 = s.get(f"{BASE_URL}/api/admin/password-reset-requests",
                     headers={"Authorization": f"Bearer {admin_token}"})
        items2 = lst2.json()["items"]
        this = [it for it in items2 if it["id"] == req_id][0]
        assert this["status"] == "done"
        assert this.get("resolved_at")

    def test_admin_reset_requires_admin(self, s):
        user = _register(s)
        target = _register(s)
        r = s.post(f"{BASE_URL}/api/admin/reset-user-password",
                   headers={"Authorization": f"Bearer {user['token']}"},
                   json={"user_id": target["id"], "new_password": "SomePass123!"})
        assert r.status_code in (401, 403)


# ---------------------------------------------------------------------------
# 3. Self-service delete-me
# ---------------------------------------------------------------------------
class TestDeleteMe:
    def test_wrong_password_returns_400(self, s):
        user = _register(s)
        r = s.post(f"{BASE_URL}/api/auth/delete-me",
                   headers={"Authorization": f"Bearer {user['token']}"},
                   json={"current_password": "WrongPass!"})
        assert r.status_code == 400
        assert "Password errata" in r.text

    def test_delete_me_success_cascade(self, s):
        user = _register(s, name="TEST_delme")
        uid = user["id"]
        tok = user["token"]
        h = {"Authorization": f"Bearer {tok}"}

        # Create a favorite (need an article id). Use articles listing.
        arts = s.get(f"{BASE_URL}/api/articles")
        art_id = None
        if arts.status_code == 200:
            data = arts.json()
            items = data if isinstance(data, list) else data.get("items", [])
            if items:
                art_id = items[0]["id"]
        if art_id:
            s.post(f"{BASE_URL}/api/favorites", headers=h, json={"article_id": art_id})

        # delete-me
        r = s.post(f"{BASE_URL}/api/auth/delete-me",
                   headers=h,
                   json={"current_password": user["password"]})
        assert r.status_code == 200, r.text
        assert r.json().get("deleted", 0) == 1

        # login should now fail
        lg = s.post(f"{BASE_URL}/api/auth/login",
                    json={"phone": user["phone"], "password": user["password"]})
        assert lg.status_code == 401

        # old token no longer works
        me = s.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert me.status_code in (401, 404)

    def test_admin_cannot_self_delete(self, s, admin_token):
        r = s.post(f"{BASE_URL}/api/auth/delete-me",
                   headers={"Authorization": f"Bearer {admin_token}"},
                   json={"current_password": ADMIN_PASSWORD})
        assert r.status_code == 400
        assert "amministratori" in r.text.lower() or "amministrator" in r.text.lower()

        # admin should still be able to login (unchanged)
        lg = s.post(f"{BASE_URL}/api/auth/login",
                    json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD})
        assert lg.status_code == 200


# ---------------------------------------------------------------------------
# 4. Contact-email content (terms/privacy files — quick sanity check)
# ---------------------------------------------------------------------------
def test_contact_email_updated_in_static_files():
    for p in ["/app/frontend/app/terms.tsx", "/app/frontend/app/privacy.tsx"]:
        with open(p) as f:
            content = f.read()
        assert "info@scienzebiofisiche.it" in content, f"new email missing in {p}"
        assert "info@conoscenzaaperta.it" not in content, f"old email still present in {p}"
