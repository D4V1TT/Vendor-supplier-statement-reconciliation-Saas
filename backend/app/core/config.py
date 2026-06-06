"""
Central configuration — loaded once at startup from environment variables.
Copy .env.example → .env and fill in values before running.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "VendorRecon"
    DEBUG: bool = False
    API_PREFIX: str = "/api"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str  # e.g. postgresql+asyncpg://user:pass@localhost/vendorrecon

    # ── Auth (JWT) ────────────────────────────────────────────────────────────
    SECRET_KEY: str          # 64-char random hex — openssl rand -hex 32
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8-hour sessions

    # ── File Storage ──────────────────────────────────────────────────────────
    STORAGE_BACKEND: str = "local"   # "local" | "s3"
    LOCAL_UPLOAD_DIR: str = "/tmp/vendorrecon/uploads"
    S3_BUCKET: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"

    # ── Encryption ────────────────────────────────────────────────────────────
    # AES-256 key for files at rest — 32 bytes base64-encoded
    FILE_ENCRYPTION_KEY: str   # openssl rand -base64 32

    # ── Redis / Job Queue ─────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379"

    # ── Clerk ─────────────────────────────────────────────────────────────────
    # Clerk Dashboard → API Keys → Advanced → JWKS URL
    CLERK_JWKS_URL: str = ""
    # Clerk Dashboard → API Keys → Secret keys (sk_test_… / sk_live_…)
    # Used to fetch the user's real email/name from Clerk's Backend API.
    CLERK_SECRET_KEY: str = ""

    # ── Email (SMTP) ──────────────────────────────────────────────────────────
    # Leave SMTP_HOST blank to disable email (the app logs instead of sending).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "VendorRecon <noreply@vendorrecon.app>"
    SMTP_USE_TLS: bool = True

    # ── AI Fallback (Anthropic) ───────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
