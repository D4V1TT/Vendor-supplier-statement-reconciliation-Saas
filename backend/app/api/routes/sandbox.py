"""
Public sandbox endpoint (Product-Led Growth).

Runs a full reconciliation entirely in memory — NO authentication, NO database
storage, NO file persistence. Lets prospects try the tool on their own files
before signing up. The frontend blurs the detail rows and gates the full report
behind sign-up, but the summary counts shown are REAL (computed from the upload).

Abuse protection:
  - hard file-size cap (per file)
  - row cap on returned line items
  - everything is ephemeral (discarded after the response)
"""

import io
import math

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.engine.pdf_extractor import extract_statement
from app.engine.reconciler import parse_ledger_file, reconcile

router = APIRouter(prefix="/sandbox", tags=["sandbox"])

MAX_FILE_BYTES = 3 * 1024 * 1024     # 3 MB per file
MAX_PREVIEW_ROWS = 50                # cap rows returned to the browser


def _safe_records(df: pd.DataFrame) -> list[dict]:
    recs = df.to_dict(orient="records")
    for r in recs:
        for k, v in r.items():
            if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                r[k] = None
            elif pd.isna(v):
                r[k] = None
    return recs


def _load_dataframe(raw: bytes, filename: str) -> pd.DataFrame:
    """Parse an uploaded file (PDF via extractor, else tabular) into a DataFrame."""
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        result = extract_statement(raw)
        return result.to_dataframe()
    return parse_ledger_file(raw, filename or "upload.csv")


@router.post("/reconcile")
async def sandbox_reconcile(
    statement: UploadFile = File(...),
    ledger:    UploadFile = File(...),
):
    """
    Public: reconcile a statement against a ledger in-memory and return the
    real summary + a capped, blurred-on-the-client preview of exceptions.
    """
    # Anonymous sandbox = free tier → no paid LLM fallback.
    from app.core.llm_gate import set_llm_allowed  # noqa: PLC0415
    set_llm_allowed(False)

    stmt_bytes   = await statement.read()
    ledger_bytes = await ledger.read()

    if not stmt_bytes or not ledger_bytes:
        raise HTTPException(status_code=400, detail="Both files are required.")
    if len(stmt_bytes) > MAX_FILE_BYTES or len(ledger_bytes) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="Sandbox files must be under 3 MB each. Sign up for larger files.")

    try:
        supplier_df = _load_dataframe(stmt_bytes,  statement.filename)
        ledger_df   = _load_dataframe(ledger_bytes, ledger.filename)
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        report = reconcile(supplier_df, ledger_df)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    report_dict = report.to_dict()
    summary     = report_dict["summary"]

    # Only return exception rows (capped) — matched lines stay hidden in sandbox
    exceptions = [li for li in report_dict["line_items"] if li["category"] != "Matched"]
    preview = exceptions[:MAX_PREVIEW_ROWS]

    return {
        "summary":    summary,
        "exceptions": preview,
        "truncated":  len(exceptions) > MAX_PREVIEW_ROWS,
        "total_exceptions": len(exceptions),
    }
