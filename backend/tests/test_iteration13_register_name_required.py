"""
Iteration 13 backend tests:
- name field mandatory on POST /api/auth/register (min length 2)
- regression: duplicate phone still rejected
- regression: admin login still works
"""
import os
import random
import string

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
           os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")

ADMIN_PHONE = "+393331234567"
ADMIN_PASSWORD = "Admin2026!"


def _rand_phone() -> str:
    suffix = "".join(random.choices(string.digits, k=5))
    return f"+3933312{suffix}"


# --- Missing name / null name ---
def test_register_missing_name_returns_422():
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"phone": _rand_phone(), "password": "abcdef"},
        timeout=15,
    )
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"


def test_register_null_name_returns_422():
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"phone": _rand_phone(), "password": "abcdef", "name": None},
        timeout=15,
    )
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"


# --- Empty / short name ---
def test_register_empty_name_returns_422():
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"phone": _rand_phone(), "password": "abcdef", "name": ""},
        timeout=15,
    )
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"


def test_register_single_char_name_returns_422():
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"phone": _rand_phone(), "password": "abcdef", "name": "A"},
        timeout=15,
    )
    assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"


# --- Valid registration ---
def test_register_valid_name_returns_200_and_persists():
    phone = _rand_phone()
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"phone": phone, "password": "abcdef", "name": "Mario"},
        timeout=15,
    )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert "access_token" in body
    assert body.get("user", {}).get("name") == "Mario"
    assert body.get("user", {}).get("phone") == phone

    # Verify via /auth/me
    token = body["access_token"]
    me = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert me.status_code == 200
    assert me.json().get("name") == "Mario"


# --- Regression: duplicate phone rejected ---
def test_register_duplicate_phone_returns_409():
    phone = _rand_phone()
    payload = {"phone": phone, "password": "abcdef", "name": "Mario"}
    r1 = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
    assert r1.status_code == 200
    r2 = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
    assert r2.status_code == 409, f"expected 409 on duplicate, got {r2.status_code}: {r2.text}"


# --- Regression: admin login ---
def test_admin_login_still_works():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"phone": ADMIN_PHONE, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    body = r.json()
    assert "access_token" in body
    assert body.get("user", {}).get("is_admin") is True
