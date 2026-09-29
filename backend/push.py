"""Push notifications helper.

Wraps the Emergent managed push service. Fire-and-forget: callers never
block on push delivery.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from deps import EMERGENT_PUSH_KEY, PUSH_BASE_URL, db

logger = logging.getLogger("conoscenza")


push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": EMERGENT_PUSH_KEY},
    timeout=10.0,
)

# Backwards-compat alias (server.py used _push_client).
_push_client = push_client


async def send_push_bg(recipients: list, title: str, message: str, action_url: Optional[str] = None):
    """Fire-and-forget: never blocks the caller."""
    if not recipients:
        return
    try:
        for i in range(0, len(recipients), 100):
            chunk = recipients[i : i + 100]
            data = {"title": title, "message": message}
            if action_url:
                data["action_url"] = action_url
            resp = await push_client.post(
                "/api/v1/push/trigger",
                json={"recipients": chunk, "data": data},
            )
            if resp.status_code >= 400:
                logger.warning(f"Push trigger returned {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        logger.warning(f"Push send failed (non-blocking): {e}")


async def all_user_ids(exclude: Optional[str] = None) -> list:
    ids = []
    async for u in db.users.find({}, {"_id": 0, "id": 1}):
        if u["id"] != exclude:
            ids.append(u["id"])
    return ids


# Backwards-compat alias.
_all_user_ids = all_user_ids
