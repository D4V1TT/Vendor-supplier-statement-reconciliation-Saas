"""
Lemon Squeezy subscription billing (Merchant of Record).

Why Lemon Squeezy instead of Stripe: Stripe isn't available in Georgia.
Lemon Squeezy is a Merchant of Record — it supports Georgian sellers, remits
global VAT/sales tax on our behalf, and pays out via Wise. The integration
shape is the same as before: a hosted checkout + a signature-verified webhook
that is the single source of truth for company.plan.

Flow:
  1. User clicks "Upgrade to Pro" → POST /billing/checkout → we create a
     Lemon Squeezy checkout and return its hosted URL → frontend redirects.
  2. User pays on LS's hosted page → LS sends events to /billing/webhook.
  3. The webhook (verified by an HMAC X-Signature) flips company.plan based on
     the subscription's status.
  4. "Manage billing" → POST /billing/portal → LS's hosted customer portal
     (update card / cancel).

The webhook is the SOURCE OF TRUTH for plan state — never trust the client.

We reuse the company.stripe_customer_id / stripe_subscription_id columns to
store the Lemon Squeezy customer id / subscription id, so no DB migration is
needed for the provider switch.
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

LS_API = "https://api.lemonsqueezy.com/v1"

# Subscription statuses that grant Pro access. "past_due" keeps access during
# dunning (a renewal is being retried); "cancelled" keeps access until the paid
# period ends — Lemon Squeezy then fires subscription_expired (status
# "expired"), which drops the plan back to free.
_PRO_STATUSES = {"active", "on_trial", "past_due", "cancelled"}


def _ls_headers() -> dict:
    return {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": f"Bearer {settings.LEMONSQUEEZY_API_KEY}",
    }


def _plan_for_status(status: str | None) -> str:
    return "pro" if status in _PRO_STATUSES else "free"


@router.post("/checkout")
async def create_checkout(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Create a Lemon Squeezy checkout for the Pro plan; return its hosted URL."""
    if not (settings.LEMONSQUEEZY_API_KEY
            and settings.LEMONSQUEEZY_STORE_ID
            and settings.LEMONSQUEEZY_VARIANT_PRO):
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")

    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    base = settings.APP_BASE_URL.rstrip("/")
    payload = {
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_data": {
                    "email": current_user.email,
                    "name": company.name,
                    # Echoed back in every subscription webhook as meta.custom_data
                    "custom": {"company_id": str(company.id)},
                },
                "product_options": {
                    "redirect_url": f"{base}/settings?upgraded=1",
                    "receipt_button_text": "Go to dashboard",
                    "receipt_link_url": f"{base}/dashboard",
                },
            },
            "relationships": {
                "store":   {"data": {"type": "stores",   "id": str(settings.LEMONSQUEEZY_STORE_ID)}},
                "variant": {"data": {"type": "variants", "id": str(settings.LEMONSQUEEZY_VARIANT_PRO)}},
            },
        }
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(f"{LS_API}/checkouts", json=payload, headers=_ls_headers())
        if resp.status_code >= 400:
            logger.error("Lemon Squeezy checkout failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="Could not start checkout. Please try again.")
        url = (resp.json().get("data") or {}).get("attributes", {}).get("url")
        if not url:
            logger.error("Lemon Squeezy checkout: no url in response %s", resp.text)
            raise HTTPException(status_code=502, detail="Could not start checkout. Please try again.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Lemon Squeezy checkout error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not start checkout. Please try again.")

    return {"url": url}


@router.post("/portal")
async def billing_portal(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Return the Lemon Squeezy hosted customer-portal URL for this company."""
    company = await db.get(Company, current_user.company_id)
    if not company or not company.stripe_subscription_id:
        raise HTTPException(status_code=400, detail="No billing account yet — upgrade first.")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{LS_API}/subscriptions/{company.stripe_subscription_id}",
                headers=_ls_headers(),
            )
        if resp.status_code >= 400:
            logger.error("Lemon Squeezy portal fetch failed: %s %s", resp.status_code, resp.text)
            raise HTTPException(status_code=502, detail="Could not open billing portal. Please try again.")
        urls = (resp.json().get("data") or {}).get("attributes", {}).get("urls") or {}
        url = urls.get("customer_portal")
        if not url:
            raise HTTPException(status_code=502, detail="Billing portal is unavailable right now.")
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Lemon Squeezy portal error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not open billing portal. Please try again.")

    return {"url": url}


@router.post("/webhook")
async def lemonsqueezy_webhook(
    request:     Request,
    x_signature: str = Header(None, alias="X-Signature"),
):
    """
    Lemon Squeezy → us. NOT authenticated (verified by HMAC signature instead).
    Updates company.plan based on the subscription lifecycle.
    """
    payload = await request.body()
    secret = settings.LEMONSQUEEZY_WEBHOOK_SECRET
    if not secret:
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")

    # Verify HMAC-SHA256 (hex) of the RAW body against the X-Signature header.
    expected = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()
    if not x_signature or not hmac.compare_digest(expected, x_signature):
        logger.warning("Lemon Squeezy webhook signature mismatch.")
        raise HTTPException(status_code=400, detail="Invalid signature.")

    try:
        event = json.loads(payload)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON.")

    meta       = event.get("meta") or {}
    event_name = meta.get("event_name", "")
    custom     = meta.get("custom_data") or {}
    company_id = custom.get("company_id")

    data        = event.get("data") or {}
    attrs       = data.get("attributes") or {}
    sub_id      = data.get("id")               # subscription id (string)
    customer_id = attrs.get("customer_id")      # int
    status      = attrs.get("status")

    # Only subscription objects flip the plan. This naturally skips order_created
    # (type "orders") and subscription_payment_* (type "subscription-invoices"),
    # whose `status` is an invoice status, not a subscription status.
    if data.get("type") != "subscriptions" or status is None:
        return {"received": True, "ignored": event_name}

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
        if company is None and customer_id is not None:
            company = await db.scalar(
                select(Company).where(Company.stripe_customer_id == str(customer_id))
            )
        if company is None:
            logger.warning("LS webhook %s: no company (company_id=%s sub=%s customer=%s)",
                           event_name, company_id, sub_id, customer_id)
            return {"received": True}

        company.plan = plan
        if sub_id:
            company.stripe_subscription_id = str(sub_id)
        if customer_id is not None and not company.stripe_customer_id:
            company.stripe_customer_id = str(customer_id)
        await db.commit()
        logger.info("LS webhook %s → company %s status=%s plan=%s",
                    event_name, company.id, status, plan)

    return {"received": True}
