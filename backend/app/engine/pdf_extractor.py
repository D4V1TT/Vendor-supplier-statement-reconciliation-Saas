"""
PDF Extraction Engine — Section 3

Strategy (waterfall, fastest→most expensive):
  1. pdfplumber  — works on text-layer PDFs (most modern vendor statements)
  2. OCR         — pytesseract on pdf2image pages (scanned/image PDFs)
  3. LLM fallback — Anthropic structured output when heuristic confidence < 0.60

Output: ExtractionResult containing a list of StatementLineItem and a
        confidence score (0.0–1.0) so callers can decide how to present
        low-confidence extractions to the user for manual review.
"""

from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Literal

import pandas as pd
import pdfplumber
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)


# ── Output Schema ─────────────────────────────────────────────────────────────

class StatementLineItem(BaseModel):
    """One line on a vendor's statement. All monetary values in Decimal."""
    invoice_id:   str
    invoice_date: str | None   # raw string — normalised downstream
    amount:       Decimal      # positive = invoice, negative = credit note
    balance_due:  Decimal | None

    @field_validator("amount", "balance_due", mode="before")
    @classmethod
    def parse_money(cls, v):
        if v is None:
            return v
        if isinstance(v, (int, float, Decimal)):
            return Decimal(str(v))
        # Strip currency symbols, commas, parentheses (parentheses = negative)
        cleaned = re.sub(r"[£$€,\s]", "", str(v))
        negative = cleaned.startswith("(") and cleaned.endswith(")")
        cleaned = cleaned.strip("()")
        try:
            result = Decimal(cleaned)
            return -result if negative else result
        except InvalidOperation as exc:
            raise ValueError(f"Cannot parse monetary value: {v!r}") from exc


@dataclass
class ExtractionResult:
    line_items:    list[StatementLineItem]
    method:        Literal["pdfplumber", "ocr", "llm"]
    confidence:    float          # 0.0–1.0
    raw_text:      str = field(default="", repr=False)
    warnings:      list[str] = field(default_factory=list)

    def to_dataframe(self) -> pd.DataFrame:
        """Convert to a normalised pandas DataFrame for the reconciliation engine."""
        rows = [item.model_dump() for item in self.line_items]
        df = pd.DataFrame(rows, columns=["invoice_id", "invoice_date", "amount", "balance_due"])
        df["amount"]      = df["amount"].astype(float)
        df["balance_due"] = df["balance_due"].astype(float)
        return df


# ── Column Header Heuristics ──────────────────────────────────────────────────

# Map common vendor-specific column names → our canonical names.
_HEADER_ALIASES: dict[str, str] = {
    # invoice_id
    "invoice":        "invoice_id",
    "invoice #":      "invoice_id",
    "invoice no":     "invoice_id",
    "invoice no.":    "invoice_id",
    "inv #":          "invoice_id",
    "inv no":         "invoice_id",
    "reference":      "invoice_id",
    "ref":            "invoice_id",
    "document no":    "invoice_id",
    # invoice_date
    "date":           "invoice_date",
    "invoice date":   "invoice_date",
    "doc date":       "invoice_date",
    "trans date":     "invoice_date",
    # amount
    "amount":         "amount",
    "invoice amount": "amount",
    "gross amount":   "amount",
    "net amount":     "amount",
    "value":          "amount",
    "debit":          "amount",
    # balance_due
    "balance":        "balance_due",
    "balance due":    "balance_due",
    "outstanding":    "balance_due",
    "open amount":    "balance_due",
    "due":            "balance_due",
}


def _normalise_headers(columns: list[str]) -> dict[str, str]:
    """Return a rename mapping from raw column names to canonical names."""
    mapping = {}
    for col in columns:
        key = col.strip().lower()
        if key in _HEADER_ALIASES:
            mapping[col] = _HEADER_ALIASES[key]
    return mapping


# ── pdfplumber Extraction ─────────────────────────────────────────────────────

