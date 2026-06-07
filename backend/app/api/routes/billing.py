"""
Paddle Billing subscriptions (Merchant of Record).

Why Paddle: Stripe and Lemon Squeezy can't pay out to Georgia. Paddle is a
Merchant of Record that supports Georgian sellers (payout via Payoneer or
wire) and remits global VAT/sales tax on our behalf.

Flow:
  1. User clicks "Upgrade to Pro" → the frontend opens Paddle's overlay
     checkout via Paddle.js (client-side), passing customData.company_id.
  2. User pays → Paddle sends events to /billing/webhook.
  3. The webhook (verified by the Paddle-Signature HMAC) flips company.plan
     based on the subscription's status. This is the single source of truth.
  4. "Manage billing" → POST /billing/portal → a Paddle customer-portal
     session (update card / cancel).

There is intentionally no /billing/checkout endpoint: Paddle Billing renders
checkout through Paddle.js on the client, not via a server-hosted redirect.

We reuse the company.stripe_customer_id / stripe_subscription_id columns to
store the Paddle customer id (ctm_) / subscription id (sub_) — no migration.
"""

import hashlib
import hmac
import json
import logging

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.db.models.models import Company, User

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/billing", tags=["billing"])

# Paddle subscription statuses that grant Pro access. "past_due" keeps access
# during dunning (a renewal is being retried); "canceled"/"paused" → free.
_PRO_STATUSES = {"active", "trialing", "past_due"}


def _paddle_api_base() -> str:
    return ("https://sandbox-api.paddle.com"
            if settings.PADDLE_ENV.lower() == "sandbox"
            else "https://api.paddle.com")


def _plan_for_status(status: str | None) -> str:
    return "pro" if status in _PRO_STATUSES else "free"


@router.post("/portal")
async def billing_portal(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Create a Paddle customer-portal session and return its URL."""
    if not settings.PADDLE_API_KEY:
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")

    company = await db.get(Company, current_user.company_id)
    if not company or not company.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account yet — upgrade first.")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                f"{_paddle_api_base()}/customers/{company.stripe_customer_id}/portal-sessions",
                headers={"Authorization": f"Bearer {settings.PADDLE_API_KEY}",
                         "Content-Type": "application/json"},
                json={},
            )
        if resp.status_code >= 400:
            logger.error("Paddle portal session failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="Could not open billing portal. Please try again.")
        data    = resp.json().get("data") or {}
        general = (data.get("urls") or {}).get("general") or {}
        url     = general.get("overview") or next((v for v in general.values() if isinstance(v, str)), None)
        if not url:
            raise HTTPException(status_code=502, detail="Billing portal is unavailable right now.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Paddle portal error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not open billing portal. Please try again.")

    return {"url": url}


@router.post("/webhook")
async def paddle_webhook(
    request:          Request,
    paddle_signature: str = Header(None, alias="Paddle-Signature"),
):
    """
    Paddle → us. NOT authenticated (verified by HMAC signature instead).
    Updates company.plan based on the subscription lifecycle.
    """
    payload = await request.body()
    secret = settings.PADDLE_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")

    # Paddle-Signature: "ts=<unix>;h1=<hex hmac>". The signed payload is
    # "<ts>:<raw body>", hashed with HMAC-SHA256 using the destination secret.
    ts = h1 = None
    for part in (paddle_signature or "").split(";"):
        k, _, v = part.partition("=")
        if k == "ts":
            ts = v
        elif k == "h1":
            h1 = v
    if not ts or not h1:
        raise HTTPException(status_code=400, detail="Missing signature.")

    expected = hmac.new(secret.encode("utf-8"),
                        f"{ts}:".encode("utf-8") + payload,
                        hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, h1):
        logger.warning("Paddle webhook signature mismatch.")
        raise HTTPException(status_code=400, detail="Invalid signature.")

    try:
        event = json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON.")

    event_type  = event.get("event_type", "")
    data        = event.get("data") or {}
    sub_id      = data.get("id")             # sub_...
    customer_id = data.get("customer_id")     # ctm_...
    status      = data.get("status")
    custom      = data.get("custom_data")
    company_id  = custom.get("company_id") if isinstance(custom, dict) else None

    # Only subscription lifecycle events flip the plan (skips transaction.*, etc.).
    if not event_type.startswith("subscription.") or status is None:
        return {"received": True, "ignored": event_type}

    plan = _plan_for_status(status)

    from app.api.deps import _SessionFactory  # noqa: PLC0415
    async with _SessionFactory() as db:
        company = None
        if company_id:
            try:
                company = await db.get(Company, company_id)
            except Exception:
                company = None  # malformed company_id → fall through to other lookups
        if company is None and sub_id:
            company = await db.scalar(
                select(Company).where(Company.stripe_subscription_id == str(sub_id))
            )
        if company is None and customer_id:
            company = await db.scalar(
                select(Company).where(Company.stripe_customer_id == str(customer_id))
            )
        if company is None:
            logger.warning("Paddle webhook %s: no company (company_id=%s sub=%s customer=%s)",
                           event_type, company_id, sub_id, customer_id)
            return {"received": True}

        company.plan = plan
        if sub_id:
            company.stripe_subscription_id = str(sub_id)
        if customer_id:
            # Always keep the latest customer id (e.g. replaces a stale sandbox
            # id after switching to production, or a new customer on re-subscribe).
            company.stripe_customer_id = str(customer_id)
        await db.commit()
        logger.info("Paddle webhook %s → company %s status=%s plan=%s",
                    event_type, company.id, status, plan)

    return {"received": True}
