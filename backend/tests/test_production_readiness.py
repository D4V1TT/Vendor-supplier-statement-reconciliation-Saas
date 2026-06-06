"""
Production-readiness suite — the three "bulletproof baseline" tests:
  1. Messy Column  — renamed ID columns still map
  2. Data Type     — $1,500.00 (symbol + comma) matches 1500
  3. Graceful Fail — corrupt / blank / oversized files raise CLEAN errors,
                     never an uncaught crash
"""

import io

import pandas as pd
import pytest

from app.engine.column_detector import detect_columns
from app.engine.reconciler import parse_ledger_file, reconcile


# ── 1. Messy Column Test ──────────────────────────────────────────────────────

@pytest.mark.parametrize("col_name", [
    "Vchr_Num", "Doc Ref", "VCHR_NUM", "Document Reference",
    "Trans Ref", "Inv #", "Reference No.", "Bill Number",
])
def test_messy_column_maps_to_invoice_id(col_name):
    df = pd.DataFrame({col_name: ["INV-001", "INV-002", "INV-003"],
                       "Amount": [100, 200, 300]})
    detected = detect_columns(df)
    assert not detected.missing_required, f"{col_name!r} left required cols unmapped"
    assert detected.mapping.get(col_name) == "invoice_id"


# ── 2. Data Type Test ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("supplier_amt,ledger_amt", [
    ("$1,500.00", 1500),
    ("£1,500.00", 1500.00),
    ("€2,300.50", 2300.50),
    ("1,500", "1500.00"),
    ("(450.00)", -450),         # parenthesis negative vs plain negative
    (" 1500.00 ", 1500),        # whitespace
])
def test_currency_formatting_matches_numerically(supplier_amt, ledger_amt):
    supplier = pd.DataFrame({"invoice_id": ["INV-1"], "amount": [supplier_amt]})
    ledger   = pd.DataFrame({"invoice_id": ["INV-1"], "amount": [ledger_amt]})
    report = reconcile(supplier, ledger)
    assert report.summary.count_matched == 1, (
        f"{supplier_amt!r} did not match {ledger_amt!r}"
    )


# ── 3. Graceful Failure Test ──────────────────────────────────────────────────

def _expect_clean_value_error(data: bytes, filename: str):
    """A bad file must raise ValueError (caught → clean 422), never a raw crash."""
    with pytest.raises(ValueError):
        df = parse_ledger_file(data, filename)
        # If it somehow parsed, reconciling must still raise cleanly
        reconcile(df, pd.DataFrame({"invoice_id": ["X"], "amount": [1]}))


def test_corrupt_random_bytes():
    _expect_clean_value_error(b"\x00\x01\x02\xff\xfe not a real file", "corrupt.csv")

def test_blank_csv():
    _expect_clean_value_error(b"", "blank.csv")

def test_headers_only_no_data():
    _expect_clean_value_error(b"col1,col2,col3\n", "headers.csv")

def test_corrupt_xlsx():
    # A file claiming to be xlsx but isn't a valid zip
    _expect_clean_value_error(b"PK\x03\x04 not really an xlsx", "bad.xlsx")

def test_blank_xlsx():
    buf = io.BytesIO()
    pd.DataFrame().to_excel(buf, index=False, engine="openpyxl")
    _expect_clean_value_error(buf.getvalue(), "empty.xlsx")

def test_unsupported_extension():
    _expect_clean_value_error(b"some text", "notes.docx")
