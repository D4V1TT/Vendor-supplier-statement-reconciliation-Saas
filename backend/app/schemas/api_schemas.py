"""
Pydantic v2 request/response schemas for all API endpoints.
These are the contracts between FastAPI and the frontend.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email:        EmailStr
    password:     str
    full_name:    str
    company_name: str

class LoginRequest(BaseModel):
    email:    EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"

class UserResponse(BaseModel):
    id:         uuid.UUID
    email:      str
    full_name:  str
    role:       str
    company_id: uuid.UUID

    model_config = {"from_attributes": True}


# ── File Uploads ───────────────────────────────────────────────────────────────

class UploadedStatementResponse(BaseModel):
    id:                   uuid.UUID
    vendor_name:          str
    original_filename:    str
    file_size_bytes:      int
    extraction_method:    str | None
    extraction_confidence: float | None

    model_config = {"from_attributes": True}

class LedgerExportResponse(BaseModel):
    id:               uuid.UUID
    original_filename: str
    file_size_bytes:  int
    row_count:        int | None

    model_config = {"from_attributes": True}


# ── Reconciliation ─────────────────────────────────────────────────────────────

class ReconcileRequest(BaseModel):
    statement_id:   uuid.UUID
    ledger_id:      uuid.UUID
    vendor_name:    str | None = None   # Override / confirm vendor name

class JobStatusEnum(str, Enum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"

class ReconciliationJobResponse(BaseModel):
    id:                      uuid.UUID
    status:                  JobStatusEnum
    created_at:              datetime | None = None
    statement_id:            uuid.UUID
    ledger_id:               uuid.UUID
    error_message:           str | None = None
    # KPI cards
    total_supplier_lines:    int | None = None
    count_matched:           int | None = None
    count_amount_mismatch:   int | None = None
    count_missing_in_ledger: int | None = None
    count_unapplied_credit:  int | None = None
    total_variance:          Decimal | None = None

    model_config = {"from_attributes": True}


# ── Exceptions Report (the dashboard payload) ─────────────────────────────────

class LineItemOut(BaseModel):
    invoice_id:      str
    invoice_date:    str | None
    supplier_amount: float
    ledger_amount:   float | None
    variance:        float | None
    category:        str
    balance_due:     float | None
    notes:           str


class ExceptionsBucket(BaseModel):
    category:     str
    count:        int
    total_amount: float       # Sum of supplier_amount for items in this bucket
    items:        list[LineItemOut]


class ExceptionsReportResponse(BaseModel):
    """
    The primary payload returned by POST /api/reconcile and
    GET /api/jobs/{id}/report.

    Design principle: the frontend receives exceptions *first*.
    Matched lines are available but paginated separately so the
    Exceptions Dashboard renders instantly without waiting for
    potentially thousands of matched rows.
    """
    job_id:   uuid.UUID
    status:   JobStatusEnum

    # ── KPI summary ───────────────────────────────────────────────────────────
    summary: dict[str, Any]   # matches ReconciliationSummary.to_dict()["summary"]

    # ── Exception buckets ─────────────────────────────────────────────────────
    amount_mismatches:    ExceptionsBucket
    missing_in_ledger:   ExceptionsBucket
    unapplied_credits:   ExceptionsBucket
    likely_matches:      ExceptionsBucket
    missing_in_statement: ExceptionsBucket
    duplicates:          ExceptionsBucket

    # ── Matched lines (included but noted as "clean") ─────────────────────────
    matched_count: int
    # Matched items are NOT embedded here — fetch via GET /api/jobs/{id}/matched
    # to keep this response payload small.

    # ── Export hint ───────────────────────────────────────────────────────────
    export_url: str   # e.g. "/api/jobs/{id}/export/xlsx"


def build_exceptions_report(
    job_id: uuid.UUID,
    report_dict: dict,
    status: str,
) -> ExceptionsReportResponse:
    """
    Transform the raw report dict (from ReconciliationReport.to_dict())
    into the structured ExceptionsReportResponse the frontend consumes.
    """
    from app.engine.reconciler import (  # noqa: PLC0415
        FLAGGED_AMOUNT_MISMATCH,
        FLAGGED_DUPLICATE,
        FLAGGED_LIKELY_MATCH,
        FLAGGED_MISSING_IN_LEDGER,
        FLAGGED_MISSING_IN_STATEMENT,
        FLAGGED_UNAPPLIED_CREDIT,
        MATCHED,
    )

    all_items   = report_dict["line_items"]
    summary     = report_dict["summary"]

    def _bucket(category: str) -> ExceptionsBucket:
        items = [LineItemOut(**li) for li in all_items if li["category"] == category]
        # For ledger-only items the value lives in ledger_amount, not supplier_amount.
        total = sum(abs(i.supplier_amount or i.ledger_amount or 0) for i in items)
        return ExceptionsBucket(
            category=category,
            count=len(items),
            total_amount=total,
            items=items,
        )

    return ExceptionsReportResponse(
        job_id=job_id,
        status=JobStatusEnum(status),
        summary=summary,
        amount_mismatches=_bucket(FLAGGED_AMOUNT_MISMATCH),
        missing_in_ledger=_bucket(FLAGGED_MISSING_IN_LEDGER),
        unapplied_credits=_bucket(FLAGGED_UNAPPLIED_CREDIT),
        likely_matches=_bucket(FLAGGED_LIKELY_MATCH),
        missing_in_statement=_bucket(FLAGGED_MISSING_IN_STATEMENT),
        duplicates=_bucket(FLAGGED_DUPLICATE),
        matched_count=summary["count_matched"],
        export_url=f"/api/jobs/{job_id}/export/xlsx",
    )
