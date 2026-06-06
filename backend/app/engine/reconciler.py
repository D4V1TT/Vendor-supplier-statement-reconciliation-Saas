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
import re
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


# ── Money Parsing ─────────────────────────────────────────────────────────────

def _to_money(series: pd.Series) -> pd.Series:
    """
    Convert a column of messy monetary strings to floats.
    Handles: thousands commas (1,500.00), currency symbols ($ £ €),
    parenthesis-negatives ((450.00) → -450.00), and trailing/leading spaces.
    """
    s = series.astype(str).str.strip()
    # Parenthesis = negative
    neg = s.str.startswith("(") & s.str.endswith(")")
    s = s.str.replace(r"[(),$£€\s]", "", regex=True)
    # Handle trailing minus (some systems write "450.00-")
    trailing_neg = s.str.endswith("-")
    s = s.str.rstrip("-")
    nums = pd.to_numeric(s, errors="coerce")
    nums = nums.where(~neg, -nums.abs())
    nums = nums.where(~trailing_neg, -nums.abs())
    return nums


# ── Input Normalisation ───────────────────────────────────────────────────────

def _normalise(df: pd.DataFrame, source: str) -> pd.DataFrame:
    """
    Enforce column types and clean strings.
    Uses the smart column detector (keyword → content → LLM waterfall)
    to find invoice_id and amount regardless of what the file calls them.
    """
    from app.engine.column_detector import detect_columns  # noqa: PLC0415

    df = df.copy()
    detected = detect_columns(df)

    if detected.missing_required:
        raise ValueError(
            f"{source}: could not identify required columns {detected.missing_required}. "
            f"File has these columns: {detected.raw_columns}. "
            f"Please re-upload with a column mapping."
        )

    # Apply the detected mapping (renames raw → canonical)
    df = detected.apply(df)
    logger.debug("%s column mapping (method=%s, confidence=%.2f): %s",
                 source, detected.method, detected.overall_confidence,
                 detected.mapping)

    df = df.copy()
    df["invoice_id"] = df["invoice_id"].astype(str).str.strip().str.upper()

    # ── Synthesize amount from Debit/Credit columns if needed ─────────────────
    # Many statements use two columns (Debit, Credit) instead of one signed
    # amount. Net = |debit| - |credit|  →  invoices positive, credits negative.
    if "amount" not in df.columns:
        debit  = _to_money(df["debit"])  if "debit"  in df.columns else 0.0
        credit = _to_money(df["credit"]) if "credit" in df.columns else 0.0
        df["amount"] = debit.abs().fillna(0) - credit.abs().fillna(0)
    else:
        df["amount"] = _to_money(df["amount"])

    # ── Drop summary / total rows (false exceptions otherwise) ────────────────
    # These commonly appear at the bottom of statements: TOTAL, SUBTOTAL,
    # BALANCE C/F, GRAND TOTAL, AMOUNT DUE, etc.
    summary_keywords = (
        "TOTAL", "SUBTOTAL", "SUB TOTAL", "BALANCE", "GRAND TOTAL",
        "AMOUNT DUE", "SUM", "OPENING", "CLOSING", "CARRIED FORWARD",
        "BROUGHT FORWARD", "C/F", "B/F", "TOTALS",
    )
    before = len(df)
    summary_re = r"\b(?:TOTAL|SUBTOTAL|CARRIED\s+FORWARD|BROUGHT\s+FORWARD|AMOUNT\s+DUE)\b"

    # Scan ALL string columns for summary keywords (the label may have leaked
    # into the date/description column on whitespace-aligned statements).
    id_upper = df["invoice_id"].str.upper().str.strip()
    is_summary = id_upper.isin(summary_keywords) | id_upper.str.contains(summary_re, regex=True, na=False)
    for col in ("invoice_date", "description"):
        if col in df.columns:
            is_summary |= df[col].astype(str).str.upper().str.contains(summary_re, regex=True, na=False)

    # Reject IDs that are clearly money values ($52,150.00) — real invoice refs
    # contain at least one letter or a separator like "-".
    looks_like_money = id_upper.str.match(r"^[\$£€]?[\d,]+\.?\d*$", na=False)
    is_summary |= looks_like_money

    df = df[~is_summary]
    if before - len(df):
        logger.info("%s: dropped %d summary/total/junk row(s).", source, before - len(df))

    # Drop rows with blank/NaN invoice IDs
    df = df[df["invoice_id"].str.strip().ne("") & df["invoice_id"].str.upper().ne("NAN")]

    # Treat null / unparseable amounts as 0.00 (keep the row, don't drop it).
    null_amounts = int(df["amount"].isna().sum())
    if null_amounts:
        logger.info("%s: %d row(s) had null/unparseable amounts — treated as 0.00.", source, null_amounts)
        df["amount"] = df["amount"].fillna(0.0)

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
    flag_unapplied_credits: bool = True,
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
        # Only applies when the company has "flag unapplied credits" enabled.
        if flag_unapplied_credits and ledger_amount is None and supp_amount < 0:
            # Ledger has no entry → ledger value is effectively 0, so the full
            # supplier amount is the discrepancy (variance = supplier - 0).
            line_items.append(
                LineItemResult(
                    invoice_id=inv_id,
                    invoice_date=inv_date,
                    supplier_amount=supp_amount,
                    ledger_amount=None,
                    variance=round(supp_amount, 2),
                    category=FLAGGED_UNAPPLIED_CREDIT,
                    balance_due=balance_due,
                    notes=(
                        f"Credit of {supp_amount:,.2f} on supplier statement "
                        "has no matching entry in the internal ledger."
                    ),
                )
            )
            continue

        # Credit-flagging disabled: ignore credits absent from the ledger
        # (don't let them fall through to Rule 3 as "Missing").
        if not flag_unapplied_credits and ledger_amount is None and supp_amount < 0:
            continue

        # ── Rule 3 ────────────────────────────────────────────────────────────
        if ledger_amount is None:
            # Missing from ledger → ledger value is effectively 0, so the full
            # supplier amount is the discrepancy (variance = supplier - 0).
            line_items.append(
                LineItemResult(
                    invoice_id=inv_id,
                    invoice_date=inv_date,
                    supplier_amount=supp_amount,
                    ledger_amount=None,
                    variance=round(supp_amount, 2),
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
    # Total variance = sum of ALL discrepancies (mismatches + missing + credits),
    # i.e. total unreconciled exposure between supplier statement and ledger.
    total_variance = sum(
        li.variance for li in line_items
        if li.category != MATCHED and li.variance is not None
    )

    summary = ReconciliationSummary(
        total_supplier_lines=len(line_items),
        count_matched=categories.count(MATCHED),
        count_amount_mismatch=categories.count(FLAGGED_AMOUNT_MISMATCH),
        count_missing_in_ledger=categories.count(FLAGGED_MISSING_IN_LEDGER),
        count_unapplied_credit=categories.count(FLAGGED_UNAPPLIED_CREDIT),
        total_variance=total_variance,
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


# ── Robust File Readers ───────────────────────────────────────────────────────

def _detect_delimiter(sample: str) -> str:
    """
    Sniff the most likely delimiter from a text sample.
    Falls back to counting candidate chars if csv.Sniffer fails.
    """
    import csv  # noqa: PLC0415

    candidates = [",", "\t", ";", "|"]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters="".join(candidates))
        return dialect.delimiter
    except Exception:
        # Count occurrences across lines — most frequent consistent char wins
        counts = {d: sample.count(d) for d in candidates}
        return max(counts, key=counts.get) if any(counts.values()) else ","


def _find_header_row(lines: list[str], delimiter: str) -> int:
    """
    Find the index of the real header row, skipping any title/preamble lines.

    Heuristic: the header is the first line that
      (a) splits into >= 2 fields on the delimiter, AND
      (b) is followed by a line with the SAME number of fields.
    This skips single-cell title banners like "ACME MOTORS — STATEMENT".
    """
    field_counts = [len(line.split(delimiter)) for line in lines]

    for i in range(len(lines) - 1):
        if field_counts[i] >= 2 and field_counts[i] == field_counts[i + 1]:
            return i
    # Fallback: first line that has more than one field
    for i, fc in enumerate(field_counts):
        if fc >= 2:
            return i
    return 0


def _is_separator_line(line: str) -> bool:
    """True for divider lines made only of dashes/equals/underscores/spaces."""
    stripped = line.strip()
    return bool(stripped) and bool(re.fullmatch(r"[\-=_\+\s\|]+", stripped))


# Section-title keywords that hint a block is NOT the invoice table.
_NON_INVOICE_SECTION = re.compile(
    r"\b(payment|remittance|received|deposit|bank|wire|cheque|check\s+received|"
    r"aging|ageing|summary|vendor\s+info|bill\s+to|ship\s+to|contact)\b",
    re.IGNORECASE,
)
# Section-title keywords that hint a block IS the invoice table.
_INVOICE_SECTION = re.compile(
    r"\b(invoice|itemi[sz]ed|transaction|charges|statement\s+detail|"
    r"outstanding|open\s+item|line\s+item)\b",
    re.IGNORECASE,
)


def _segment_blocks(raw_lines: list[str]) -> list[dict]:
    """
    Split a statement into candidate table blocks.

    A block boundary is a blank line, a separator line, or a section-title
    line (a short line of mostly letters, e.g. "PAYMENTS RECEIVED").
    Each returned block carries the nearest preceding title line so we can
    bias scoring toward "Itemized Transactions" over "Payments".
    """
    blocks: list[dict] = []
    current: list[str] = []
    current_title = ""
    last_title = ""

    def _is_title(line: str) -> bool:
        s = line.strip()
        if not s or len(s) > 60:
            return False
        # A title is a single label — reject anything containing a delimiter
        # (comma/tab/semicolon/pipe), which would make it a header or data row.
        if re.search(r"[,\t;|]", s):
            return False
        # Mostly letters, few digits — looks like a heading, not a data row
        letters = sum(c.isalpha() for c in s)
        digits  = sum(c.isdigit() for c in s)
        # Single "cell" when split on 2+ spaces (no columnar structure)
        return letters >= 3 and digits <= 2 and len(re.split(r"\s{2,}", s)) <= 2

    def _flush():
        nonlocal current, current_title
        if len(current) >= 2:          # need at least header + 1 row
            blocks.append({"title": current_title, "lines": current})
        current = []

    for ln in raw_lines:
        # Separator lines (-----, =====) are skipped, NOT treated as block
        # boundaries — a dashed underline often sits between a header and its
        # data rows and must not split them apart.
        if _is_separator_line(ln):
            continue
        if not ln.strip():
            _flush()
            continue
        if _is_title(ln) and not current:
            # Title immediately precedes the next block
            last_title = ln.strip()
            continue
        if _is_title(ln) and current:
            # A title mid-stream ends the current block and starts a new one
            _flush()
            last_title = ln.strip()
            continue
        if not current:
            current_title = last_title
        current.append(ln)
    _flush()
    return blocks


def _parse_table_lines(lines: list[str], filename_lower: str) -> pd.DataFrame:
    """Parse ONE block of content lines (delimited or whitespace-aligned)."""
    import io  # noqa: PLC0415

    content = [ln for ln in lines if ln.strip() and not _is_separator_line(ln)]
    if len(content) < 2:
        raise ValueError("Block too small to be a table.")

    if filename_lower.endswith(".tsv"):
        delimiter = "\t"
    elif filename_lower.endswith(".csv"):
        delimiter = ","
    else:
        delimiter = _detect_delimiter("\n".join(content[:20]))

    def _consistency(sep: str | None) -> tuple[int, float]:
        if sep is None:
            counts = [len(re.split(r"\s{2,}", ln.strip())) for ln in content[:30]]
        else:
            counts = [len(ln.split(sep)) for ln in content[:30]]
        counts = [c for c in counts if c > 1]
        if not counts:
            return (0, 0.0)
        modal = max(set(counts), key=counts.count)
        return (modal, counts.count(modal) / len(counts))

    delim_modal, delim_score = _consistency(delimiter)
    ws_modal,    ws_score    = _consistency(None)

    use_whitespace = (
        (ws_modal > delim_modal and ws_modal >= 3)
        or (ws_modal >= 3 and ws_score >= 0.6 and delim_score < 0.85)
        or delim_modal < 2
    )

    if use_whitespace:
        df = _parse_whitespace_aligned(content)
    else:
        header_idx = _find_header_row(content, delimiter)
        df = pd.read_csv(
            io.StringIO("\n".join(content[header_idx:])),
            sep=delimiter, engine="python", skip_blank_lines=True,
            on_bad_lines="skip", dtype=str,
        )

    df = df.dropna(axis=1, how="all")
    df = df.loc[:, ~df.columns.astype(str).str.match(r"^Unnamed")]
    return df


def _score_invoice_table(df: pd.DataFrame, title: str) -> float:
    """
    Score how likely a parsed block is THE invoice/transactions table.
    Higher = better. Combines column-detection confidence, row count,
    and section-title hints (favour "invoices", penalise "payments").
    """
    if df.empty or len(df.columns) < 2:
        return 0.0
    try:
        from app.engine.column_detector import detect_columns  # noqa: PLC0415
        det = detect_columns(df)
    except Exception:
        return 0.0

    if det.missing_required:
        return 0.0   # no invoice_id+amount → not the invoice table

    score = det.overall_confidence
    score += min(len(df), 50) * 0.01          # more rows = more likely the grid
    if title:
        if _INVOICE_SECTION.search(title):
            score += 0.5
        if _NON_INVOICE_SECTION.search(title):
            score -= 0.6
    return score


def _read_delimited_robust(file_bytes: bytes, filename_lower: str) -> pd.DataFrame:
    """
    Parse a CSV/TSV/TXT/space-aligned statement that may contain MULTIPLE
    tables (e.g. Itemized Transactions + Payments). Segments the file into
    blocks, parses & scores each, and returns the one that best matches an
    invoice/transactions table.
    """
    text = file_bytes.decode("utf-8-sig", errors="ignore")
    raw_lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")

    blocks = _segment_blocks(raw_lines)
    if not blocks:
        raise ValueError("File appears to be empty or has no tabular data.")

    # Parse + score every block; keep the best invoice-like table.
    best_df: pd.DataFrame | None = None
    best_score = 0.0
    for block in blocks:
        try:
            df = _parse_table_lines(block["lines"], filename_lower)
        except Exception:
            continue
        s = _score_invoice_table(df, block["title"])
        logger.debug("Block (title=%r, rows=%d) scored %.3f", block["title"], len(df), s)
        if s > best_score:
            best_score, best_df = s, df

    # Fallback: if scoring found nothing usable, parse the whole file as one table
    if best_df is None:
        all_content = [ln for ln in raw_lines if ln.strip() and not _is_separator_line(ln)]
        if not all_content:
            raise ValueError("File appears to be empty.")
        best_df = _parse_table_lines(all_content, filename_lower)

    if best_df.empty or len(best_df.columns) < 2:
        raise ValueError(
            "Could not identify a valid data table in the file. "
            "Ensure it has a header row with at least an invoice ID and amount column."
        )

    return best_df


def _parse_whitespace_aligned(lines: list[str]) -> pd.DataFrame:
    """
    Parse a space/fixed-width-aligned table by splitting each row on runs
    of 2+ spaces. Finds the header row, then aligns each data row to it.
    """
    # Find header: first row that splits into >= 3 fields AND whose next row
    # splits into the same count (data rows below it).
    split_counts = [len(re.split(r"\s{2,}", ln.strip())) for ln in lines]
    header_idx = 0
    for i in range(len(lines) - 1):
        if split_counts[i] >= 3 and abs(split_counts[i] - split_counts[i + 1]) <= 1:
            header_idx = i
            break

    headers = [h.strip() for h in re.split(r"\s{2,}", lines[header_idx].strip())]
    n_cols  = len(headers)

    rows: list[list[str]] = []
    for ln in lines[header_idx + 1:]:
        parts = [p.strip() for p in re.split(r"\s{2,}", ln.strip())]
        if len(parts) < 2:
            continue
        # Pad or trim to header width
        if len(parts) < n_cols:
            parts += [""] * (n_cols - len(parts))
        elif len(parts) > n_cols:
            # Merge the overflow into the widest text column (usually description)
            parts = parts[: n_cols - 1] + [" ".join(parts[n_cols - 1:])]
        rows.append(parts)

    return pd.DataFrame(rows, columns=headers)


def _read_excel_robust(buffer, engine: str) -> pd.DataFrame:
    """
    Read Excel, auto-skipping leading title rows.
    Finds the first row where >= 2 cells are non-empty and treats it as header.
    """
    # First read with no header to locate the real header row
    preview = pd.read_excel(buffer, engine=engine, header=None, nrows=15)
    header_row = 0
    for i in range(len(preview)):
        non_empty = preview.iloc[i].notna().sum()
        if non_empty >= 2:
            header_row = i
            break

    buffer.seek(0)
    df = pd.read_excel(buffer, engine=engine, header=header_row)
    df = df.dropna(axis=1, how="all")
    df = df.loc[:, ~df.columns.astype(str).str.match(r"^Unnamed")]
    return df


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
    import io  # noqa: PLC0415

    filename_lower = filename.lower()

    if filename_lower.endswith((".xlsx", ".xls")):
        df = _read_excel_robust(io.BytesIO(file_bytes), engine="openpyxl")
    elif filename_lower.endswith((".ods",)):
        df = _read_excel_robust(io.BytesIO(file_bytes), engine="odf")
    elif filename_lower.endswith((".csv", ".tsv", ".txt")):
        df = _read_delimited_robust(file_bytes, filename_lower)
    else:
        raise ValueError(
            f"Unsupported file format: '{filename}'. "
            "Accepted formats: PDF, XLSX, XLS, CSV, TSV, TXT, ODS."
        )

    # Apply user-supplied mapping first (explicit always wins)
    if column_mapping:
        df.rename(columns=column_mapping, inplace=True)

    # Then run the smart detector on remaining columns
    from app.engine.column_detector import detect_columns, apply_mapping  # noqa: PLC0415
    detected = detect_columns(df)
    df = detected.apply(df)

    logger.info("Ledger parsed: %d rows, columns=%s", len(df), list(df.columns))
    return df
