"""
Reconciliation Engine — Section 4

Ingests two DataFrames:
  - supplier_df  : extracted from the vendor PDF statement
  - ledger_df    : parsed from the company's internal AP export (CSV/Excel)

Applies four deterministic rules in order and returns a ReconciliationReport
with every line categorised and a summary of exceptions.

DataFrame column contracts (both inputs must conform):
  supplier_df : invoice_id (str), amount (float), invoice_date (str|None)
  ledger_df   : invoice_id (str), amount (float)

All comparisons are case-insensitive and strip leading/trailing whitespace
on invoice_id so "INV-001" and "inv-001 " are treated as equal.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ── Category Constants ────────────────────────────────────────────────────────

MATCHED                   = "Matched"
FLAGGED_AMOUNT_MISMATCH   = "Flagged_Amount_Mismatch"
FLAGGED_MISSING_IN_LEDGER = "Flagged_Missing_In_Ledger"
FLAGGED_UNAPPLIED_CREDIT  = "Flagged_Unapplied_Credit"

# Monetary tolerance for "exact match" — adjust if your clients use rounding
AMOUNT_TOLERANCE: float = 0.01  # $0.01


# ── Result Types ──────────────────────────────────────────────────────────────

@dataclass
class LineItemResult:
    """Result for a single supplier statement line."""
    invoice_id:        str
    invoice_date:      str | None
    supplier_amount:   float
    ledger_amount:     float | None   # None if not found in ledger
    variance:          float | None   # supplier - ledger (None if no ledger record)
    category:          str
    balance_due:       float | None = None
    notes:             str = ""


@dataclass
class ReconciliationSummary:
    """Aggregated counts and totals — drives the dashboard KPI cards."""
    total_supplier_lines:    int
    count_matched:           int
    count_amount_mismatch:   int
    count_missing_in_ledger: int
    count_unapplied_credit:  int
    total_variance:          float   # sum of all variances (mismatch lines only)

    @property
    def exception_count(self) -> int:
        return (
            self.count_amount_mismatch
            + self.count_missing_in_ledger
            + self.count_unapplied_credit
        )

    @property
    def match_rate_pct(self) -> float:
        if self.total_supplier_lines == 0:
            return 0.0
        return round(self.count_matched / self.total_supplier_lines * 100, 1)


@dataclass
class ReconciliationReport:
    summary:       ReconciliationSummary
    line_items:    list[LineItemResult]
    exceptions:    list[LineItemResult] = field(init=False)

    def __post_init__(self):
        # Pre-compute the exceptions-only view so the API doesn't re-filter
        self.exceptions = [li for li in self.line_items if li.category != MATCHED]

    def to_dict(self) -> dict[str, Any]:
        """Serialise to a plain dict suitable for JSON/JSONB storage."""
        return {
            "summary": {
                "total_supplier_lines":    self.summary.total_supplier_lines,
                "count_matched":           self.summary.count_matched,
                "count_amount_mismatch":   self.summary.count_amount_mismatch,
                "count_missing_in_ledger": self.summary.count_missing_in_ledger,
                "count_unapplied_credit":  self.summary.count_unapplied_credit,
                "total_variance":          round(self.summary.total_variance, 2),
                "exception_count":         self.summary.exception_count,
                "match_rate_pct":          self.summary.match_rate_pct,
            },
            "line_items": [
                {
                    "invoice_id":      li.invoice_id,
                    "invoice_date":    li.invoice_date,
                    "supplier_amount": li.supplier_amount,
                    "ledger_amount":   li.ledger_amount,
                    "variance":        li.variance,
                    "category":        li.category,
                    "balance_due":     li.balance_due,
                    "notes":           li.notes,
                }
                for li in self.line_items
            ],
        }


# ── Input Normalisation ───────────────────────────────────────────────────────

def _normalise(df: pd.DataFrame, source: str) -> pd.DataFrame:
    """
    Enforce column types and clean strings.
    `source` is used only for error messages.
    """
    required = {"invoice_id", "amount"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"{source} DataFrame is missing required columns: {missing}")

    df = df.copy()
    df["invoice_id"] = df["invoice_id"].astype(str).str.strip().str.upper()
    df["amount"]     = pd.to_numeric(df["amount"], errors="coerce")

    null_amounts = df["amount"].isna().sum()
    if null_amounts:
        logger.warning("%s: %d rows with unparseable amounts will be skipped.", source, null_amounts)
        df = df[df["amount"].notna()]

    # Deduplicate on invoice_id — keep the last occurrence (most recently posted)
    dupes = df.duplicated("invoice_id", keep=False)
    if dupes.any():
        logger.warning(
            "%s: %d duplicate invoice IDs found — keeping last occurrence per ID.",
            source,
            dupes.sum(),
        )
        df = df.drop_duplicates("invoice_id", keep="last")

    return df


# ── Core Reconciliation Function ──────────────────────────────────────────────

def reconcile(
    supplier_df: pd.DataFrame,
    ledger_df: pd.DataFrame,
    amount_tolerance: float = AMOUNT_TOLERANCE,
) -> ReconciliationReport:
    """
    Perform line-by-line reconciliation of supplier_df against ledger_df.

    Rules applied (in order — a row can only receive ONE category):
      Rule 1 — Exact Match          : invoice_id found, |supplier - ledger| <= tolerance
      Rule 2 — Amount Mismatch      : invoice_id found, amounts differ beyond tolerance
      Rule 3 — Missing in Ledger    : invoice_id NOT found in ledger AND amount > 0
      Rule 4 — Unapplied Credit     : invoice_id NOT found in ledger AND amount < 0

    Parameters
    ----------
    supplier_df      DataFrame from pdf_extractor.ExtractionResult.to_dataframe()
    ledger_df        DataFrame parsed from the company's AP export
    amount_tolerance Absolute dollar tolerance for "exact" match (default $0.01)

    Returns
    -------
    ReconciliationReport with all line items categorised and summary KPIs.
    """
    supplier_df = _normalise(supplier_df, "supplier")
    ledger_df   = _normalise(ledger_df,   "ledger")

    # Build a fast-lookup dict from the ledger: {invoice_id -> amount}
    ledger_index: dict[str, float] = dict(
        zip(ledger_df["invoice_id"], ledger_df["amount"])
    )

    line_items: list[LineItemResult] = []

    # ── Walk every supplier line ──────────────────────────────────────────────
    for _, row in supplier_df.iterrows():
        inv_id:        str        = row["invoice_id"]
        supp_amount:   float      = float(row["amount"])
        inv_date:      str | None = str(row.get("invoice_date", "") or "").strip() or None
        balance_due:   float | None = (
            float(row["balance_due"]) if "balance_due" in row and pd.notna(row.get("balance_due")) else None
        )

        ledger_amount: float | None = ledger_index.get(inv_id)

        # ── Rule 4 (checked before Rule 3 to catch credits not in ledger) ─────
        if ledger_amount is None and supp_amount < 0:
            line_items.append(
                LineItemResult(
                    invoice_id=inv_id,
                    invoice_date=inv_date,
                    supplier_amount=supp_amount,
                    ledger_amount=None,
                    variance=None,
                    category=FLAGGED_UNAPPLIED_CREDIT,
                    balance_due=balance_due,
                    notes=(
                        f"Credit of {supp_amount:,.2f} on supplier statement "
                        "has no matching entry in the internal ledger."
                    ),
                )
            )
            continue

        # ── Rule 3 ────────────────────────────────────────────────────────────
        if ledger_amount is None:
            line_items.append(
                LineItemResult(
                    invoice_id=inv_id,
                    invoice_date=inv_date,
                    supplier_amount=supp_amount,
                    ledger_amount=None,
                    variance=None,
                    category=FLAGGED_MISSING_IN_LEDGER,
                    balance_due=balance_due,
                    notes=f"Invoice {inv_id} exists on supplier statement but is absent from internal ledger.",
                )
            )
            continue

        # Both sides have this invoice — compare amounts
        variance = round(supp_amount - ledger_amount, 4)

        # ── Rule 1 ────────────────────────────────────────────────────────────
        if abs(variance) <= amount_tolerance:
            line_items.append(
                LineItemResult(
                    invoice_id=inv_id,
                    invoice_date=inv_date,
                    supplier_amount=supp_amount,
                    ledger_amount=ledger_amount,
                    variance=0.0,   # Normalise tiny floating-point noise to zero
                    category=MATCHED,
                    balance_due=balance_due,
                )
            )
            continue

        # ── Rule 2 ────────────────────────────────────────────────────────────
        line_items.append(
            LineItemResult(
                invoice_id=inv_id,
                invoice_date=inv_date,
                supplier_amount=supp_amount,
                ledger_amount=ledger_amount,
                variance=round(variance, 2),
                category=FLAGGED_AMOUNT_MISMATCH,
                balance_due=balance_due,
                notes=(
                    f"Supplier: {supp_amount:,.2f} | Ledger: {ledger_amount:,.2f} | "
                    f"Variance: {variance:+,.2f}"
                ),
            )
        )

    # ── Build summary KPIs ────────────────────────────────────────────────────
    categories = [li.category for li in line_items]
    mismatch_variances = [
        li.variance for li in line_items
        if li.category == FLAGGED_AMOUNT_MISMATCH and li.variance is not None
    ]

    summary = ReconciliationSummary(
        total_supplier_lines=len(line_items),
        count_matched=categories.count(MATCHED),
        count_amount_mismatch=categories.count(FLAGGED_AMOUNT_MISMATCH),
        count_missing_in_ledger=categories.count(FLAGGED_MISSING_IN_LEDGER),
        count_unapplied_credit=categories.count(FLAGGED_UNAPPLIED_CREDIT),
        total_variance=sum(mismatch_variances),
    )

    logger.info(
        "Reconciliation complete: %d lines | matched=%d | mismatch=%d | "
        "missing=%d | credits=%d | total_variance=%.2f",
        summary.total_supplier_lines,
        summary.count_matched,
        summary.count_amount_mismatch,
        summary.count_missing_in_ledger,
        summary.count_unapplied_credit,
        summary.total_variance,
    )

    return ReconciliationReport(summary=summary, line_items=line_items)


# ── Ledger Parser (CSV / Excel) ───────────────────────────────────────────────

def parse_ledger_file(
    file_bytes: bytes,
    filename: str,
    column_mapping: dict[str, str] | None = None,
) -> pd.DataFrame:
    """
    Parse a company's AP ledger export (CSV or Excel) into a normalised DataFrame.

    `column_mapping` is a user-supplied dict mapping the file's actual column
    names to our canonical names, e.g.:
        {"Inv Number": "invoice_id", "Net Value": "amount"}

    If not supplied we attempt auto-detection via _HEADER_ALIASES.
    """
    from app.engine.pdf_extractor import _normalise_headers  # reuse alias table  # noqa: PLC0415

    import io  # noqa: PLC0415

    filename_lower = filename.lower()

    if filename_lower.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(file_bytes), engine="openpyxl")
    elif filename_lower.endswith((".ods",)):
        df = pd.read_excel(io.BytesIO(file_bytes), engine="odf")
    elif filename_lower.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(file_bytes))
    elif filename_lower.endswith(".tsv"):
        df = pd.read_csv(io.BytesIO(file_bytes), sep="\t")
    elif filename_lower.endswith(".txt"):
        # Auto-detect delimiter: try tab first, fall back to comma
        sample = file_bytes[:2048].decode("utf-8", errors="ignore")
        sep = "\t" if sample.count("\t") > sample.count(",") else ","
        df = pd.read_csv(io.BytesIO(file_bytes), sep=sep)
    else:
        raise ValueError(
            f"Unsupported file format: '{filename}'. "
            "Accepted formats: PDF, XLSX, XLS, CSV, TSV, TXT, ODS."
        )

    # Apply user-supplied mapping first, then auto-detect the rest
    if column_mapping:
        df.rename(columns=column_mapping, inplace=True)

    auto_map = _normalise_headers(list(df.columns))
    df.rename(columns=auto_map, inplace=True)

    logger.info("Ledger parsed: %d rows, columns=%s", len(df), list(df.columns))
    return df
