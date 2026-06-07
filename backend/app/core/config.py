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
    # Public frontend URL — used to build links in emails (e.g. report links).
    APP_BASE_URL: str = "http://localhost:3000"

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str  # e.g. postgresql+asyncpg://user:pass@localhost/vendorrecon

    # ── Auth (JWT) ────────────────────────────────────────────────────────────
    SECRET_KEY: str          # 64-char random hex — openssl rand -hex 32
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8-hour sessions

    # ── File Storage ──────────────────────────────────────────────────────────
    STORAGE_BACKEND: str = "local"   # "local" | "s3" (S3-compatible incl. R2)
    LOCAL_UPLOAD_DIR: str = "/tmp/vendorrecon/uploads"
    S3_BUCKET: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "auto"          # R2 uses "auto"; AWS uses e.g. "us-east-1"
    # For Cloudflare R2: https://<accountid>.r2.cloudflarestorage.com
    # Leave blank for real AWS S3.
    S3_ENDPOINT_URL: str = ""

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
    SMTP_FROM: str = "VendorRecon <noreply@vendorrecon.org>"
    SMTP_USE_TLS: bool = True

    # ── AI Fallback (Anthropic) ───────────────────────────────────────────────
    ANTHROPIC_API_KEY: str = ""
    ANTHROPIC_MODEL: str = "claude-sonnet-4-6"

    # ── Paddle Billing (subscriptions — Merchant of Record) ───────────────────
    # Stripe and Lemon Squeezy can't pay out to Georgia; Paddle can (Payoneer/wire).
    PADDLE_API_KEY: str = ""          # server API key (pdl_...) — used for portal sessions
    PADDLE_WEBHOOK_SECRET: str = ""   # notification destination secret (pdl_ntfset_...)
    PADDLE_ENV: str = "production"    # "sandbox" or "production" → picks the API base URL

    # ── Plan limits ───────────────────────────────────────────────────────────
    # Free tier: max reconciliations per calendar month. Paid plans = unlimited.
    FREE_MONTHLY_RECON_LIMIT: int = 5

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000"]


    @property
    def async_database_url(self) -> str:
        """
        SQLAlchemy needs the +asyncpg driver in the URL. Railway/Heroku provide
        a plain `postgresql://` (or legacy `postgres://`) — normalise either to
        the async form so the app works with auto-provided DATABASE_URLs.
        """
        url = self.DATABASE_URL
        if "+asyncpg" in url:
            return url
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
