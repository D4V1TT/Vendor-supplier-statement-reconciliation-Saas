"""
Synthetic AP test-fixture generator.

Produces statement/ledger PAIRS that mimic the structural variety found in real
public AP ledgers (gov transparency dumps) and ERP exports (Sage / JD Edwards):

  - varying column names per vendor   (Doc_Ref_Num, Inv #, Reference, ...)
  - fixed-width vs delimited layouts
  - separate Debit/Credit columns vs a single signed Amount
  - letterhead/preamble + TOTAL rows
  - credit adjustments / negative offsets
  - thousands separators, currency symbols
  - randomized invoice IDs, realistic vendor item names

Each pair is emitted alongside a `_manifest.json` describing the EXACT expected
reconciliation outcome, so the same fixtures drive an automated correctness test
(see test_fixtures_recon.py).

Run:
    docker compose exec worker python -m tests.generate_fixtures --count 30
Output:
    backend/tests/fixtures/<id>/{statement.*, ledger.csv, _manifest.json}
"""

from __future__ import annotations

import argparse
import io
import json
import random
from dataclasses import dataclass, field
from pathlib import Path

import pandas as pd
from faker import Faker

fake = Faker()

FIXTURE_DIR = Path(__file__).parent / "fixtures"

# Column-name variants a vendor might use for each canonical field.
ID_NAMES     = ["Invoice_ID", "Invoice No", "Inv #", "Reference", "Doc_Ref_Num", "Document No", "Voucher No"]
AMOUNT_NAMES = ["Amount", "Invoice Amount", "Gross Amount", "Net Value", "Total"]
DATE_NAMES   = ["Date", "Invoice Date", "Doc Date", "Posting Date"]
BAL_NAMES    = ["Balance Due", "Outstanding", "Open Amount"]

CURRENCY_SYMBOLS = ["", "$", "£", "€"]


@dataclass
class Line:
    invoice_id: str
    date:       str
    desc:       str
    amount:     float            # signed: positive invoice, negative credit


@dataclass
class ExpectedOutcome:
    matched:        int = 0
    amount_mismatch: int = 0
    missing_in_ledger: int = 0
    unapplied_credit: int = 0
    total_lines:    int = 0


# ── Build a random scenario ───────────────────────────────────────────────────

def _make_scenario(seed: int) -> tuple[list[Line], list[Line], ExpectedOutcome]:
    """
    Returns (statement_lines, ledger_lines, expected_outcome).
    Deterministic per seed so failures are reproducible.
    """
    rng = random.Random(seed)
    Faker.seed(seed)

    n_matched  = rng.randint(3, 10)
    n_mismatch = rng.randint(0, 4)
    n_missing  = rng.randint(0, 4)   # on statement, absent from ledger
    n_credit   = rng.randint(0, 3)   # negative, absent from ledger

    statement: list[Line] = []
    ledger:    list[Line] = []
    counter = 1000 + seed * 100

    def next_id() -> str:
        nonlocal counter
        counter += 1
        prefix = rng.choice(["INV", "INV", "BILL", "FAC"])
        return f"{prefix}-{2026}-{counter}"

    def item() -> str:
        return rng.choice([
            fake.bs().title(), f"{fake.word().title()} Parts", "Consulting Services",
            "Freight Charges", "Maintenance Fee", f"{fake.word().title()} Supplies",
        ])

    def day() -> str:
        return fake.date_this_year().strftime("%d/%m/%Y")

    # Matched: identical on both sides
    for _ in range(n_matched):
        amt = round(rng.uniform(50, 15000), 2)
        i = next_id()
        statement.append(Line(i, day(), item(), amt))
        ledger.append(Line(i, "", "", amt))

    # Amount mismatch: same ID, different amount
    for _ in range(n_mismatch):
        i = next_id()
        s_amt = round(rng.uniform(100, 12000), 2)
        l_amt = round(s_amt + rng.choice([-1, 1]) * rng.uniform(10, 800), 2)
        statement.append(Line(i, day(), item(), s_amt))
        ledger.append(Line(i, "", "", l_amt))

    # Missing in ledger: on statement only (positive)
    for _ in range(n_missing):
        statement.append(Line(next_id(), day(), item(), round(rng.uniform(100, 9000), 2)))

    # Unapplied credit: negative on statement only
    for _ in range(n_credit):
        cid = f"CR-2026-{counter}"; counter += 1
        statement.append(Line(cid, day(), "Credit Note", -round(rng.uniform(50, 2000), 2)))

    # Add some ledger-only rows (extra invoices) — these don't appear as
    # exceptions because reconciliation is statement-driven, but they make the
    # ledger realistic.
    for _ in range(rng.randint(0, 5)):
        ledger.append(Line(next_id(), "", "", round(rng.uniform(100, 5000), 2)))

    rng.shuffle(statement)
    rng.shuffle(ledger)

    expected = ExpectedOutcome(
        matched=n_matched,
        amount_mismatch=n_mismatch,
        missing_in_ledger=n_missing,
        unapplied_credit=n_credit,
        total_lines=n_matched + n_mismatch + n_missing + n_credit,
    )
    return statement, ledger, expected


