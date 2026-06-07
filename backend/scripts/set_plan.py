"""
Manually set a company's billing plan.

Useful for upgrading a client who paid by manual invoice (Payoneer / Wise /
bank transfer) before automated billing is wired up — and for testing Pro
features locally.

Run from the backend/ directory, or against production via Railway:

    python scripts/set_plan.py client@company.com pro
    python scripts/set_plan.py 7b3f...-uuid free
    docker compose exec api python scripts/set_plan.py client@company.com pro

First argument: the company UUID, or the email of any user in that company.
Second argument: the plan — free | pro | enterprise.

It uses whatever DATABASE_URL is in the environment, so to change a real
customer run it where DATABASE_URL points at the production database
(e.g. a Railway one-off command on the api service).
"""

import asyncio
import sys
import uuid
from pathlib import Path

# Make the backend package importable when run as a loose script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine  # noqa: E402

from app.core.config import get_settings  # noqa: E402
from app.db.models.models import Company, User  # noqa: E402

VALID_PLANS = {"free", "pro", "enterprise"}


async def _run(identifier: str, plan: str) -> int:
    settings = get_settings()
    engine = create_async_engine(settings.async_database_url)
    SessionFactory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with SessionFactory() as db:
            company = None

            # Try UUID first → company by primary key.
            try:
                company = await db.get(Company, uuid.UUID(str(identifier)))
            except (ValueError, AttributeError):
                company = None

            # Otherwise treat the identifier as a user email → that user's company.
            if company is None:
                user = await db.scalar(select(User).where(User.email == identifier))
                if user:
                    company = await db.get(Company, user.company_id)

            if company is None:
                print(f"❌ No company found for '{identifier}'.")
                return 1

            old = company.plan
            company.plan = plan
            await db.commit()
            print(f"✅ {company.name} ({company.id}): plan {old} → {plan}")
            return 0
    finally:
        await engine.dispose()


def main() -> int:
    if len(sys.argv) != 3 or sys.argv[2] not in VALID_PLANS:
        print("Usage: python scripts/set_plan.py <company-uuid|user-email> <free|pro|enterprise>")
        return 2
    return asyncio.run(_run(sys.argv[1], sys.argv[2]))


if __name__ == "__main__":
    raise SystemExit(main())
