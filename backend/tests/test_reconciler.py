"""
Unit tests for the reconciliation engine.
Run with: pytest -v
"""

import pytest
import pandas as pd

from app.engine.reconciler import (
    FLAGGED_AMOUNT_MISMATCH,
    FLAGGED_MISSING_IN_LEDGER,
    FLAGGED_UNAPPLIED_CREDIT,
    MATCHED,
    reconcile,
)


def make_supplier(*rows) -> pd.DataFrame:
    """rows: (invoice_id, amount[, invoice_date])"""
    data = []
    for row in rows:
        inv_id, amount = row[0], row[1]
        date = row[2] if len(row) > 2 else None
        data.append({"invoice_id": inv_id, "amount": amount, "invoice_date": date})
    return pd.DataFrame(data)


def make_ledger(*rows) -> pd.DataFrame:
    """rows: (invoice_id, amount)"""
    return pd.DataFrame([{"invoice_id": r[0], "amount": r[1]} for r in rows])


# ── Rule 1: Exact Match ───────────────────────────────────────────────────────

def test_exact_match():
    supplier = make_supplier(("INV-001", 1000.00), ("INV-002", 250.50))
    ledger   = make_ledger  (("INV-001", 1000.00), ("INV-002", 250.50))
    report   = reconcile(supplier, ledger)

    assert report.summary.count_matched == 2
    assert report.summary.exception_count == 0
    for li in report.line_items:
        assert li.category == MATCHED
        assert li.variance == 0.0


def test_exact_match_within_tolerance():
    """Amounts differing by <= $0.01 should still be treated as matched."""
    supplier = make_supplier(("INV-001", 1000.00))
    ledger   = make_ledger  (("INV-001", 1000.009))  # sub-cent difference
    report   = reconcile(supplier, ledger)
    assert report.summary.count_matched == 1


# ── Rule 2: Amount Mismatch ───────────────────────────────────────────────────

def test_amount_mismatch():
    supplier = make_supplier(("INV-003", 500.00))
    ledger   = make_ledger  (("INV-003", 450.00))
    report   = reconcile(supplier, ledger)

    assert report.summary.count_amount_mismatch == 1
    li = report.line_items[0]
    assert li.category == FLAGGED_AMOUNT_MISMATCH
    assert li.variance == pytest.approx(50.00)
    assert li.ledger_amount == 450.00


# ── Rule 3: Missing Invoice ───────────────────────────────────────────────────

def test_missing_in_ledger():
    supplier = make_supplier(("INV-004", 750.00))
    ledger   = make_ledger  (("INV-999", 100.00))   # completely different invoice
    report   = reconcile(supplier, ledger)

    assert report.summary.count_missing_in_ledger == 1
    li = report.line_items[0]
    assert li.category == FLAGGED_MISSING_IN_LEDGER
    assert li.ledger_amount is None


# ── Rule 4: Unapplied Credit ──────────────────────────────────────────────────

def test_unapplied_credit():
    supplier = make_supplier(("CN-001", -200.00))   # negative = credit note
    ledger   = make_ledger  (("INV-100", 500.00))   # credit not in ledger at all
    report   = reconcile(supplier, ledger)

    assert report.summary.count_unapplied_credit == 1
    li = report.line_items[0]
    assert li.category == FLAGGED_UNAPPLIED_CREDIT
    assert li.supplier_amount < 0


def test_credit_in_ledger_exact_match():
    """If the credit IS in the ledger with the same amount, it should be Matched."""
    supplier = make_supplier(("CN-002", -150.00))
    ledger   = make_ledger  (("CN-002", -150.00))
    report   = reconcile(supplier, ledger)
    assert report.summary.count_matched == 1


# ── Mixed scenario ────────────────────────────────────────────────────────────

def test_mixed_scenario():
    supplier = make_supplier(
        ("INV-001", 1000.00),   # matched
        ("INV-002", 500.00),    # mismatch
        ("INV-003", 750.00),    # missing in ledger
        ("CN-001",  -100.00),   # unapplied credit
    )
    ledger = make_ledger(
        ("INV-001", 1000.00),
        ("INV-002", 480.00),    # $20 mismatch
    )
    report = reconcile(supplier, ledger)

    s = report.summary
    assert s.count_matched           == 1
    assert s.count_amount_mismatch   == 1
    assert s.count_missing_in_ledger == 1
    assert s.count_unapplied_credit  == 1
    # total_variance = sum of ALL discrepancies:
    #   mismatch INV-002: 500 - 480       = +20
    #   missing  INV-003: 750 - 0         = +750
    #   credit   CN-001 : -100 - 0        = -100
    assert s.total_variance          == pytest.approx(670.00)
    assert s.exception_count         == 3
    assert s.match_rate_pct          == 25.0


# ── Case insensitivity & whitespace ──────────────────────────────────────────

def test_invoice_id_normalisation():
    """'inv-001 ' and 'INV-001' should match."""
    supplier = make_supplier(("inv-001 ", 500.00))
    ledger   = make_ledger  (("INV-001",  500.00))
    report   = reconcile(supplier, ledger)
    assert report.summary.count_matched == 1


# ── Edge cases ────────────────────────────────────────────────────────────────

def test_empty_supplier():
    supplier = pd.DataFrame(columns=["invoice_id", "amount"])
    ledger   = make_ledger(("INV-001", 100.00))
    report   = reconcile(supplier, ledger)
    assert report.summary.total_supplier_lines == 0


def test_empty_ledger():
    supplier = make_supplier(("INV-001", 100.00))
    ledger   = pd.DataFrame(columns=["invoice_id", "amount"])
    report   = reconcile(supplier, ledger)
    assert report.summary.count_missing_in_ledger == 1


def test_smart_detector_maps_synonyms():
    """The detector should map 'invoice_number' → invoice_id and 'value' → amount."""
    supplier = pd.DataFrame({"invoice_number": ["INV-001"], "value": [100]})
    ledger   = make_ledger(("INV-001", 100))
    report   = reconcile(supplier, ledger)
    assert report.summary.count_matched == 1


def test_unmappable_columns_raise():
    """Columns with no recognisable name OR data shape can't be reconciled."""
    bad_df = pd.DataFrame({
        "notes":   ["a long free text comment here", "another lengthy remark line"],
        "comment": ["more descriptive prose text", "yet another sentence of words"],
    })
    ledger = make_ledger(("INV-001", 100))
    with pytest.raises(ValueError, match="could not identify required columns"):
        reconcile(bad_df, ledger)