# ── Renderers (each emits a different file format/layout) ──────────────────────

def _fmt_amount(v: float, sym: str, commas: bool) -> str:
    s = f"{abs(v):,.2f}" if commas else f"{abs(v):.2f}"
    s = f"{sym}{s}"
    return f"({s})" if v < 0 else s


def render_csv(lines: list[Line], rng: random.Random) -> bytes:
    id_col, amt_col, date_col = rng.choice(ID_NAMES), rng.choice(AMOUNT_NAMES), rng.choice(DATE_NAMES)
    rows = [{id_col: l.invoice_id, date_col: l.date, "Description": l.desc, amt_col: round(l.amount, 2)} for l in lines]
    return pd.DataFrame(rows).to_csv(index=False).encode()


def render_excel(lines: list[Line], rng: random.Random) -> bytes:
    id_col, amt_col = rng.choice(ID_NAMES), rng.choice(AMOUNT_NAMES)
    rows = [{id_col: l.invoice_id, "Date": l.date, "Item": l.desc, amt_col: round(l.amount, 2)} for l in lines]
    buf = io.BytesIO()
    pd.DataFrame(rows).to_excel(buf, index=False, engine="openpyxl")
    return buf.getvalue()


def render_debit_credit_txt(lines: list[Line], rng: random.Random) -> bytes:
    """
    Fixed-width statement with letterhead, Debit/Credit columns, TOTAL row.
    Column widths are computed from the data with a guaranteed >=2-space gap
    between every column (as real ERP fixed-width exports do), so the
    whitespace-aligned parser can cleanly separate fields.
    """
    sym    = rng.choice(CURRENCY_SYMBOLS)
    commas = rng.choice([True, False])
    GAP = "   "   # 3-space column separator — always >= 2

    debits  = [_fmt_amount(l.amount if l.amount >= 0 else 0, sym, commas) for l in lines]
    credits = [_fmt_amount(l.amount if l.amount < 0  else 0, sym, commas) for l in lines]
    descs   = [l.desc[:30] for l in lines]

    # width = longest cell (incl. header) per column
    w_date = max(10, *(len(l.date) for l in lines))
    w_id   = max(len("Doc_Ref_Num"), *(len(l.invoice_id) for l in lines))
    w_desc = max(len("Description"), *(len(d) for d in descs))
    w_deb  = max(len("Debit"),  *(len(x) for x in debits))
    w_cred = max(len("Credit"), *(len(x) for x in credits))

    def row(date, inv, desc, deb, cred):
        return GAP.join([
            f"{date:<{w_date}}", f"{inv:<{w_id}}", f"{desc:<{w_desc}}",
            f"{deb:>{w_deb}}", f"{cred:>{w_cred}}",
        ])

    total_w = w_date + w_id + w_desc + w_deb + w_cred + len(GAP) * 4
    out = [
        fake.company().upper(),
        fake.address().replace("\n", ", "),
        "STATEMENT OF ACCOUNT",
        "=" * total_w,
        row("Date", "Doc_Ref_Num", "Description", "Debit", "Credit"),
        "-" * total_w,
    ]
    total = 0.0
    for i, l in enumerate(lines):
        out.append(row(l.date, l.invoice_id, descs[i], debits[i], credits[i]))
        total += l.amount
    out.append("-" * total_w)
    out.append(f"TOTAL OUTSTANDING AMOUNT DUE:{GAP}{_fmt_amount(total, sym, commas)}")
    return ("\n".join(out)).encode()


