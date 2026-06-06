"""
Lightweight SQL migration runner.

Applies every *.sql file in app/db/migrations/ in filename order, exactly once,
tracked in a `schema_migrations` table. Idempotent — safe to run on every deploy
(already-applied files are skipped).

Run:
    python -m app.db.migrate

On Railway, make this the start command's first step, e.g.:
    python -m app.db.migrate && uvicorn app.main:app --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path

import asyncpg

from app.core.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s")
logger = logging.getLogger("migrate")

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def _asyncpg_dsn(url: str) -> str:
    """asyncpg.connect() wants a plain postgres DSN, not SQLAlchemy's +asyncpg form."""
    return url.replace("postgresql+asyncpg://", "postgresql://").replace(
        "postgres+asyncpg://", "postgresql://"
    )


async def run_migrations() -> None:
    settings = get_settings()
    dsn = _asyncpg_dsn(settings.DATABASE_URL)

    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                filename    TEXT PRIMARY KEY,
                applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            """
        )
        applied = {r["filename"] for r in await conn.fetch("SELECT filename FROM schema_migrations")}

        files = sorted(MIGRATIONS_DIR.glob("*.sql"), key=lambda p: p.name)
        if not files:
            logger.warning("No migration files found in %s", MIGRATIONS_DIR)
            return

        ran = 0
        for path in files:
            if path.name in applied:
                logger.info("skip   %s (already applied)", path.name)
                continue
            sql = path.read_text(encoding="utf-8")
            logger.info("apply  %s", path.name)
            # Each migration runs in its own transaction so a failure is atomic.
            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO schema_migrations (filename) VALUES ($1)", path.name
                )
            ran += 1

        logger.info("Migrations complete — %d applied, %d already up to date.", ran, len(applied))
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(run_migrations())
