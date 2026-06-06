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

            # Apply the company's reconciliation defaults + LLM plan gate
            from app.db.models.models import Company  # noqa: PLC0415
            from app.core.llm_gate import plan_allows_llm, set_llm_allowed  # noqa: PLC0415
            company = await db.get(Company, job.company_id)
            tolerance     = float(company.amount_tolerance) if company else 0.01
            flag_credits  = company.flag_unapplied_credits if company else True
            set_llm_allowed(plan_allows_llm(company.plan if company else "free"))

            report = reconcile(
                supplier_df, ledger_df,
                amount_tolerance=tolerance,
                flag_unapplied_credits=flag_credits,
            )
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

        # ── Send notification email if the user opted in ──────────────────────
        if job.status == JobStatus.COMPLETED:
            await _maybe_send_completion_email(db, job)


async def _maybe_send_completion_email(db: AsyncSession, job: ReconciliationJob) -> None:
    """Send a completion email respecting the creating user's preferences."""
    from app.core.email import reconciliation_complete_email, send_email  # noqa: PLC0415
    from app.db.models.models import User  # noqa: PLC0415

    user = await db.get(User, job.created_by)
    if not user or not user.email:
        return

    exceptions = (job.count_amount_mismatch or 0) + (job.count_missing_in_ledger or 0) + (job.count_unapplied_credit or 0)

    # Decide whether to send based on the user's toggles
    want_completion = user.notify_on_completion
    want_exceptions = user.notify_on_exceptions and exceptions > 0
    if not (want_completion or want_exceptions):
        logger.info("Job %s: user opted out of emails — skipping.", job.id)
        return

    statement = await db.get(UploadedStatement, job.statement_id)
    vendor    = statement.vendor_name if statement else "Vendor"
    summary   = {
        "total_supplier_lines":    job.total_supplier_lines or 0,
        "count_matched":           job.count_matched or 0,
        "count_amount_mismatch":   job.count_amount_mismatch or 0,
        "count_missing_in_ledger": job.count_missing_in_ledger or 0,
        "count_unapplied_credit":  job.count_unapplied_credit or 0,
        "exception_count":         exceptions,
    }
    subject, html = reconciliation_complete_email(vendor, summary, str(job.id))
    send_email(user.email, subject, html)


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
