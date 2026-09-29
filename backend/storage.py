"""Object storage helpers (Emergent Object Storage).

Stateful: caches the storage key at module level. This module MUST be a
single shared instance across the whole app to avoid duplicate/inconsistent
caches.
"""
from __future__ import annotations

import logging
from typing import Optional

import requests
from fastapi import HTTPException

from deps import EMERGENT_LLM_KEY, STORAGE_URL

logger = logging.getLogger("conoscenza")

_storage_key: Optional[str] = None


def init_storage_sync() -> str:
    global _storage_key
    if _storage_key:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object_sync(path: str, data: bytes, content_type: str) -> dict:
    global _storage_key
    key = init_storage_sync()
    try:
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data,
            timeout=300,
        )
        if resp.status_code == 503:
            _storage_key = None
            key = init_storage_sync()
            resp = requests.put(
                f"{STORAGE_URL}/objects/{path}",
                headers={"X-Storage-Key": key, "Content-Type": content_type},
                data=data,
                timeout=300,
            )
        resp.raise_for_status()
    except requests.HTTPError as e:
        raise HTTPException(e.response.status_code, f"Storage error: {e.response.text[:200]}")
    return resp.json()


def get_object_sync(path: str) -> tuple[bytes, str]:
    global _storage_key
    key = init_storage_sync()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    if resp.status_code == 503:
        _storage_key = None
        key = init_storage_sync()
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=120)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# Backwards-compat aliases (server.py used underscore-prefixed names).
_init_storage_sync = init_storage_sync
_put_object_sync = put_object_sync
_get_object_sync = get_object_sync
