"""
Clerk JWT verification for the FastAPI backend.

Clerk signs its session tokens with RS256 using keys published at:
  https://clerk.{domain}/.well-known/jwks.json
  OR
  https://<CLERK_FRONTEND_API>/.well-known/jwks.json

We fetch and cache the JWKS, verify the incoming JWT, and return the
Clerk user ID (sub) + any custom claims.

Set CLERK_JWKS_URL in .env — copy it from:
  Clerk Dashboard → API Keys → Advanced → JWKS URL
"""

from __future__ import annotations

import logging
import time
from functools import lru_cache

import httpx
from jose import jwk, jwt
from jose.exceptions import JWTError

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_JWKS_CACHE: dict = {}
_JWKS_FETCHED_AT: float = 0.0
_JWKS_TTL: int = 3600  # re-fetch keys hourly


def _get_jwks() -> dict:
    global _JWKS_CACHE, _JWKS_FETCHED_AT
    now = time.time()
    if _JWKS_CACHE and (now - _JWKS_FETCHED_AT) < _JWKS_TTL:
        return _JWKS_CACHE
    url = settings.CLERK_JWKS_URL
    resp = httpx.get(url, timeout=10)
    resp.raise_for_status()
    _JWKS_CACHE = resp.json()
    _JWKS_FETCHED_AT = now
    logger.info("Clerk JWKS refreshed from %s", url)
    return _JWKS_CACHE


def fetch_clerk_user(clerk_id: str) -> dict:
    """
    Fetch a user's real profile from Clerk's Backend API.
    Returns {"email": str|None, "full_name": str|None, "image_url": str|None}.

    Requires CLERK_SECRET_KEY. Returns empty dict on any failure so callers can
    fall back gracefully (the app still works without it).
    """
    if not settings.CLERK_SECRET_KEY or not clerk_id:
        return {}
    try:
        resp = httpx.get(
            f"https://api.clerk.com/v1/users/{clerk_id}",
            headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        # Primary email
        email = None
        primary_id = data.get("primary_email_address_id")
        for e in data.get("email_addresses", []):
            if e.get("id") == primary_id:
                email = e.get("email_address")
                break
        if not email and data.get("email_addresses"):
            email = data["email_addresses"][0].get("email_address")

        first = data.get("first_name") or ""
        last  = data.get("last_name") or ""
        full_name = (f"{first} {last}").strip() or (email.split("@")[0] if email else None)

        return {"email": email, "full_name": full_name, "image_url": data.get("image_url")}
    except Exception as exc:
        logger.warning("Clerk user fetch failed for %s: %s", clerk_id, exc)
        return {}


def verify_clerk_token(token: str) -> dict:
    """
    Verifies a Clerk session JWT.
    Returns the decoded payload (includes 'sub' = Clerk user ID).
    Raises JWTError on invalid/expired tokens.
    """
    jwks = _get_jwks()
    # Get the kid from the unverified header to find the right key
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")

    all_keys = jwks.get("keys", [])
    if not all_keys:
        raise JWTError("JWKS has no keys")

    # Find by kid if present, otherwise try every key (handles tokens without kid)
    candidates = [k for k in all_keys if k.get("kid") == kid] if kid else all_keys
    if not candidates:
        candidates = all_keys  # fallback: try all

    last_error: Exception = JWTError("No key matched")
    for key_data in candidates:
        try:
            signing_key = jwk.construct(key_data)
            payload = jwt.decode(
                token,
                signing_key.to_dict(),
                algorithms=["RS256"],
                # Clerk session tokens are short-lived (~60s). Allow 60s leeway
                # so a token that expires mid-request (slow upload/processing)
                # or minor clock drift doesn't get rejected.
                options={"verify_aud": False, "leeway": 60},
            )
            return payload
        except Exception as exc:
            last_error = exc
            continue

    raise JWTError(f"JWT verification failed: {last_error}")
