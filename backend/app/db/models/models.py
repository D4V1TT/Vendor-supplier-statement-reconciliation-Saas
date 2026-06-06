"""
Full ORM schema for VendorRecon.

Security note: every data table carries a `company_id` foreign key.
The application layer enforces company_id == current_user.company_id on
every query — Row-Level Security is also enabled at the PostgreSQL level
(see migration 0002_enable_rls.sql) as a second line of defence.
"""

import uuid
from decimal import Decimal
from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Enum,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


# ── Enumerations ──────────────────────────────────────────────────────────────

class JobStatus(PyEnum):
    PENDING   = "pending"
    RUNNING   = "running"
    COMPLETED = "completed"
    FAILED    = "failed"


class ReconciliationCategory(PyEnum):
    MATCHED                  = "Matched"
    FLAGGED_AMOUNT_MISMATCH  = "Flagged_Amount_Mismatch"
    FLAGGED_MISSING_IN_LEDGER = "Flagged_Missing_In_Ledger"
    FLAGGED_UNAPPLIED_CREDIT  = "Flagged_Unapplied_Credit"


# ── Companies ─────────────────────────────────────────────────────────────────

class Company(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Top-level tenant. Every other record is scoped to a company.
    Billing, plan limits, etc. live here.
    """
    __tablename__ = "companies"

    name: Mapped[str]  = mapped_column(String(255), nullable=False)
    slug: Mapped[str]  = mapped_column(String(100), unique=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Billing plan — gates premium features like the AI extraction fallback.
    # "free" | "pro" | "enterprise"
    plan: Mapped[str] = mapped_column(String(20), default="free")

    # ── Reconciliation defaults (applied to every run) ────────────────────────
    default_currency:      Mapped[str]  = mapped_column(String(8), default="USD")
    amount_tolerance:      Mapped[float] = mapped_column(Numeric(10, 4), default=0.01)
    pdf_extraction_method: Mapped[str]  = mapped_column(String(20), default="auto")  # auto|pdfplumber|ocr|llm
    flag_unapplied_credits: Mapped[bool] = mapped_column(Boolean, default=True)
    auto_export:           Mapped[bool] = mapped_column(Boolean, default=False)

    users: Mapped[list["User"]] = relationship("User", back_populates="company")
    statements: Mapped[list["UploadedStatement"]] = relationship(
        "UploadedStatement", back_populates="company"
    )
    ledger_exports: Mapped[list["LedgerExport"]] = relationship(
        "LedgerExport", back_populates="company"
    )
    jobs: Mapped[list["ReconciliationJob"]] = relationship(
        "ReconciliationJob", back_populates="company"
    )


# ── Users ─────────────────────────────────────────────────────────────────────

class User(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Application user. Belongs to exactly one company (tenant).
    role: 'admin' can invite users; 'member' can upload and view.
    """
    __tablename__ = "users"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    clerk_id: Mapped[str | None]  = mapped_column(String(255), nullable=True, unique=True)
    email: Mapped[str]            = mapped_column(String(320), nullable=False)
    hashed_password: Mapped[str]  = mapped_column(String(255), nullable=False, default="")
    full_name: Mapped[str]        = mapped_column(String(255), nullable=False)
    role: Mapped[str]             = mapped_column(String(50), default="admin")
    is_active: Mapped[bool]       = mapped_column(Boolean, default=True)

    # Notification preferences (defaults: completion + exceptions on, digest off)
    notify_on_completion: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_on_exceptions: Mapped[bool] = mapped_column(Boolean, default=True)
    notify_weekly_digest: Mapped[bool] = mapped_column(Boolean, default=False)

    company: Mapped["Company"] = relationship("Company", back_populates="users")

    __table_args__ = (
        UniqueConstraint("email", name="uq_users_email"),
        Index("ix_users_company_id", "company_id"),
    )


# ── Uploaded Vendor PDF Statements ────────────────────────────────────────────

class UploadedStatement(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Metadata record for a vendor's PDF statement uploaded by the user.
    The actual file bytes are stored encrypted in the file store (S3 or local FS).
    `storage_key` is the path/key used to retrieve and decrypt it.
    """
    __tablename__ = "uploaded_statements"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    vendor_name: Mapped[str]    = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_key: Mapped[str]    = mapped_column(String(1000), nullable=False)
    file_size_bytes: Mapped[int]
    page_count: Mapped[int | None]
    # Raw extracted rows stored as JSON — populated after PDF extraction job
    extracted_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    extraction_confidence: Mapped[float | None]  # 0.0–1.0 heuristic score
    extraction_method: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "pdfplumber" | "ocr" | "llm"

    company: Mapped["Company"] = relationship("Company", back_populates="statements")

    __table_args__ = (Index("ix_statements_company_id", "company_id"),)


# ── Internal Ledger Exports ───────────────────────────────────────────────────

class LedgerExport(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Metadata for the internal AP ledger CSV/Excel file exported from the
    company's accounting system (SAP, NetSuite, QuickBooks, etc.).
    """
    __tablename__ = "ledger_exports"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_key: Mapped[str]       = mapped_column(String(1000), nullable=False)
    file_size_bytes: Mapped[int]
    row_count: Mapped[int | None]
    # Column mapping chosen by user during upload wizard (e.g. {"Invoice_ID": "Inv #"})
    column_mapping: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    parsed_data: Mapped[dict | None]    = mapped_column(JSONB, nullable=True)

    company: Mapped["Company"] = relationship("Company", back_populates="ledger_exports")

    __table_args__ = (Index("ix_ledger_exports_company_id", "company_id"),)


# ── Reconciliation Jobs ───────────────────────────────────────────────────────

class ReconciliationJob(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Represents a single reconciliation run linking one statement to one ledger.
    Results are stored as a JSONB column (line_items) for fast API serialisation.

    Summary counters are denormalised into integer columns so the dashboard
    can render KPI cards without scanning the full JSONB array.
    """
    __tablename__ = "reconciliation_jobs"

    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    statement_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("uploaded_statements.id"), nullable=False
    )
    ledger_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ledger_exports.id"), nullable=False
    )

    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus, name="job_status", values_callable=lambda x: [e.value for e in x]),
        default=JobStatus.PENDING, nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── Summary KPIs (denormalised for fast dashboard queries) ────────────────
    total_supplier_lines: Mapped[int | None]
    count_matched: Mapped[int | None]
    count_amount_mismatch: Mapped[int | None]
    count_missing_in_ledger: Mapped[int | None]
    count_unapplied_credit: Mapped[int | None]

    # Total variance across all mismatched lines (supplier_amount - ledger_amount)
    total_variance: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)

    # Full line-by-line results array — see ReconciliationLineItem schema
    line_items: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    company:   Mapped["Company"]           = relationship("Company", back_populates="jobs")
    statement: Mapped["UploadedStatement"] = relationship("UploadedStatement")
    ledger:    Mapped["LedgerExport"]      = relationship("LedgerExport")

    __table_args__ = (
        Index("ix_recon_jobs_company_id", "company_id"),
        Index("ix_recon_jobs_status", "status"),
    )
