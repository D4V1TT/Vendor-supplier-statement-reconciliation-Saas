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

    signing_key = None
    for key_data in jwks.get("keys", []):
        if key_data.get("kid") == kid:
            signing_key = jwk.construct(key_data)
            break

    if signing_key is None:
        raise JWTError(f"No matching JWK found for kid={kid!r}")

    payload = jwt.decode(
        token,
        signing_key.to_dict(),
        algorithms=["RS256"],
        options={"verify_aud": False},   # Clerk tokens have no audience by default
    )
    return payload
