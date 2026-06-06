"""
Stripe subscription billing.

Flow:
  1. User clicks "Upgrade to Pro" → POST /billing/checkout → we create a Stripe
     Checkout Session and return its URL → frontend redirects the user to Stripe.
  2. User pays on Stripe's hosted page → Stripe sends events to /billing/webhook.
  3. The webhook (verified by signature) flips company.plan to 'pro' / 'free'.
  4. "Manage billing" → POST /billing/portal → Stripe's hosted portal to
     update card / cancel.

The webhook is the SOURCE OF TRUTH for plan state — never trust the client.
"""

import logging

import stripe
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import get_settings
from app.db.models.models import Company, User

logger = logging.getLogger(__name__)
settings = get_settings()
stripe.api_key = settings.STRIPE_SECRET_KEY

router = APIRouter(prefix="/billing", tags=["billing"])


@router.post("/checkout")
async def create_checkout(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout Session for the Pro plan; return its URL."""
    if not settings.STRIPE_SECRET_KEY or not settings.STRIPE_PRICE_PRO:
        raise HTTPException(status_code=503, detail="Billing is not configured yet.")

    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    # Ensure the company has a Stripe customer
    if not company.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            name=company.name,
            metadata={"company_id": str(company.id)},
        )
        company.stripe_customer_id = customer.id
        await db.commit()

    base = settings.APP_BASE_URL.rstrip("/")
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=company.stripe_customer_id,
        line_items=[{"price": settings.STRIPE_PRICE_PRO, "quantity": 1}],
        success_url=f"{base}/settings?upgraded=1",
        cancel_url=f"{base}/settings",
        metadata={"company_id": str(company.id)},
        subscription_data={"metadata": {"company_id": str(company.id)}},
        allow_promotion_codes=True,
    )
    return {"url": session.url}


@router.post("/portal")
async def billing_portal(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Open Stripe's hosted billing portal (update card / cancel)."""
    company = await db.get(Company, current_user.company_id)
    if not company or not company.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No billing account yet — upgrade first.")

    base = settings.APP_BASE_URL.rstrip("/")
    session = stripe.billing_portal.Session.create(
        customer=company.stripe_customer_id,
        return_url=f"{base}/settings",
    )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request:          Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    """
    Stripe → us. NOT authenticated (verified by signature instead).
    Updates company.plan based on subscription lifecycle events.
    """
    payload = await request.body()
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured.")
    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as exc:
        logger.warning("Stripe webhook signature verification failed: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid signature.")

    etype = event["type"]
    obj   = event["data"]["object"]

    # Use a direct session (no RLS needed — companies table has no RLS).
    from app.api.deps import _SessionFactory  # noqa: PLC0415

    async def _set_plan(customer_id: str | None, company_id: str | None,
                        plan: str, sub_id: str | None) -> None:
        async with _SessionFactory() as db:
            company = None
            if company_id:
                company = await db.get(Company, company_id)
            if company is None and customer_id:
                company = await db.scalar(
                    select(Company).where(Company.stripe_customer_id == customer_id)
                )
            if company is None:
                logger.warning("Webhook %s: no company for customer=%s company_id=%s",
                               etype, customer_id, company_id)
                return
            company.plan = plan
            if sub_id is not None:
                company.stripe_subscription_id = sub_id
            if customer_id and not company.stripe_customer_id:
                company.stripe_customer_id = customer_id
            await db.commit()
            logger.info("Webhook %s → company %s plan=%s", etype, company.id, plan)

    if etype == "checkout.session.completed":
        await _set_plan(
            customer_id=obj.get("customer"),
            company_id=(obj.get("metadata") or {}).get("company_id"),
            plan="pro",
            sub_id=obj.get("subscription"),
        )
    elif etype in ("customer.subscription.updated", "customer.subscription.created"):
        status = obj.get("status")
        plan = "pro" if status in ("active", "trialing", "past_due") else "free"
        await _set_plan(
            customer_id=obj.get("customer"),
            company_id=(obj.get("metadata") or {}).get("company_id"),
            plan=plan,
            sub_id=obj.get("id"),
        )
    elif etype == "customer.subscription.deleted":
        await _set_plan(
            customer_id=obj.get("customer"),
            company_id=(obj.get("metadata") or {}).get("company_id"),
            plan="free",
            sub_id=None,
        )

    return {"received": True}
