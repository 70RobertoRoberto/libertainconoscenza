"""
Daily background scheduler for subscription lifecycle emails and 6-month data purge.

Runs every day at 09:00 Europe/Rome (configurable via env `SUBSCRIPTION_CRON_HOUR`).

Flow (idempotent — safe to re-run same day):
  * 7 days before expiry AND auto_renew=True  → send `render_renewal_reminder_7d`
  * 1 day  before expiry AND auto_renew=True  → send `render_renewal_reminder_1d`
  * On expiry day AND auto_renew=True         → EXTEND expires_at by 12 months, send `render_renewed_thanks`
  * On expiry day AND auto_renew=False        → downgrade to free, set purge_at = today + 6 months, send `render_farewell_after_expire`
  * When purge_at < today (6 months after farewell) → wipe course progress + reset flag

We track sent-state under `subscription.reminders_sent` = {"7d": iso, "1d": iso, "renewed": iso, "farewell": iso}
so an email is never sent twice for the same expiry cycle. On renewal (extend), the map is reset.
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from emailer import (
    send_email,
    render_renewal_reminder_7d,
    render_renewal_reminder_1d,
    render_renewed_thanks,
    render_farewell_after_expire,
)

logger = logging.getLogger("conoscenza.scheduler")

_scheduler: Optional[AsyncIOScheduler] = None


# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------
def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(iso: Optional[str]) -> Optional[datetime]:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _days_until(target: datetime, ref: datetime) -> int:
    """Number of whole calendar days between `ref` (today) and `target`.
    Positive = target is in the future, Negative = in the past."""
    return (target.date() - ref.date()).days


def _add_months(dt: datetime, months: int) -> datetime:
    """Simple month addition preserving day when possible."""
    y = dt.year + (dt.month - 1 + months) // 12
    m = (dt.month - 1 + months) % 12 + 1
    # Clamp day to end of month
    import calendar
    d = min(dt.day, calendar.monthrange(y, m)[1])
    return dt.replace(year=y, month=m, day=d)


# ---------------------------------------------------------------------------
# Core job
# ---------------------------------------------------------------------------
async def run_subscription_lifecycle(db) -> dict:
    """Scan users and send lifecycle emails / apply renewals / purge stale data.
    Returns a summary dict (useful for testing and admin dashboard).
    """
    now = _now_utc()
    summary = {
        "checked": 0,
        "reminder_7d_sent": 0,
        "reminder_1d_sent": 0,
        "renewed": 0,
        "farewell_sent": 0,
        "purged": 0,
        "errors": 0,
        "ran_at": _iso(now),
    }

    cursor = db.users.find({
        "subscription.status": {"$in": ["premium", "trial"]},
        "subscription.expires_at": {"$ne": None},
    })
    async for u in cursor:
        summary["checked"] += 1
        try:
            await _process_user(db, u, now, summary)
        except Exception as e:
            summary["errors"] += 1
            logger.error(f"Subscription job failed for user {u.get('id')}: {e}")

    # NOTE: Data purge for expired users is NOT part of the automatic
    # scheduler anymore. Any hard delete of user progress must be triggered
    # explicitly by an admin via the dedicated admin endpoint (see
    # /api/admin/subscriptions/purge-expired), which itself is opt-in per
    # request. This keeps the daily cron 100% non-destructive.
    summary["purge_skipped_manual_only"] = True

    logger.info(f"[SUBSCRIPTION-CRON] {summary}")
    return summary


async def _process_user(db, u: dict, now: datetime, summary: dict):
    sub = u.get("subscription") or {}
    expires_at = _parse_iso(sub.get("expires_at"))
    if not expires_at:
        return
    auto_renew = bool(sub.get("auto_renew", True))
    reminders_sent = sub.get("reminders_sent") or {}

    email = u.get("email")
    name = u.get("first_name") or u.get("name") or "utente"
    days_left = _days_until(expires_at, now)

    # Skip users without a valid email — we cannot notify them
    if not email or "@" not in email:
        return

    # -------- 7 days before expiry (auto_renew only) --------
    if auto_renew and days_left == 7 and not reminders_sent.get("7d"):
        subj, html = render_renewal_reminder_7d(name, _iso(expires_at))
        await send_email(to=email, subject=subj, html=html)
        await _mark_reminder(db, u["id"], "7d", now)
        summary["reminder_7d_sent"] += 1
        return

    # -------- 1 day before expiry (auto_renew only) --------
    if auto_renew and days_left == 1 and not reminders_sent.get("1d"):
        subj, html = render_renewal_reminder_1d(name, _iso(expires_at))
        await send_email(to=email, subject=subj, html=html)
        await _mark_reminder(db, u["id"], "1d", now)
        summary["reminder_1d_sent"] += 1
        return

    # -------- Expiry day (days_left <= 0 and not yet processed) --------
    if days_left <= 0:
        if auto_renew and not reminders_sent.get("renewed"):
            # Mock renewal: extend expires_at by 12 months. When Stripe/PayPal is
            # wired, this should be replaced by an actual charge attempt.
            new_expiry = _add_months(expires_at, 12)
            await db.users.update_one(
                {"id": u["id"]},
                {"$set": {
                    "subscription.status": "premium",
                    "subscription.expires_at": _iso(new_expiry),
                    "subscription.reminders_sent": {},  # reset for next cycle
                    "subscription.last_renewed_at": _iso(now),
                }},
            )
            subj, html = render_renewed_thanks(name, _iso(new_expiry))
            await send_email(to=email, subject=subj, html=html)
            summary["renewed"] += 1
            logger.info(f"[SUBSCRIPTION-CRON] Renewed user={u['id']} new_expiry={_iso(new_expiry)}")
            return

        if (not auto_renew) and not reminders_sent.get("farewell"):
            purge_at = _add_months(now, 6)
            await db.users.update_one(
                {"id": u["id"]},
                {"$set": {
                    "subscription.status": "free",
                    "subscription.purge_at": _iso(purge_at),
                    f"subscription.reminders_sent.farewell": _iso(now),
                }},
            )
            subj, html = render_farewell_after_expire(name, _iso(purge_at))
            await send_email(to=email, subject=subj, html=html)
            summary["farewell_sent"] += 1
            logger.info(f"[SUBSCRIPTION-CRON] Farewell user={u['id']} purge_at={_iso(purge_at)}")
            return


async def _mark_reminder(db, user_id: str, key: str, now: datetime):
    await db.users.update_one(
        {"id": user_id},
        {"$set": {f"subscription.reminders_sent.{key}": _iso(now)}},
    )


async def _purge_user_progress(db, user_id: str):
    """Wipe course progress & related data after 6-month grace period.
    Keeps: account, email, referral code.
    Deletes: enrollments, quiz attempts, certificates, favorites, completions, comments.
    """
    collections = [
        "course_enrollments",
        "quiz_attempts",
        "certificates",
        "favorites",
        "completions",
        "views",
        "comments",
    ]
    for coll in collections:
        try:
            await db[coll].delete_many({"user_id": user_id})
        except Exception as e:
            logger.warning(f"Purge {coll} for {user_id} failed: {e}")
    # Clear the purge flag and progress-related fields on the user document
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "subscription.purge_at": None,
            "subscription.purged_at": _iso(_now_utc()),
        }},
    )
    logger.info(f"[SUBSCRIPTION-CRON] Purged progress for user={user_id}")


# ---------------------------------------------------------------------------
# Scheduler lifecycle
# ---------------------------------------------------------------------------
def start_scheduler(db) -> AsyncIOScheduler:
    """Attach the daily job to the running event loop. Idempotent."""
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler

    hour = int(os.environ.get("SUBSCRIPTION_CRON_HOUR", 9))
    minute = int(os.environ.get("SUBSCRIPTION_CRON_MINUTE", 0))
    tz = os.environ.get("SUBSCRIPTION_CRON_TZ", "Europe/Rome")

    scheduler = AsyncIOScheduler(timezone=tz)

    async def _job():
        await run_subscription_lifecycle(db)

    scheduler.add_job(
        _job,
        trigger=CronTrigger(hour=hour, minute=minute),
        id="subscription_lifecycle",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info(f"[SUBSCRIPTION-CRON] scheduler started ({tz} {hour:02d}:{minute:02d} daily)")
    return scheduler


def stop_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[SUBSCRIPTION-CRON] scheduler stopped")
    _scheduler = None
