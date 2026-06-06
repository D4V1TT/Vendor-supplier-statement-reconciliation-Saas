"""
Core reconciliation routes — Section 5.
"""

import io
import math
import uuid

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def _json_safe_records(df: pd.DataFrame) -> list[dict]:
    """
    Convert a DataFrame to JSON/JSONB-safe records.
    pandas NaN/inf are invalid JSON tokens for PostgreSQL JSONB → replace with None.
    """
    records = df.to_dict(orient="records")
    for row in records:
        for key, val in row.items():
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                row[key] = None
            elif pd.isna(val):
                row[key] = None
    return records

from app.api.deps import get_current_user, get_db
from app.core.security import encrypt_file
from app.core.storage import write_file
from app.db.models.models import (
    Company,
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


# ── Company Settings ──────────────────────────────────────────────────────────

@router.get("/company")
async def get_company(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Return the current user's company details."""
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
    return {"id": str(company.id), "name": company.name, "slug": company.slug}


@router.put("/company")
async def update_company(
    payload:      dict,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Update the company name (shown on exported reports)."""
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
    name = (payload.get("name") or "").strip()
    if name:
        company.name = name
        await db.commit()
        await db.refresh(company)
    return {"id": str(company.id), "name": company.name, "slug": company.slug}


# ── Reconciliation Settings (company-wide defaults) ───────────────────────────

def _settings_dict(c: Company) -> dict:
    return {
        "default_currency":       c.default_currency,
        "amount_tolerance":       float(c.amount_tolerance),
        "pdf_extraction_method":  c.pdf_extraction_method,
        "flag_unapplied_credits": c.flag_unapplied_credits,
        "auto_export":            c.auto_export,
    }


@router.get("/settings")
async def get_settings(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
    return _settings_dict(company)


@router.put("/settings")
async def update_settings(
    payload:      dict,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    company = await db.get(Company, current_user.company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    if "default_currency" in payload:
        company.default_currency = str(payload["default_currency"])[:8]
    if "amount_tolerance" in payload:
        try:
            company.amount_tolerance = max(0.0, float(payload["amount_tolerance"]))
        except (TypeError, ValueError):
            raise HTTPException(status_code=422, detail="amount_tolerance must be a number.")
    if "pdf_extraction_method" in payload:
        method = str(payload["pdf_extraction_method"]).lower()
        if method not in {"auto", "pdfplumber", "ocr", "llm"}:
            raise HTTPException(status_code=422, detail="Invalid pdf_extraction_method.")
        company.pdf_extraction_method = method
    if "flag_unapplied_credits" in payload:
        company.flag_unapplied_credits = bool(payload["flag_unapplied_credits"])
    if "auto_export" in payload:
        company.auto_export = bool(payload["auto_export"])

    await db.commit()
    await db.refresh(company)
    return _settings_dict(company)


# ── Notification Preferences ──────────────────────────────────────────────────

@router.get("/notifications")
async def get_notifications(
    current_user: User = Depends(get_current_user),
):
    return {
        "notify_on_completion": current_user.notify_on_completion,
        "notify_on_exceptions": current_user.notify_on_exceptions,
        "notify_weekly_digest": current_user.notify_weekly_digest,
    }


@router.put("/notifications")
async def update_notifications(
    payload:      dict,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    if "notify_on_completion" in payload:
        current_user.notify_on_completion = bool(payload["notify_on_completion"])
    if "notify_on_exceptions" in payload:
        current_user.notify_on_exceptions = bool(payload["notify_on_exceptions"])
    if "notify_weekly_digest" in payload:
        current_user.notify_weekly_digest = bool(payload["notify_weekly_digest"])
    await db.commit()
    return {
        "notify_on_completion": current_user.notify_on_completion,
        "notify_on_exceptions": current_user.notify_on_exceptions,
        "notify_weekly_digest": current_user.notify_weekly_digest,
    }


# ── File Uploads ───────────────────────────────────────────────────────────────

@router.post("/detect-columns")
async def detect_columns_endpoint(
    file:         UploadFile   = File(...),
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """
    Preview column detection on a file without saving it.
    Returns detected mapping + confidence so the frontend can show
    a confirmation/correction step before the full upload.
    """
    from app.engine.column_detector import detect_columns  # noqa: PLC0415

    raw_bytes = await file.read()
    fname = (file.filename or "upload.csv").lower()

    try:
        if fname.endswith(".pdf"):
            # FAST preview only: try the text-layer extractor (pdfplumber, <1s).
            # Slow OCR/LLM are NOT run here — they'd hang the UI. If the text
            # layer yields nothing (scanned PDF), defer to the full waterfall
            # that runs when the user clicks "Run Reconciliation".
            from app.engine.pdf_extractor import _extract_with_pdfplumber  # noqa: PLC0415
            quick = _extract_with_pdfplumber(raw_bytes)
            if not quick or not quick.line_items:
                return {
                    "extraction_deferred": True,
                    "message": "This PDF has no text layer — full extraction "
                               "(OCR/AI) will run when you click Run Reconciliation.",
                    "raw_columns": [],
                    "mapping": {}, "confidence": {}, "overall_confidence": 0.0,
                    "needs_user_confirmation": False, "missing_required": [],
                    "method": "deferred", "sample_rows": [],
                }
            df = quick.to_dataframe()
        else:
            df = parse_ledger_file(raw_bytes, file.filename or "upload.csv")
    except HTTPException:
        raise
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    detected = detect_columns(df)
    return {
        "extraction_deferred":  False,
        "raw_columns":          detected.raw_columns,
        "mapping":              detected.mapping,        # {raw → canonical}
        "confidence":           detected.confidence,     # {canonical → 0–1}
        "overall_confidence":   detected.overall_confidence,
        "needs_user_confirmation": detected.needs_user_confirmation,
        "missing_required":     list(detected.missing_required),
        "method":               detected.method,
        "sample_rows":          detected.sample_rows[:3],
    }


@router.post("/upload/statement", response_model=UploadedStatementResponse, status_code=201)
async def upload_statement(
    file:         UploadFile      = File(...),
    vendor_name:  str             = Form(...),
    current_user: User            = Depends(get_current_user),
    db:           AsyncSession    = Depends(get_db),
):
    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    encrypted   = encrypt_file(raw_bytes)
    storage_key = f"statements/{current_user.company_id}/{uuid.uuid4()}/{file.filename}"
    await write_file(storage_key, encrypted)

    # Company's chosen PDF extraction strategy (auto / pdfplumber / ocr / llm)
    company = await db.get(Company, current_user.company_id)
    pdf_method = (company.pdf_extraction_method if company else "auto") or "auto"

    fname_lower = (file.filename or "").lower()
    try:
        if fname_lower.endswith(".pdf"):
            result         = extract_statement(raw_bytes, method=pdf_method)
            extracted_data = {"line_items": [li.model_dump(mode="json") for li in result.line_items]}
            confidence     = result.confidence
            method         = result.method
        else:
            df             = parse_ledger_file(raw_bytes, file.filename or "upload.csv")
            extracted_data = {"line_items": _json_safe_records(df)}
            confidence     = 1.0
            method         = "tabular"
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    record = UploadedStatement(
        company_id=current_user.company_id,
        uploaded_by=current_user.id,
        vendor_name=vendor_name,
        original_filename=file.filename or "upload",
        storage_key=storage_key,
        file_size_bytes=len(raw_bytes),
        extracted_data=extracted_data,
        extraction_confidence=confidence,
        extraction_method=method,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.post("/upload/ledger", response_model=LedgerExportResponse, status_code=201)
async def upload_ledger(
    file:           UploadFile   = File(...),
    column_mapping: str | None   = Form(None),
    current_user:   User         = Depends(get_current_user),
    db:             AsyncSession = Depends(get_db),
):
    import json

    raw_bytes = await file.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    col_map: dict | None = json.loads(column_mapping) if column_mapping else None

    try:
        df = parse_ledger_file(raw_bytes, file.filename or "ledger.csv", col_map)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    encrypted   = encrypt_file(raw_bytes)
    storage_key = f"ledgers/{current_user.company_id}/{uuid.uuid4()}/{file.filename}"
    await write_file(storage_key, encrypted)

    record = LedgerExport(
        company_id=current_user.company_id,
        uploaded_by=current_user.id,
        original_filename=file.filename or "ledger",
        storage_key=storage_key,
        file_size_bytes=len(raw_bytes),
        row_count=len(df),
        column_mapping=col_map,
        parsed_data={"rows": _json_safe_records(df)},
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


# ── Job List ──────────────────────────────────────────────────────────────────

@router.get("/jobs")
async def list_jobs(
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    """Return all reconciliation jobs for the current company, newest first, with vendor name."""
    result = await db.execute(
        select(ReconciliationJob, UploadedStatement.vendor_name)
        .join(UploadedStatement, ReconciliationJob.statement_id == UploadedStatement.id)
        .where(ReconciliationJob.company_id == current_user.company_id)
        .order_by(ReconciliationJob.created_at.desc())
        .limit(100)
    )
    rows = result.all()
    out = []
    for job, vendor_name in rows:
        d = ReconciliationJobResponse.model_validate(job).model_dump(mode="json")
        d["vendor_name"]  = vendor_name
        d["created_at"]   = job.created_at.isoformat()
        out.append(d)
    return out


# ── Reconciliation ─────────────────────────────────────────────────────────────

@router.post("/reconcile", response_model=ReconciliationJobResponse, status_code=202)
async def submit_reconciliation(
    payload:      ReconcileRequest,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
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

    await enqueue_reconciliation_job(str(job.id))
    return job


@router.get("/jobs/{job_id}", response_model=ReconciliationJobResponse)
async def get_job_status(
    job_id:       uuid.UUID,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    job = await db.get(ReconciliationJob, job_id)
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    return job


@router.get("/jobs/{job_id}/report", response_model=ExceptionsReportResponse)
async def get_exceptions_report(
    job_id:       uuid.UUID,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    job = await db.get(ReconciliationJob, job_id)
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=409, detail=f"Job not completed (status={job.status.value}).")
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
    page:         int          = Query(default=1, ge=1),
    page_size:    int          = Query(default=100, ge=1, le=500),
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    job = await db.get(ReconciliationJob, job_id)
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.COMPLETED or not job.line_items:
        raise HTTPException(status_code=409, detail="Job not completed.")

    matched = [li for li in job.line_items if li["category"] == "Matched"]
    start   = (page - 1) * page_size
    return [LineItemOut(**li) for li in matched[start: start + page_size]]


@router.get("/jobs/{job_id}/export/xlsx")
async def export_xlsx(
    job_id:       uuid.UUID,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    job = await db.get(ReconciliationJob, job_id)
    if not job or job.company_id != current_user.company_id:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.COMPLETED or not job.line_items:
        raise HTTPException(status_code=409, detail="Job not completed.")

    df_all = pd.DataFrame(job.line_items)

    # ── Ensure numeric columns are real numbers (0 for blanks) ────────────────
    # variance is None for missing/credit rows — Excel should show 0, not blank,
    # so the column stays fully numeric and is safe to SUM/filter in Excel.
    numeric_cols = ["supplier_amount", "ledger_amount", "variance", "balance_due"]
    for col in numeric_cols:
        if col in df_all.columns:
            df_all[col] = pd.to_numeric(df_all[col], errors="coerce").fillna(0.0)

    # Order columns logically for the report
    preferred = ["invoice_id", "invoice_date", "category", "supplier_amount",
                 "ledger_amount", "variance", "balance_due", "notes"]
    ordered = [c for c in preferred if c in df_all.columns] + \
              [c for c in df_all.columns if c not in preferred]
    df_all = df_all[ordered]

    df_exceptions = df_all[df_all["category"] != "Matched"]
    df_matched    = df_all[df_all["category"] == "Matched"]

    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df_exceptions.to_excel(writer, sheet_name="Exceptions", index=False)
        df_matched.to_excel(writer, sheet_name="Matched", index=False)
        # Apply number formatting + column widths
        money_format = "#,##0.00"
        money_cols = {"supplier_amount", "ledger_amount", "variance", "balance_due"}
        for sheet_name in writer.sheets:
            ws = writer.sheets[sheet_name]
            headers = [c.value for c in ws[1]]
            for idx, header in enumerate(headers, start=1):
                letter = ws.cell(row=1, column=idx).column_letter
                # Width
                col_cells = ws[letter]
                width = max(len(str(c.value or "")) for c in col_cells)
                ws.column_dimensions[letter].width = min(width + 2, 40)
                # Number format for money columns
                if header in money_cols:
                    for cell in col_cells[1:]:       # skip header row
                        cell.number_format = money_format

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="reconciliation_{job_id}.xlsx"'},
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_summary_dict(job: ReconciliationJob) -> dict:
    total   = job.total_supplier_lines or 0
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
