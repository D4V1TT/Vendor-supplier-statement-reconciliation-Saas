"""
Core reconciliation routes — Section 5.

POST /api/reconcile          — submit a new job (async, queued)
GET  /api/jobs/{id}          — poll job status
GET  /api/jobs/{id}/report   — get the full exceptions report
GET  /api/jobs/{id}/matched  — paginated matched lines (kept separate for performance)
GET  /api/jobs/{id}/export/xlsx — download Excel report

POST /api/upload/statement   — upload vendor PDF
POST /api/upload/ledger      — upload internal AP CSV/Excel
"""

import io
import uuid
from typing import Annotated

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.security import decrypt_file, encrypt_file
from app.core.storage import delete_file, read_file, write_file
from app.db.models.models import (
    JobStatus,
    LedgerExport,
    ReconciliationJob,
    UploadedStatement,
    User,
)
from app.engine.pdf_extractor import extract_statement
from app.engine.reconciler import parse_ledger_file, reconcile
from app.schemas.api_schemas import (
    ExceptionsReportResponse,
    LedgerExportResponse,
    LineItemOut,
    ReconcileRequest,
    ReconciliationJobResponse,
    UploadedStatementResponse,
    build_exceptions_report,
)
from app.workers.tasks import enqueue_reconciliation_job

router = APIRouter(tags=["reconciliation"])

CurrentUser = Annotated[User, Depends(get_current_user)]
DB = Annotated[AsyncSession, Depends(get_db)]


# ── File Uploads ───────────────────────────────────────────────────────────────

