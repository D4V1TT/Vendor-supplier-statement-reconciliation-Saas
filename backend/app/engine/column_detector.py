"""
Smart Column Detector — 3-Phase Resolution Strategy
====================================================

Phase 1 — SANITIZATION       (Regex + lowercasing)   → instant, free
          Strip spaces, dots, underscores, hyphens & casing differences so
          "Invoice #", "invoice_no.", "INVOICE-NO" all collapse to "invoiceno".

Phase 2 — ALIAS MATCHING     (Local dictionary lookup) → instant, free
          Map known variants (inv_no, ref, supplier_ref, document_number, …)
          to our canonical field names via a static alias table.

Phase 2.5 — CONTENT INFERENCE (Data-shape heuristics)  → instant, free
          For columns the alias table missed, peek at actual cell values:
          unique short alphanumerics → invoice_id, financial numerics → amount.
          (A cheap local safety-net before paying for the LLM.)

Phase 3 — SEMANTIC FALLBACK  (LLM + structured output) → ms, fraction of a cent
          For genuinely unpredictable / translated column names, send the
          headers + 3 sample rows to Claude and get a structured JSON mapping.

The waterfall short-circuits: each phase only runs for canonical fields the
previous phases failed to resolve, so the LLM is touched only when truly needed.

Returns a ColumnMapping carrying per-field confidence so the caller can
auto-proceed (high confidence) or surface a confirmation UI (low confidence).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

import pandas as pd

logger = logging.getLogger(__name__)

# ── Canonical target schema ───────────────────────────────────────────────────
REQUIRED_COLS = {"invoice_id", "amount"}
OPTIONAL_COLS = {"invoice_date", "balance_due", "description", "po_number"}
ALL_CANONICAL = REQUIRED_COLS | OPTIONAL_COLS

# Confidence assigned by each phase (earlier/cheaper phases are more trusted
# when they're specific; the LLM gets a solid-but-not-perfect score).
CONF_EXACT_ALIAS   = 1.00
CONF_PARTIAL_ALIAS = 0.88
CONF_CONTENT       = 0.62
CONF_LLM           = 0.85

# Auto-proceed threshold — below this we ask the user to confirm.
CONFIDENCE_THRESHOLD = 0.75


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — SANITIZATION
# ══════════════════════════════════════════════════════════════════════════════

def sanitize(name: str) -> str:
    """
    Normalise a single column name to a comparable token.
      "Invoice #"      → "invoice"
      "invoice_no."    → "invoiceno"
      "INVOICE-NUMBER" → "invoicenumber"
      "Bal. Due ($)"   → "baldue"
    """
    s = str(name).strip().lower()
    s = re.sub(r"[\s\-_\./\\#]+", "", s)   # remove all separators/symbols
    s = re.sub(r"[^a-z0-9]", "", s)         # keep only alphanumerics
    return s


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — ALIAS MATCHING (local dictionary)
# ══════════════════════════════════════════════════════════════════════════════
# Each canonical field maps to a set of *sanitized* known variants.
# "exact" = the whole sanitized column equals a variant (highest trust).
# "partial" = a variant is a substring of the column (or vice-versa).

ALIASES: dict[str, list[str]] = {
    "invoice_id": [
        "invoiceid", "invoiceno", "invoiceno", "invoicenum", "invoicenumber",
        "invoiceref", "invref", "invid", "invno", "invnum", "invnumber",
        "documentno", "documentnumber", "docno", "docnum", "docref", "docid",
        "transactionid", "transactionno", "transactionnumber", "transno",
        "transid", "txnid", "txnno", "refno", "refnum", "referenceno",
        "referencenumber", "referenceid", "refid", "billno", "billnum", "billid",
        "voucherno", "vouchernum", "voucherid", "folio", "entryno",
        "supplierref", "vendorref", "supplierinvoice", "vendorinvoice",
        "invoice", "inv", "reference", "ref", "document", "voucher", "bill",
    ],
    "amount": [
        "amount", "amt", "totalamount", "invoiceamount", "grossamount",
        "netamount", "grossvalue", "netvalue", "invoicevalue", "totalvalue",
        "lineamount", "linevalue", "debit", "debitamount", "charge",
        "chargeamount", "billedamount", "billedvalue", "originalamount",
        "txnamount", "transactionamount", "value", "total", "subtotal",
    ],
    "balance_due": [
        "balancedue", "outstanding", "openamount", "openbalance", "dueamount",
        "amountdue", "remaining", "remainingbalance", "unpaid", "overdue",
        "balance", "due", "outstandingamount", "outstandingbalance",
    ],
    "invoice_date": [
        "invoicedate", "invdate", "dateofinvoice", "docdate", "documentdate",
        "transactiondate", "transdate", "txndate", "postingdate", "entrydate",
        "billdate", "issuedate", "servicedate", "invoicedt", "date", "dt",
    ],
    "description": [
        "description", "desc", "particulars", "narration", "details", "item",
        "linedescription", "goods", "services", "memo", "note", "remarks",
    ],
    "po_number": [
        "ponumber", "pono", "ponum", "purchaseorder", "orderno", "ordernum",
        "orderid", "po", "purchaseorderno",
    ],
}


def _alias_match(columns: list[str]) -> dict[str, tuple[str, float]]:
    """
    Returns {canonical: (raw_col, confidence)}.
    A column is claimed by at most one canonical (first/most-specific wins),
    and a canonical takes the strongest-scoring column available.
    """
    result: dict[str, tuple[str, float]] = {}
    sanitized = {raw: sanitize(raw) for raw in columns}
    claimed: set[str] = set()

    # Iterate canonicals in REQUIRED-first order so they get first pick.
    ordered = list(REQUIRED_COLS) + list(OPTIONAL_COLS)
    for canon in ordered:
        variants = ALIASES.get(canon, [])
        best_raw, best_conf = "", 0.0

        for raw, san in sanitized.items():
            if raw in claimed:
                continue
            conf = 0.0
            if san in variants:
                conf = CONF_EXACT_ALIAS
            else:
                # partial: a variant contained in the column name (or reverse)
                for v in variants:
                    if (v in san or san in v) and len(min(v, san, key=len)) >= 3:
                        conf = CONF_PARTIAL_ALIAS
                        break
            if conf > best_conf:
                best_raw, best_conf = raw, conf

        if best_raw:
            result[canon] = (best_raw, best_conf)
            claimed.add(best_raw)

    return result


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2.5 — CONTENT INFERENCE (local safety-net before the LLM)
# ══════════════════════════════════════════════════════════════════════════════

def _content_match(df: pd.DataFrame, claimed: set[str]) -> dict[str, tuple[str, float]]:
    """Identify still-unclaimed columns by the shape of their data."""
    result: dict[str, tuple[str, float]] = {}
    free_cols = [c for c in df.columns if c not in claimed]

    for col in free_cols:
        sample = df[col].dropna().head(20)
        if sample.empty:
            continue
        str_sample = sample.astype(str)

        # invoice_id: short, mostly-unique alphanumeric codes
        if "invoice_id" not in result:
            looks_id = (
                str_sample.str.match(r"^[A-Za-z0-9][\w\-/\.]{1,30}$").mean() > 0.7
                and str_sample.str.len().mean() < 25
                and (str_sample.nunique() / max(len(str_sample), 1)) > 0.8
            )
            if looks_id:
                result["invoice_id"] = (col, CONF_CONTENT)
                continue

        # amount: numeric with financial magnitude
        if "amount" not in result:
            numeric = pd.to_numeric(sample, errors="coerce")
            if numeric.notna().mean() > 0.7 and numeric.abs().mean() > 1:
                result["amount"] = (col, CONF_CONTENT)
                continue

        # invoice_date: date-shaped strings
        if "invoice_date" not in result:
            if str_sample.str.match(r"\d{1,4}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}").mean() > 0.5:
                result["invoice_date"] = (col, CONF_CONTENT)
                continue

    return result


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — SEMANTIC FALLBACK (LLM + structured output)
# ══════════════════════════════════════════════════════════════════════════════

def _llm_match(columns: list[str], sample_rows: list[dict]) -> dict[str, tuple[str, float]]:
    """Ask Claude to map columns → canonical names. Best-effort; returns {} on failure."""
    try:
        import json  # noqa: PLC0415
        import anthropic  # noqa: PLC0415
        from app.core.config import get_settings  # noqa: PLC0415

        settings = get_settings()
        if not settings.ANTHROPIC_API_KEY:
            logger.info("LLM fallback skipped — no ANTHROPIC_API_KEY configured.")
            return {}

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        sample_text = "\n".join(str(r) for r in sample_rows[:3])

        prompt = f"""You are a financial-data expert mapping spreadsheet columns.

