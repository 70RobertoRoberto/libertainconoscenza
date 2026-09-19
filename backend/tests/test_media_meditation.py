"""
Tests for the guided-meditation fix.
Verifies:
  - Media list contains the 10-min meditation with SoundHelix URL
  - Media detail endpoint returns proper fields
  - The audio URL itself responds 200 with audio/mpeg
  - Premium meditation is accessible to admin (with premium sub)
"""
import os
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"

EXPECTED_FREE_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
EXPECTED_PREMIUM_URL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
FREE_TITLE = "Meditazione guidata: respiro e presenza"
PREMIUM_TITLE = "Meditazione premium: viaggio interiore profondo"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(
        f"{API}/auth/login",
        json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    body = r.json()
    return body.get("access_token") or body.get("token")


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Media list ---
def test_media_list_returns_meditations(auth_headers):
    r = requests.get(f"{API}/media?kind=meditation", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data.get("items", [])
    assert len(items) >= 2, f"Expected at least 2 meditations, got {len(items)}"
    titles = [i["title"] for i in items]
    assert FREE_TITLE in titles, f"Missing '{FREE_TITLE}' in {titles}"


def test_free_meditation_has_soundhelix_url(auth_headers):
    r = requests.get(f"{API}/media?kind=meditation", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    items = r.json()["items"]
    free = next((i for i in items if i["title"] == FREE_TITLE), None)
    assert free is not None
    assert free["media_url"] == EXPECTED_FREE_URL, (
        f"media_url mismatch. Got: {free['media_url']}"
    )
    assert free.get("duration_sec") == 600
    assert free.get("kind") == "meditation"
    assert free.get("is_premium") in (False, None)


def test_premium_meditation_has_soundhelix_url(auth_headers):
    r = requests.get(f"{API}/media?kind=meditation", headers=auth_headers, timeout=15)
    items = r.json()["items"]
    prem = next((i for i in items if i["title"] == PREMIUM_TITLE), None)
    assert prem is not None, f"Premium meditation not found. Titles: {[i['title'] for i in items]}"
    assert prem["media_url"] == EXPECTED_PREMIUM_URL, prem["media_url"]
    assert prem.get("is_premium") is True


# --- Media detail ---
def test_media_detail_free_meditation(auth_headers):
    listing = requests.get(f"{API}/media?kind=meditation", headers=auth_headers).json()
    free = next(i for i in listing["items"] if i["title"] == FREE_TITLE)
    r = requests.get(f"{API}/media/{free['id']}", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["title"] == FREE_TITLE
    assert detail["media_url"] == EXPECTED_FREE_URL
    assert detail["duration_sec"] == 600
    assert detail["kind"] == "meditation"
    assert "description" in detail and detail["description"]


def test_media_detail_premium_accessible_to_admin(auth_headers):
    listing = requests.get(f"{API}/media?kind=meditation", headers=auth_headers).json()
    prem = next(i for i in listing["items"] if i["title"] == PREMIUM_TITLE)
    r = requests.get(f"{API}/media/{prem['id']}", headers=auth_headers, timeout=15)
    assert r.status_code == 200, f"Admin should access premium media, got {r.status_code}: {r.text}"
    detail = r.json()
    assert detail["media_url"] == EXPECTED_PREMIUM_URL


def test_view_count_increments_on_detail(auth_headers):
    listing = requests.get(f"{API}/media?kind=meditation", headers=auth_headers).json()
    free = next(i for i in listing["items"] if i["title"] == FREE_TITLE)
    before = requests.get(f"{API}/media/{free['id']}", headers=auth_headers).json()
    after = requests.get(f"{API}/media/{free['id']}", headers=auth_headers).json()
    assert after["views"] >= before["views"] + 1, (
        f"views did not increment: before={before['views']} after={after['views']}"
    )


# --- Free user should get 402 on premium ---
def test_premium_meditation_blocks_free_user(auth_headers):
    import uuid
    phone = f"+3933399{uuid.uuid4().int % 100000:05d}"
    reg = requests.post(
        f"{API}/auth/register",
        json={"phone": phone, "password": "TestPass123!", "name": "TEST_free"},
        timeout=15,
    )
    if reg.status_code not in (200, 201):
        pytest.skip(f"Could not register free user: {reg.status_code} {reg.text}")
    body = reg.json()
    free_token = body.get("access_token") or body.get("token")
    free_headers = {"Authorization": f"Bearer {free_token}"}

    listing = requests.get(f"{API}/media?kind=meditation", headers=free_headers).json()
    prem = next((i for i in listing["items"] if i["title"] == PREMIUM_TITLE), None)
    assert prem is not None
    r = requests.get(f"{API}/media/{prem['id']}", headers=free_headers, timeout=15)
    assert r.status_code == 402, f"Expected 402 for free user on premium, got {r.status_code}: {r.text}"


# --- Direct audio URL reachability ---
def test_soundhelix_audio_url_reachable():
    r = requests.get(EXPECTED_FREE_URL, stream=True, timeout=20, allow_redirects=True)
    assert r.status_code == 200, f"Audio URL not reachable: {r.status_code}"
    ctype = r.headers.get("Content-Type", "").lower()
    assert "audio" in ctype or "mpeg" in ctype, f"Unexpected content-type: {ctype}"
    r.close()


def test_soundhelix_premium_audio_url_reachable():
    r = requests.get(EXPECTED_PREMIUM_URL, stream=True, timeout=20, allow_redirects=True)
    assert r.status_code == 200
    r.close()