def render_pdf(lines: list[Line], rng: random.Random) -> bytes:
    """Text-layer PDF statement (table) via reportlab."""
    from reportlab.lib import colors  # noqa: PLC0415
    from reportlab.lib.pagesizes import A4  # noqa: PLC0415
    from reportlab.lib.units import mm  # noqa: PLC0415
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer  # noqa: PLC0415
    from reportlab.lib.styles import getSampleStyleSheet  # noqa: PLC0415

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm)
    styles = getSampleStyleSheet()
    id_col, amt_col = rng.choice(ID_NAMES), rng.choice(AMOUNT_NAMES)

    elems = [
        Paragraph(fake.company(), styles["Title"]),
        Paragraph("Statement of Account", styles["Heading3"]),
        Spacer(1, 8 * mm),
    ]
    data = [[id_col, "Date", "Description", amt_col]]
    for l in lines:
        data.append([l.invoice_id, l.date, l.desc[:30], f"{l.amount:,.2f}"])

    table = Table(data, colWidths=[35 * mm, 25 * mm, 70 * mm, 30 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTSIZE",   (0, 0), (-1, -1), 8),
        ("GRID",       (0, 0), (-1, -1), 0.3, colors.grey),
        ("ALIGN",      (-1, 0), (-1, -1), "RIGHT"),
    ]))
    elems.append(table)
    doc.build(elems)
    return buf.getvalue()


RENDERERS = {
    "csv":   ("statement.csv",  render_csv),
    "xlsx":  ("statement.xlsx", render_excel),
    "txt":   ("statement.txt",  render_debit_credit_txt),
    "pdf":   ("statement.pdf",  render_pdf),
}


# ── Main ──────────────────────────────────────────────────────────────────────

def generate(count: int) -> None:
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    formats = list(RENDERERS.keys())

    for n in range(count):
        seed = 1000 + n
        rng = random.Random(seed)
        stmt_lines, ledger_lines, expected = _make_scenario(seed)

        fmt = formats[n % len(formats)]
        stmt_name, renderer = RENDERERS[fmt]
        stmt_bytes = renderer(stmt_lines, rng)

        # Ledger is always a simple CSV (internal AP export)
        ledger_bytes = render_csv(ledger_lines, rng)

        out = FIXTURE_DIR / f"{n:03d}_{fmt}"
        out.mkdir(parents=True, exist_ok=True)
        (out / stmt_name).write_bytes(stmt_bytes)
        (out / "ledger.csv").write_bytes(ledger_bytes)
        (out / "_manifest.json").write_text(json.dumps({
            "statement_file": stmt_name,
            "ledger_file":    "ledger.csv",
            "format":         fmt,
            "expected": {
                "matched":           expected.matched,
                "amount_mismatch":   expected.amount_mismatch,
                "missing_in_ledger": expected.missing_in_ledger,
                "unapplied_credit":  expected.unapplied_credit,
                "total_lines":       expected.total_lines,
            },
        }, indent=2))

    print(f"Generated {count} fixture pairs in {FIXTURE_DIR}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--count", type=int, default=20)
    generate(ap.parse_args().count)