def _extract_with_pdfplumber(pdf_bytes: bytes) -> ExtractionResult | None:
    """
    Attempt table extraction using pdfplumber.
    Returns None if no usable table is found (triggers fallback).
    """
    all_rows: list[list] = []
    headers: list[str] = []
    raw_text_pages: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page_num, page in enumerate(pdf.pages, start=1):
            raw_text_pages.append(page.extract_text() or "")

            tables = page.extract_tables()
            for table in tables:
                if not table:
                    continue

                # First row with content becomes the header
                if not headers:
                    candidate = [str(c).strip() if c else "" for c in table[0]]
                    # Only treat as header if it contains recognisable invoice keywords
                    combined = " ".join(candidate).lower()
                    if any(kw in combined for kw in ("invoice", "ref", "amount", "balance", "date")):
                        headers = candidate
                        all_rows.extend(table[1:])
                        continue

                all_rows.extend(table)

    if not headers or not all_rows:
        return None

    # Build DataFrame from raw table
    df = pd.DataFrame(all_rows, columns=headers[: len(all_rows[0])])
    rename_map = _normalise_headers(list(df.columns))
    df.rename(columns=rename_map, inplace=True)

    required = {"invoice_id", "amount"}
    if not required.issubset(df.columns):
        logger.debug("pdfplumber: required columns not found after rename. Got: %s", list(df.columns))
        return None

    if "balance_due" not in df.columns:
        df["balance_due"] = None
    if "invoice_date" not in df.columns:
        df["invoice_date"] = None

    # Drop rows where invoice_id is blank (totals/subtotals lines)
    df = df[df["invoice_id"].astype(str).str.strip().ne("")]
    df = df[df["invoice_id"].notna()]

    line_items, warnings = _parse_dataframe_to_items(df)

    # Confidence: proportion of rows that parsed cleanly
    confidence = len(line_items) / max(len(df), 1)

    return ExtractionResult(
        line_items=line_items,
        method="pdfplumber",
        confidence=confidence,
        raw_text="\n".join(raw_text_pages),
        warnings=warnings,
    )


# ── OCR Extraction ────────────────────────────────────────────────────────────

def _extract_with_ocr(pdf_bytes: bytes) -> ExtractionResult | None:
    """
    Convert each PDF page to an image and run Tesseract OCR.
    Then apply the same header-matching heuristics on the text table.
    """
    try:
        images: list[Image.Image] = convert_from_bytes(pdf_bytes, dpi=300)
    except Exception as exc:
        logger.warning("pdf2image conversion failed: %s", exc)
        return None

    all_text_lines: list[str] = []
    for img in images:
        text = pytesseract.image_to_string(img, config="--psm 6")
        all_text_lines.extend(text.splitlines())

    raw_text = "\n".join(all_text_lines)

    # Try to detect a header row and tabular data from OCR text
    line_items, warnings = _parse_text_lines_to_items(all_text_lines)

    if not line_items:
        return None

    confidence = min(0.75, len(line_items) / max(len(all_text_lines), 1) * 10)

    return ExtractionResult(
        line_items=line_items,
        method="ocr",
        confidence=confidence,
        raw_text=raw_text,
        warnings=warnings,
    )


# ── LLM Extraction (Anthropic Structured Outputs) ─────────────────────────────

def _extract_with_llm(pdf_bytes: bytes, raw_text: str) -> ExtractionResult:
    """
    Use Anthropic Claude to extract structured line items from raw OCR text.
    This is the most expensive path — only reached when confidence < 0.60.
    Returns an ExtractionResult with method="llm".
    """
    # Import here to avoid loading SDK in every worker process
    import anthropic  # noqa: PLC0415
    from app.core.config import get_settings  # noqa: PLC0415

    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    # Truncate very long documents to save tokens (first 6 000 chars covers most statements)
    text_sample = raw_text[:6_000] if raw_text else "(no text extracted — binary/scanned PDF)"

    system_prompt = (
        "You are an expert financial document parser. "
        "Extract ALL line items from the vendor statement text below. "
        "Return ONLY valid JSON — a list of objects with keys: "
        "invoice_id (string), invoice_date (string or null), "
        "amount (number — negative for credits), balance_due (number or null). "
        "Do not include totals, subtotals, or blank rows."
    )

    message = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": f"VENDOR STATEMENT TEXT:\n\n{text_sample}",
            }
        ],
        system=system_prompt,
    )

    import json  # noqa: PLC0415

    raw_json = message.content[0].text.strip()
    # Strip markdown code fences if present
    raw_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_json, flags=re.MULTILINE)

    data = json.loads(raw_json)
    line_items = []
    warnings = []
    for row in data:
        try:
            line_items.append(StatementLineItem(**row))
        except Exception as exc:
            warnings.append(f"LLM row parse error: {exc} — row={row}")

    return ExtractionResult(
        line_items=line_items,
        method="llm",
        confidence=0.85 if line_items else 0.0,
        raw_text=raw_text,
        warnings=warnings,
    )


