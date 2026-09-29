"""
Stripe integration service — uses Emergent-managed Stripe proxy.

Business rules encoded here:
  * ANNUAL SUBSCRIPTION (12€) → one-time Checkout Session. Renewal is handled
    by our own APScheduler cron (subscription_scheduler.py) which sends the
    user a "renew now" email 7 days before expiry with a fresh Checkout URL.
    Effect for the end-user is indistinguishable from a true auto-renewing
    subscription, without requiring saved payment methods on the proxy.
  * COURSE PREMIUM PURCHASE → one-time Checkout Session at the (possibly
    discounted) course price. On success, the user gets an enrollment.

We keep server-side authoritative pricing: the client never dictates amount.

Environment:
  STRIPE_API_KEY          — passed through to StripeCheckout; can be the
                            Emergent placeholder "sk_test_emergent" or a real
                            sk_test_/sk_live_ key from the user's Stripe.
  STRIPE_WEBHOOK_SECRET   — optional; passed to StripeCheckout.handle_webhook
                            for signature verification.
  PUBLIC_APP_URL          — base URL used to build success/cancel URLs (falls
                            back to the Expo preview URL in dev).
"""
from __future__ import annotations

import os
import logging
from typing import Optional

from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    CheckoutStatusResponse,
)

logger = logging.getLogger("conoscenza.stripe")

ANNUAL_PRICE_EUR = 12.0
CURRENCY = "eur"


def is_configured() -> bool:
    return bool(os.environ.get("STRIPE_API_KEY", "").strip())


def public_key() -> str:
    return os.environ.get("STRIPE_PUBLISHABLE_KEY", "")


def _public_app_url() -> str:
    """Resolve the public origin used to build Stripe return URLs.

    Priority (first non-empty wins):
      1. STRIPE_APP_URL           — explicit Stripe-only override
      2. APP_PUBLIC_URL           — canonical env var for the public app URL
                                    (matches backend/.env naming)
      3. PUBLIC_APP_URL           — legacy alias, still supported
      4. EXPO_PUBLIC_BACKEND_URL  — same origin as the frontend proxy
      5. preview_endpoint         — Emergent runtime injected var
      6. http://localhost:3000    — last-resort fallback (WILL BREAK the
                                    Stripe redirect on real browsers — a
                                    WARNING is logged when this branch is hit)
    """
    for key in (
        "STRIPE_APP_URL",
        "APP_PUBLIC_URL",
        "PUBLIC_APP_URL",
        "EXPO_PUBLIC_BACKEND_URL",
        "preview_endpoint",
    ):
        val = (os.environ.get(key) or "").strip()
        if val:
            return val.rstrip("/")
    logger.warning(
        "[STRIPE] Public app URL not configured — falling back to localhost. "
        "Set APP_PUBLIC_URL in backend/.env or Stripe will redirect to a "
        "non-reachable localhost URL."
    )
    return "http://localhost:3000"


def _success_url() -> str:
    base = os.environ.get("STRIPE_SUCCESS_URL") or f"{_public_app_url()}/payment-success"
    if "session_id=" not in base:
        sep = "&" if "?" in base else "?"
        base = f"{base}{sep}session_id={{CHECKOUT_SESSION_ID}}"
    return base


def _cancel_url() -> str:
    return os.environ.get("STRIPE_CANCEL_URL") or f"{_public_app_url()}/payment-cancel"


def _client() -> StripeCheckout:
    api_key = os.environ.get("STRIPE_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("Stripe non configurato: manca STRIPE_API_KEY")
    return StripeCheckout(
        api_key=api_key,
        webhook_secret=os.environ.get("STRIPE_WEBHOOK_SECRET") or None,
    )


# ---------------------------------------------------------------------------
# Checkout Session creation
# ---------------------------------------------------------------------------
async def create_subscription_checkout(
    user: dict,
    order_id: str,
    amount_eur: float,
) -> dict:
    """Create a one-time Checkout Session for the annual subscription. Renewal
    is handled server-side by the APScheduler cron; the effective UX for the
    user is a yearly subscription with automatic reminder emails."""
    sc = _client()
    req = CheckoutSessionRequest(
        amount=max(0.5, float(amount_eur)),  # Stripe min ~0.50€
        currency=CURRENCY,
        success_url=_success_url(),
        cancel_url=_cancel_url(),
        metadata={
            "user_id": user["id"],
            "order_id": order_id,
            "kind": "subscription",
            "app_plan": "12m",
        },
        payment_methods=["card"],
    )
    res: CheckoutSessionResponse = await sc.create_checkout_session(req)
    return {"session_id": res.session_id, "url": res.url}


async def create_course_checkout(
    user: dict,
    course: dict,
    amount_eur: float,
    course_order_id: str,
) -> dict:
    """Create a one-time Checkout Session for a Premium course purchase."""
    sc = _client()
    req = CheckoutSessionRequest(
        amount=max(0.5, float(amount_eur)),
        currency=CURRENCY,
        success_url=_success_url(),
        cancel_url=_cancel_url(),
        metadata={
            "user_id": user["id"],
            "course_id": course["id"],
            "course_order_id": course_order_id,
            "course_title": (course.get("title") or "")[:100],
            "kind": "course",
        },
        payment_methods=["card"],
    )
    res: CheckoutSessionResponse = await sc.create_checkout_session(req)
    return {"session_id": res.session_id, "url": res.url}


# ---------------------------------------------------------------------------
# Session verification (used by the return page)
# ---------------------------------------------------------------------------
async def get_session_status(session_id: str) -> dict:
    sc = _client()
    res: CheckoutStatusResponse = await sc.get_checkout_status(session_id)
    return {
        "status": res.status,
        "payment_status": res.payment_status,
        "amount_total": res.amount_total,
        "currency": res.currency,
        "metadata": res.metadata or {},
    }


# ---------------------------------------------------------------------------
# Webhook helper (used by the FastAPI endpoint)
# ---------------------------------------------------------------------------
async def handle_webhook(raw_body: bytes, sig_header: Optional[str]) -> dict:
    """Return a normalized event dict:
       {event_id, event_type, session_id, payment_status, metadata}"""
    sc = _client()
    evt = await sc.handle_webhook(raw_body, sig_header)
    # emergentintegrations returns a lightweight WebhookResponse-like object
    return {
        "event_id": getattr(evt, "event_id", None),
        "event_type": getattr(evt, "event_type", None),
        "session_id": getattr(evt, "session_id", None),
        "payment_status": getattr(evt, "payment_status", None),
        "metadata": getattr(evt, "metadata", {}) or {},
    }
