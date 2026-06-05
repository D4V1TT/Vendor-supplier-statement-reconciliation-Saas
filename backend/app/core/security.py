"""
JWT creation/verification and AES-256 file encryption helpers.
Files are encrypted before being written to disk or S3, and decrypted
only in-memory during processing — plaintext never persists.
"""

import base64
import os
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import get_settings

settings = get_settings()

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Passwords ────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(subject: str, company_id: str) -> str:
    """Embed both user ID and company ID so every request is company-scoped."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "company_id": company_id, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Returns the raw payload dict; raises JWTError on invalid/expired tokens."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


# ── AES-256-GCM File Encryption ───────────────────────────────────────────────

def _get_aes_key() -> bytes:
    """Decode the 32-byte base64 key from config."""
    key_bytes = base64.b64decode(settings.FILE_ENCRYPTION_KEY)
    if len(key_bytes) != 32:
        raise ValueError("FILE_ENCRYPTION_KEY must be exactly 32 bytes after base64 decoding.")
    return key_bytes


def encrypt_file(plaintext: bytes) -> bytes:
    """
    Returns:  nonce (12 bytes) || ciphertext+tag
    The nonce is random per file — safe to store alongside ciphertext.
    """
    aesgcm = AESGCM(_get_aes_key())
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext, associated_data=None)
    return nonce + ciphertext


def decrypt_file(blob: bytes) -> bytes:
    """Splits the stored blob back into nonce + ciphertext and decrypts."""
    aesgcm = AESGCM(_get_aes_key())
    nonce, ciphertext = blob[:12], blob[12:]
    return aesgcm.decrypt(nonce, ciphertext, associated_data=None)
