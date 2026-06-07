"""
Admin-only operations, gated by a static ADMIN_API_KEY (sent as the
`X-Admin-Key` request header).

Primary use: manually grant/revoke a company's plan — e.g. after a client pays
by manual invoice (Payoneer / Wise / bank transfer), or to comp an account —
without needing a database shell. The key is not tied to a user; keep it secret
and set it only in the backend environment (Railway). Leave it blank to disable
these endpoints entirely.
"""

import hmac
import logging
import uuid

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models.models import Company, User

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/admin", tags=["admin"])

VALID_PLANS = {"free", "pro", "enterprise"}


def _require_admin(provided: str | None) -> None:
    if not settings.ADMIN_API_KEY:
        raise HTTPException(status_code=503, detail="Admin API is not configured.")
    if not provided or not hmac.compare_digest(provided, settings.ADMIN_API_KEY):
        raise HTTPException(status_code=403, detail="Forbidden.")


class SetPlanIn(BaseModel):
    identifier: str          # a company UUID, or the email of any user in the company
    plan: str                # free | pro | enterprise


@router.post("/set-plan")
async def set_plan(
    body:        SetPlanIn,
    x_admin_key: str = Header(None, alias="X-Admin-Key"),
):
    """Set a company's billing plan. Looks the company up by UUID or user email."""
    _require_admin(x_admin_key)
    if body.plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail=f"plan must be one of {sorted(VALID_PLANS)}")

    from app.api.deps import _SessionFactory  # noqa: PLC0415
    async with _SessionFactory() as db:
        company = None
        try:
            company = await db.get(Company, uuid.UUID(body.identifier))
        except (ValueError, AttributeError):
            company = None  # not a UUID → try email
        if company is None:
            user = await db.scalar(select(User).where(User.email == body.identifier))
            if user:
                company = await db.get(Company, user.company_id)
        if company is None:
            raise HTTPException(status_code=404, detail=f"No company found for '{body.identifier}'.")

        old = company.plan
        company.plan = body.plan
        await db.commit()
        logger.info("ADMIN set-plan: company %s (%s) %s -> %s",
                    company.id, company.name, old, body.plan)
        return {
            "company_id":   str(company.id),
            "company_name": company.name,
            "old_plan":     old,
            "new_plan":     body.plan,
        }