Column names: {columns}
First 3 rows:
{sample_text}

Map each column to ONE canonical field (or null):
- invoice_id   : unique invoice / reference / document number
- amount       : monetary value of the invoice or transaction
- invoice_date : date the invoice / transaction was issued
- balance_due  : outstanding / remaining balance
- description  : text description of goods or services
- po_number    : purchase-order number

Column names may be in ANY language. Respond ONLY with JSON:
{{"invoice_id": "<col or null>", "amount": "<col or null>", "invoice_date": "<col or null>", "balance_due": "<col or null>"}}"""

        msg = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", msg.content[0].text.strip(), flags=re.MULTILINE)
        data: dict = json.loads(raw)

        return {
            canon: (raw_col, CONF_LLM)
            for canon, raw_col in data.items()
            if raw_col and canon in ALL_CANONICAL and raw_col in columns
        }
    except Exception as exc:
        logger.warning("LLM column detection failed: %s", exc)
        return {}


# ══════════════════════════════════════════════════════════════════════════════
# RESULT TYPE
# ══════════════════════════════════════════════════════════════════════════════

@dataclass
class ColumnMapping:
    mapping:     dict[str, str]        # {raw_col → canonical}
    confidence:  dict[str, float]      # {canonical → 0.0–1.0}
    undetected:  set[str]              # canonicals not found
    raw_columns: list[str]
    method:      str                   # "alias" | "content" | "llm"
    sample_rows: list[dict] = field(default_factory=list)

    @property
    def overall_confidence(self) -> float:
        scores = [self.confidence.get(c, 0.0) for c in REQUIRED_COLS]
        return min(scores) if scores else 0.0

    @property
    def missing_required(self) -> set[str]:
        return REQUIRED_COLS - set(self.mapping.values())

    @property
    def needs_user_confirmation(self) -> bool:
        return self.overall_confidence < CONFIDENCE_THRESHOLD or bool(self.missing_required)

    def apply(self, df: pd.DataFrame) -> pd.DataFrame:
        return df.rename(columns=self.mapping)


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC ENTRY POINT — runs the waterfall
# ══════════════════════════════════════════════════════════════════════════════

def detect_columns(df: pd.DataFrame) -> ColumnMapping:
    columns     = list(df.columns)
    sample_rows = df.head(5).to_dict(orient="records")
    resolved:   dict[str, tuple[str, float]] = {}   # canonical → (raw, conf)

    # ── Phase 2: Alias (Phase 1 sanitization happens inside _alias_match) ──────
    resolved.update(_alias_match(columns))
    method = "alias"

    # ── Phase 2.5: Content inference for unresolved required fields ────────────
    if REQUIRED_COLS - set(resolved):
        claimed = {raw for raw, _ in resolved.values()}
        for canon, val in _content_match(df, claimed).items():
            resolved.setdefault(canon, val)
        if REQUIRED_COLS & set(_content_match(df, claimed)):
            method = "content"

    # ── Phase 3: LLM fallback only if a required field is still missing ────────
    if REQUIRED_COLS - set(resolved):
        for canon, val in _llm_match(columns, sample_rows).items():
            resolved.setdefault(canon, val)
        if resolved:
            method = "llm"

    # ── Assemble result ───────────────────────────────────────────────────────
    mapping    = {raw: canon for canon, (raw, _) in resolved.items()}
    confidence = {canon: conf for canon, (_, conf) in resolved.items()}
    undetected = ALL_CANONICAL - set(mapping.values())

    logger.info("Column detection (method=%s, confidence=%.2f): %s",
                method, min((confidence.get(c, 0.0) for c in REQUIRED_COLS), default=0.0), mapping)

    return ColumnMapping(
        mapping=mapping,
        confidence=confidence,
        undetected=undetected,
        raw_columns=columns,
        method=method,
        sample_rows=sample_rows,
    )


def apply_mapping(df: pd.DataFrame, column_mapping: dict[str, str]) -> pd.DataFrame:
    """Apply a user-confirmed mapping ({raw → canonical}) to a DataFrame."""
    return df.rename(columns=column_mapping)
