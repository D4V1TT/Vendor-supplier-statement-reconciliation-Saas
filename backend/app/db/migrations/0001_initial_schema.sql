-- ============================================================================
-- Migration 0001: Initial schema
-- Run via: alembic upgrade head  (or psql -f this file for manual setup)
-- ============================================================================

-- Required extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Companies ────────────────────────────────────────────────────────────────
CREATE TABLE companies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    slug        VARCHAR(100) NOT NULL UNIQUE,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Users ─────────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    email            VARCHAR(320) NOT NULL UNIQUE,
    hashed_password  VARCHAR(255) NOT NULL,
    full_name        VARCHAR(255) NOT NULL,
    role             VARCHAR(50) NOT NULL DEFAULT 'member',
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_users_company_id ON users(company_id);

-- ── Uploaded Statements ───────────────────────────────────────────────────────
CREATE TABLE uploaded_statements (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by             UUID NOT NULL REFERENCES users(id),
    vendor_name             VARCHAR(255) NOT NULL,
    original_filename       VARCHAR(500) NOT NULL,
    storage_key             VARCHAR(1000) NOT NULL,
    file_size_bytes         BIGINT NOT NULL,
    page_count              INT,
    extracted_data          JSONB,
    extraction_confidence   FLOAT,
    extraction_method       VARCHAR(50),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_statements_company_id ON uploaded_statements(company_id);

-- ── Ledger Exports ────────────────────────────────────────────────────────────
CREATE TABLE ledger_exports (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    uploaded_by       UUID NOT NULL REFERENCES users(id),
    original_filename VARCHAR(500) NOT NULL,
    storage_key       VARCHAR(1000) NOT NULL,
    file_size_bytes   BIGINT NOT NULL,
    row_count         INT,
    column_mapping    JSONB,
    parsed_data       JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_ledger_exports_company_id ON ledger_exports(company_id);

-- ── Reconciliation Jobs ───────────────────────────────────────────────────────
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE reconciliation_jobs (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id               UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by               UUID NOT NULL REFERENCES users(id),
    statement_id             UUID NOT NULL REFERENCES uploaded_statements(id),
    ledger_id                UUID NOT NULL REFERENCES ledger_exports(id),
    status                   job_status NOT NULL DEFAULT 'pending',
    error_message            TEXT,
    total_supplier_lines     INT,
    count_matched            INT,
    count_amount_mismatch    INT,
    count_missing_in_ledger  INT,
    count_unapplied_credit   INT,
    total_variance           NUMERIC(18, 2),
    line_items               JSONB,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_recon_jobs_company_id ON reconciliation_jobs(company_id);
CREATE INDEX ix_recon_jobs_status     ON reconciliation_jobs(status);
