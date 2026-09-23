"""
Iteration 17 — Video Categories feature (BACKEND ONLY)
Tests the 7 VIDEO_CATEGORIES with up-to-2 tagging on media of kind=video.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://integral-wellness-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_PHONE = "+393331234567"
ADMIN_PASS = "Admin2026!"

EXPECTED_CATS = [
    "Fisica Quantistica",
    "Psicologia e Neuroscienze",
    "Coscienza e Spiritualità",
    "Medicina Complementare",
    "Somatognostica",
    "Discipline Naturali e Orientali",
    "Interviste",
]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"phone": ADMIN_PHONE, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def state():
    return {}


# ---- 1. Login already covered by fixture ----

# ---- 2. GET /api/video-categories returns 7 items ----
def test_02_list_video_categories(headers, state):
    r = requests.get(f"{API}/video-categories", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "items" in body
    items = body["items"]
    assert len(items) == 7, f"Expected 7 cats, got {len(items)}"
    names = [it["name"] for it in items]
    assert names == EXPECTED_CATS, f"Order/names mismatch: {names}"
    for it in items:
        assert "name" in it and "slug" in it and "count" in it
        assert isinstance(it["count"], int)
    state["initial_counts"] = {it["name"]: it["count"] for it in items}


# ---- 3. Create test video with 2 categories ----
def test_03_create_video_with_two_categories(headers, state):
    payload = {
        "title": "TEST_Video_Categories_iter17",
        "description": "Test video for categories feature",
        "kind": "video",
        "category": "Video",
        "media_url": "https://example.com/test-video.mp4",
        "video_categories": ["Fisica Quantistica", "Interviste"],
        "is_premium": False,
    }
    r = requests.post(f"{API}/admin/media", headers=headers, json=payload, timeout=30)
    assert r.status_code == 200, f"Create failed: {r.status_code} {r.text}"
    body = r.json()
    assert body["kind"] == "video"
    assert body["video_categories"] == ["Fisica Quantistica", "Interviste"]
    assert body["title"] == payload["title"]
    assert "id" in body
    state["video_id"] = body["id"]


# ---- 4. GET /api/media/{id} confirms categories ----
def test_04_get_media_returns_categories(headers, state):
    vid = state["video_id"]
    r = requests.get(f"{API}/media/{vid}", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == vid
    assert set(body["video_categories"]) == {"Fisica Quantistica", "Interviste"}


# ---- 5. Filter by video_category=Fisica Quantistica ----
def test_05_filter_fisica_quantistica(headers, state):
    r = requests.get(
        f"{API}/media",
        params={"kind": "video", "video_category": "Fisica Quantistica"},
        headers=headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    ids = [it["id"] for it in items]
    assert state["video_id"] in ids, f"Test video missing from Fisica Quantistica filter. ids={ids}"


# ---- 6. Filter by video_category=Interviste ----
def test_06_filter_interviste(headers, state):
    r = requests.get(
        f"{API}/media",
        params={"kind": "video", "video_category": "Interviste"},
        headers=headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    ids = [it["id"] for it in items]
    assert state["video_id"] in ids


# ---- 7. Filter by Somatognostica -> should NOT contain the test video ----
def test_07_filter_somatognostica_excludes(headers, state):
    r = requests.get(
        f"{API}/media",
        params={"kind": "video", "video_category": "Somatognostica"},
        headers=headers,
        timeout=30,
    )
    assert r.status_code == 200, r.text
    ids = [it["id"] for it in r.json()["items"]]
    assert state["video_id"] not in ids


# ---- 8. Counts increased by 1 for Fisica Quantistica and Interviste ----
def test_08_counts_incremented(headers, state):
    r = requests.get(f"{API}/video-categories", headers=headers, timeout=30)
    assert r.status_code == 200
    new_counts = {it["name"]: it["count"] for it in r.json()["items"]}
    init = state["initial_counts"]
    assert new_counts["Fisica Quantistica"] == init["Fisica Quantistica"] + 1, (
        f"FQ: was {init['Fisica Quantistica']} now {new_counts['Fisica Quantistica']}"
    )
    assert new_counts["Interviste"] == init["Interviste"] + 1, (
        f"Interviste: was {init['Interviste']} now {new_counts['Interviste']}"
    )
    # unrelated categories unchanged
    for c in ["Psicologia e Neuroscienze", "Coscienza e Spiritualità", "Medicina Complementare",
              "Somatognostica", "Discipline Naturali e Orientali"]:
        assert new_counts[c] == init[c], f"{c} count changed unexpectedly"


# ---- 9. PUT reduces to single category ----
def test_09_update_single_category(headers, state):
    vid = state["video_id"]
    r = requests.put(
        f"{API}/admin/media/{vid}",
        headers=headers,
        json={"video_categories": ["Interviste"]},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["video_categories"] == ["Interviste"]

    # Confirm via GET
    r2 = requests.get(f"{API}/media/{vid}", headers=headers, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["video_categories"] == ["Interviste"]


# ---- 10. POST validation: 3 items -> 400 ----
def test_10_post_reject_three_items(headers):
    payload = {
        "title": "TEST_iter17_invalid_three",
        "description": "",
        "kind": "video",
        "category": "Video",
        "media_url": "https://example.com/x.mp4",
        "video_categories": ["Fisica Quantistica", "Interviste", "Somatognostica"],
        "is_premium": False,
    }
    r = requests.post(f"{API}/admin/media", headers=headers, json=payload, timeout=30)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    assert "massimo 2 categorie video" in r.text.lower() or "massimo 2" in r.text.lower(), r.text


# ---- 11. POST validation: invalid name -> 400 ----
def test_11_post_reject_invalid_name(headers):
    payload = {
        "title": "TEST_iter17_invalid_name",
        "description": "",
        "kind": "video",
        "category": "Video",
        "media_url": "https://example.com/x.mp4",
        "video_categories": ["Invalid Name"],
        "is_premium": False,
    }
    r = requests.post(f"{API}/admin/media", headers=headers, json=payload, timeout=30)
    assert r.status_code == 400, f"Expected 400, got {r.status_code}: {r.text}"
    assert "categoria video non valida" in r.text.lower(), r.text


# ---- 12. PUT validation: 3 items and invalid name -> 400 ----
def test_12_put_validation(headers, state):
    vid = state["video_id"]
    r1 = requests.put(
        f"{API}/admin/media/{vid}",
        headers=headers,
        json={"video_categories": ["Fisica Quantistica", "Interviste", "Somatognostica"]},
        timeout=30,
    )
    assert r1.status_code == 400, f"Expected 400 for 3 items, got {r1.status_code}: {r1.text}"
    assert "massimo 2" in r1.text.lower()

    r2 = requests.put(
        f"{API}/admin/media/{vid}",
        headers=headers,
        json={"video_categories": ["NotACategory"]},
        timeout=30,
    )
    assert r2.status_code == 400, f"Expected 400 for invalid name, got {r2.status_code}: {r2.text}"
    assert "categoria video non valida" in r2.text.lower()


# ---- 13. Cleanup delete ----
def test_13_cleanup_delete(headers, state):
    vid = state.get("video_id")
    if not vid:
        pytest.skip("No video created")
    r = requests.delete(f"{API}/admin/media/{vid}", headers=headers, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("deleted", 0) >= 1

    # Confirm gone
    r2 = requests.get(f"{API}/media/{vid}", headers=headers, timeout=30)
    assert r2.status_code == 404
