"""
FastAPI dependency injection: database session + current user.

Auth strategy:
  - If CLERK_JWKS_URL is set  → verify Clerk RS256 JWT, auto-provision user
  - If CLERK_JWKS_URL is empty → fall back to our own HS256 JWT (dev / testing)

This lets the app run in local dev without Clerk keys while production
uses the full Clerk flow.
"""

from typing import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.core.security import decode_access_token
from app.db.models.models import Company, User

settings = get_settings()

# ── Database ──────────────────────────────────────────────────────────────────
_engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)
_SessionFactory = async_sessionmaker(_engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with _SessionFactory() as session:
        yield session


# ── Auth ──────────────────────────────────────────────────────────────────────
_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials

    # ── Path A: Clerk RS256 JWT ───────────────────────────────────────────────
    if settings.CLERK_JWKS_URL:
        try:
            from app.core.clerk_auth import verify_clerk_token  # noqa: PLC0415
            payload     = verify_clerk_token(token)
            clerk_id    = payload.get("sub", "")
            email       = (payload.get("email_addresses") or [{}])[0].get("email_address", "") \
                          if isinstance(payload.get("email_addresses"), list) \
                          else payload.get("email", "")
            full_name   = payload.get("name", "") or payload.get("full_name", "")
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail=f"Clerk token invalid: {exc}")

        # Auto-provision: find or create User + Company keyed on Clerk user ID
        user = await db.scalar(
            select(User).where(User.clerk_id == clerk_id)
        )
        if not user:
            # First sign-in — create a company + user record
            company = Company(
                name=full_name or email.split("@")[0],
                slug=email.replace("@", "-").replace(".", "-"),
            )
            db.add(company)
            await db.flush()

            user = User(
                company_id=company.id,
                clerk_id=clerk_id,
                email=email or f"{clerk_id}@clerk.local",
                hashed_password="",       # no password — Clerk owns auth
                full_name=full_name or email,
                role="admin",
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

    # ── Path B: own HS256 JWT (dev fallback) ──────────────────────────────────
    else:
        try:
            payload     = decode_access_token(token)
            user_id     = payload["sub"]
            company_id  = payload["company_id"]
        except (JWTError, KeyError):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid token.")

        user = await db.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="User not found.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account deactivated.")

    # Enforce RLS for this request
    await db.execute(
        text(f"SET LOCAL app.current_company_id = '{user.company_id}'")
    )

    # Gate the LLM fallback by the company's billing plan (flows via contextvar
    # through the whole engine call stack for this request).
    from app.core.llm_gate import plan_allows_llm, set_llm_allowed  # noqa: PLC0415
    company = await db.get(Company, user.company_id)
    set_llm_allowed(plan_allows_llm(company.plan if company else "free"))

    return user