@router.post("/upload/statement", response_model=UploadedStatementResponse, status_code=201)
async def upload_statement(
    file:        UploadFile = File(...),
    vendor_name: str        = Form(...),
    current_user: CurrentUser = Depends(),
    db: DB = Depends(),
):
    """
    Accept a vendor PDF statement.
    1. Read bytes → AES-256 encrypt → store to file backend.
    2. Immediately run PDF extraction (synchronous, fast enough for uploads <5 MB).
    3. Persist metadata + extracted_data to DB.
    """
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    encrypted = encrypt_file(raw_bytes)
    storage_key = f"statements/{current_user.company_id}/{uuid.uuid4()}/{file.filename}"
    await write_file(storage_key, encrypted)

    # Run extraction synchronously — for large PDFs this could be offloaded too
    try:
        result = extract_statement(raw_bytes)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    record = UploadedStatement(
        company_id=current_user.company_id,
        uploaded_by=current_user.id,
        vendor_name=vendor_name,
        original_filename=file.filename,
        storage_key=storage_key,
        file_size_bytes=len(raw_bytes),
        page_count=None,
        extracted_data={"line_items": [li.model_dump(mode="json") for li in result.line_items]},
        extraction_confidence=result.confidence,
        extraction_method=result.method,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/upload/ledger", response_model=LedgerExportResponse, status_code=201)
async def upload_ledger(
    file:           UploadFile  = File(...),
    column_mapping: str | None  = Form(None),  # JSON string of {raw_col: canonical_col}
    current_user: CurrentUser = Depends(),
    db: DB = Depends(),
):
    """
    Accept an internal AP ledger export (CSV or XLSX).
    Encrypts, stores, parses, and persists row count + parsed data.
    """
    import json  # noqa: PLC0415

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    col_map: dict | None = json.loads(column_mapping) if column_mapping else None

    try:
        df = parse_ledger_file(raw_bytes, file.filename, col_map)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    encrypted = encrypt_file(raw_bytes)
    storage_key = f"ledgers/{current_user.company_id}/{uuid.uuid4()}/{file.filename}"
    await write_file(storage_key, encrypted)

    record = LedgerExport(
        company_id=current_user.company_id,
        uploaded_by=current_user.id,
        original_filename=file.filename,
        storage_key=storage_key,
        file_size_bytes=len(raw_bytes),
        row_count=len(df),
        column_mapping=col_map,
        parsed_data={"rows": df.to_dict(orient="records")},
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


# ── Reconciliation ─────────────────────────────────────────────────────────────

@router.post("/reconcile", response_model=ReconciliationJobResponse, status_code=202)
async def submit_reconciliation(
    payload:      ReconcileRequest,
    current_user: CurrentUser = Depends(),
    db: DB = Depends(),
):
    """
    Submit a reconciliation job.  Returns immediately with job_id and status=pending.
    The actual work runs in the ARQ background worker.
    Poll GET /api/jobs/{id} until status == 'completed', then fetch the report.
    """
    # Verify both files belong to this company (belt-and-suspenders beyond RLS)
    stmt = await db.get(UploadedStatement, payload.statement_id)
    if not stmt or stmt.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Statement not found.")

    ledger = await db.get(LedgerExport, payload.ledger_id)
    if not ledger or ledger.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Ledger export not found.")

    job = ReconciliationJob(
        company_id=current_user.company_id,
        created_by=current_user.id,
        statement_id=payload.statement_id,
        ledger_id=payload.ledger_id,
        status=JobStatus.PENDING,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Enqueue the background task
    await enqueue_reconciliation_job(str(job.id))

    return job


@router.get("/jobs/{job_id}", response_model=ReconciliationJobResponse)
async def get_job_status(
    job_id:       uuid.UUID,
    current_user: CurrentUser = Depends(),
    db: DB = Depends(),
):
    job = await db.get(ReconciliationJob, job_id)
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("/jobs/{job_id}/report", response_model=ExceptionsReportResponse)
async def get_exceptions_report(
    job_id:       uuid.UUID,
    current_user: CurrentUser = Depends(),
    db: DB = Depends(),
):
    """
    Returns the structured Exceptions Dashboard payload.
    Three buckets (amount mismatches, missing invoices, unapplied credits)
    are fully embedded; matched lines are available via /matched.
    """
    job = await db.get(ReconciliationJob, job_id)
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=409, detail=f"Job is not completed yet (status={job.status.value}).")
    if not job.line_items:
        raise HTTPException(status_code=500, detail="Job completed but no results found.")

    return build_exceptions_report(
        job_id=job.id,
        report_dict={"summary": _build_summary_dict(job), "line_items": job.line_items},
        status=job.status.value,
    )


@router.get("/jobs/{job_id}/matched", response_model=list[LineItemOut])
async def get_matched_lines(
    job_id:       uuid.UUID,
    page:         int = Query(default=1, ge=1),
    page_size:    int = Query(default=100, ge=1, le=500),
    current_user: CurrentUser = Depends(),
    db: DB = Depends(),
):
    """Paginated list of fully matched lines — rendered in a separate 'clean' tab."""
    job = await db.get(ReconciliationJob, job_id)
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.COMPLETED or not job.line_items:
        raise HTTPException(status_code=409, detail="Job not completed.")

    matched = [li for li in job.line_items if li["category"] == "Matched"]
    start = (page - 1) * page_size
    return [LineItemOut(**li) for li in matched[start: start + page_size]]


@router.get("/jobs/{job_id}/export/xlsx")
async def export_xlsx(
    job_id:       uuid.UUID,
    current_user: CurrentUser = Depends(),
    db: DB = Depends(),
):
    """Generate and stream an Excel workbook with Exceptions and Matched sheets."""
    job = await db.get(ReconciliationJob, job_id)
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.COMPLETED or not job.line_items:
        raise HTTPException(status_code=409, detail="Job not completed.")

    df_all = pd.DataFrame(job.line_items)
    df_exceptions = df_all[df_all["category"] != "Matched"]
    df_matched    = df_all[df_all["category"] == "Matched"]

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df_exceptions.to_excel(writer, sheet_name="Exceptions", index=False)
        df_matched.to_excel(writer, sheet_name="Matched", index=False)

        # Auto-fit column widths
        for sheet_name in writer.sheets:
            ws = writer.sheets[sheet_name]
            for col in ws.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 40)

    buffer.seek(0)
    filename = f"reconciliation_{job_id}_report.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Private Helpers ───────────────────────────────────────────────────────────

def _build_summary_dict(job: ReconciliationJob) -> dict:
    total = job.total_supplier_lines or 0
    matched = job.count_matched or 0
    return {
        "total_supplier_lines":    total,
        "count_matched":           matched,
        "count_amount_mismatch":   job.count_amount_mismatch or 0,
        "count_missing_in_ledger": job.count_missing_in_ledger or 0,
        "count_unapplied_credit":  job.count_unapplied_credit or 0,
        "total_variance":          float(job.total_variance or 0),
        "exception_count":         (job.count_amount_mismatch or 0) + (job.count_missing_in_ledger or 0) + (job.count_unapplied_credit or 0),
        "match_rate_pct":          round(matched / max(total, 1) * 100, 1),
    }