# ── Row Parsing Helpers ────────────────────────────────────────────────────────

def _parse_dataframe_to_items(df: pd.DataFrame) -> tuple[list[StatementLineItem], list[str]]:
    """Convert a normalised DataFrame into StatementLineItem objects."""
    items: list[StatementLineItem] = []
    warnings: list[str] = []

    for idx, row in df.iterrows():
        try:
            items.append(
                StatementLineItem(
                    invoice_id=str(row["invoice_id"]).strip(),
                    invoice_date=str(row.get("invoice_date", "")).strip() or None,
                    amount=row["amount"],
                    balance_due=row.get("balance_due"),
                )
            )
        except Exception as exc:
            warnings.append(f"Row {idx} skipped — {exc}")

    return items, warnings


# Very simple regex-based line parser used by the OCR path.
_LINE_PATTERN = re.compile(
    r"(?P<inv_id>[A-Z0-9\-/]+)\s+"          # Invoice ID: alphanumeric + dash/slash
    r"(?P<date>\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})?\s*"  # Optional date
    r"(?P<amount>-?[\d,]+\.?\d{0,2})"        # Amount
    r"(?:\s+(?P<balance>-?[\d,]+\.?\d{0,2}))?",  # Optional balance
    re.IGNORECASE,
)


def _parse_text_lines_to_items(lines: list[str]) -> tuple[list[StatementLineItem], list[str]]:
    items: list[StatementLineItem] = []
    warnings: list[str] = []
    for line in lines:
        m = _LINE_PATTERN.search(line)
        if m:
            try:
                items.append(
                    StatementLineItem(
                        invoice_id=m.group("inv_id"),
                        invoice_date=m.group("date"),
                        amount=m.group("amount"),
                        balance_due=m.group("balance"),
                    )
                )
            except Exception as exc:
                warnings.append(f"OCR line parse error: {exc}")
    return items, warnings


# ── Public Entry Point ────────────────────────────────────────────────────────

CONFIDENCE_THRESHOLD = 0.60


def extract_statement(pdf_bytes: bytes) -> ExtractionResult:
    """
    Main entry point.  Applies the waterfall strategy:
      pdfplumber → OCR → LLM

    Raises RuntimeError only if all three strategies fail (should be rare).
    """
    # Strategy 1: pdfplumber (text-layer PDFs)
    result = _extract_with_pdfplumber(pdf_bytes)
    if result and result.confidence >= CONFIDENCE_THRESHOLD:
        logger.info("pdfplumber succeeded (confidence=%.2f, items=%d)",
                    result.confidence, len(result.line_items))
        return result

    pdfplumber_result = result  # keep for raw_text hand-off to LLM

    # Strategy 2: OCR
    logger.info("pdfplumber confidence low or no result — trying OCR")
    ocr_result = _extract_with_ocr(pdf_bytes)
    if ocr_result and ocr_result.confidence >= CONFIDENCE_THRESHOLD:
        logger.info("OCR succeeded (confidence=%.2f, items=%d)",
                    ocr_result.confidence, len(ocr_result.line_items))
        return ocr_result

    # Strategy 3: LLM fallback
    logger.info("OCR confidence low or no result — escalating to LLM")
    raw_text = (
        (ocr_result.raw_text if ocr_result else None)
        or (pdfplumber_result.raw_text if pdfplumber_result else "")
    )

    try:
        llm_result = _extract_with_llm(pdf_bytes, raw_text)
        logger.info("LLM succeeded (confidence=%.2f, items=%d)",
                    llm_result.confidence, len(llm_result.line_items))
        return llm_result
    except Exception as exc:
        logger.error("LLM extraction failed: %s", exc)
        # Return the best partial result we have rather than crashing
        if ocr_result and ocr_result.line_items:
            ocr_result.warnings.append(f"LLM fallback failed: {exc}")
            return ocr_result
        if pdfplumber_result and pdfplumber_result.line_items:
            pdfplumber_result.warnings.append(f"LLM fallback failed: {exc}")
            return pdfplumber_result
        raise RuntimeError(
            "All extraction strategies failed. "
            "The PDF may be encrypted, corrupted, or contain no recognisable table structure."
        ) from exc
