"""
Runs the reconciliation engine against every generated fixture pair and asserts
the result matches the fixture's manifest. This validates the full extract →
detect-columns → reconcile pipeline across CSV / Excel / fixed-width / PDF and
every column-name variation in one sweep.

Generate fixtures first:
    docker compose exec worker python -m tests.generate_fixtures --count 30
Then:
    docker compose exec worker python -m pytest tests/test_fixtures_recon.py -v
"""

import json
from pathlib import Path

import pytest

from app.engine.pdf_extractor import extract_statement
from app.engine.reconciler import parse_ledger_file, reconcile

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def _load_df(path: Path):
    raw = path.read_bytes()
    if path.suffix.lower() == ".pdf":
        return extract_statement(raw, method="pdfplumber").to_dataframe()
    return parse_ledger_file(raw, path.name)


def _fixture_dirs():
    if not FIXTURE_DIR.exists():
        return []
    return sorted(d for d in FIXTURE_DIR.iterdir() if (d / "_manifest.json").exists())


@pytest.mark.parametrize("fixture", _fixture_dirs(), ids=lambda d: d.name)
def test_fixture_reconciles_as_expected(fixture: Path):
    manifest = json.loads((fixture / "_manifest.json").read_text())
    exp = manifest["expected"]

    supplier_df = _load_df(fixture / manifest["statement_file"])
    ledger_df   = _load_df(fixture / manifest["ledger_file"])

    report = reconcile(supplier_df, ledger_df)
    s = report.summary

    # Total lines parsed from the statement must match what we generated
    assert s.total_supplier_lines == exp["total_lines"], (
        f"{fixture.name}: parsed {s.total_supplier_lines} lines, expected {exp['total_lines']}"
    )
    assert s.count_matched           == exp["matched"],           f"{fixture.name}: matched"
    assert s.count_amount_mismatch   == exp["amount_mismatch"],   f"{fixture.name}: mismatch"
    assert s.count_missing_in_ledger == exp["missing_in_ledger"], f"{fixture.name}: missing"
    assert s.count_unapplied_credit  == exp["unapplied_credit"],  f"{fixture.name}: credits"


def test_at_least_some_fixtures_exist():
    assert _fixture_dirs(), "No fixtures generated. Run: python -m tests.generate_fixtures"
