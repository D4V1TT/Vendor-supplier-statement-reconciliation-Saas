"""
ARQ background worker tasks.
Run with:  arq app.workers.tasks.WorkerSettings

The worker process is separate from the FastAPI process — it shares
the same codebase and database but runs in its own event loop.
"""

from __future__ import annotations

import logging
import uuid

import pandas as pd
from arq import create_pool
from arq.connections import RedisSettings
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.models.models import JobStatus, LedgerExport, ReconciliationJob, UploadedStatement
from app.engine.reconciler import reconcile

logger = logging.getLogger(__name__)
settings = get_settings()

_engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True)
_SessionFactory = async_sessionmaker(_engine, expire_on_commit=False)


# ── Task ──────────────────────────────────────────────────────────────────────

async def run_reconciliation(ctx: dict, job_id: str) -> None:
    """
    Background task: load statement + ledger data from DB, run the
    reconciliation engine, and write results back to the job record.
    """
    async with _SessionFactory() as db:
        job: ReconciliationJob | None = await db.get(ReconciliationJob, uuid.UUID(job_id))
        if not job:
            logger.error("run_reconciliation: job %s not found", job_id)
            return

        # Mark running
        job.status = JobStatus.RUNNING
        await db.commit()

        try:
            statement: UploadedStatement = await db.get(UploadedStatement, job.statement_id)
            ledger: LedgerExport         = await db.get(LedgerExport, job.ledger_id)

            if not statement.extracted_data or not ledger.parsed_data:
                raise ValueError("Statement or ledger has no parsed data. Re-upload files.")

            # Reconstruct DataFrames from the JSONB cache (avoids re-parsing files)
            supplier_df = pd.DataFrame(statement.extracted_data["line_items"])
            ledger_df   = pd.DataFrame(ledger.parsed_data["rows"])

            report = reconcile(supplier_df, ledger_df)
            report_dict = report.to_dict()
            s = report.summary

            job.status                  = JobStatus.COMPLETED
            job.total_supplier_lines    = s.total_supplier_lines
            job.count_matched           = s.count_matched
            job.count_amount_mismatch   = s.count_amount_mismatch
            job.count_missing_in_ledger = s.count_missing_in_ledger
            job.count_unapplied_credit  = s.count_unapplied_credit
            job.total_variance          = s.total_variance
            job.line_items              = report_dict["line_items"]

            logger.info("Job %s completed: %d lines, %d exceptions", job_id,
                        s.total_supplier_lines, s.exception_count)

        except Exception as exc:
            logger.exception("Job %s failed: %s", job_id, exc)
            job.status        = JobStatus.FAILED
            job.error_message = str(exc)

        await db.commit()


# ── Enqueue Helper (called from FastAPI) ──────────────────────────────────────

async def enqueue_reconciliation_job(job_id: str) -> None:
    pool = await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    await pool.enqueue_job("run_reconciliation", job_id)
    await pool.close()


# ── Worker Settings ───────────────────────────────────────────────────────────

class WorkerSettings:
    functions  = [run_reconciliation]
    redis_settings = RedisSettings.from_dsn(settings.REDIS_URL)
    max_jobs   = 10
    job_timeout = 300   # 5 minutes max per job
