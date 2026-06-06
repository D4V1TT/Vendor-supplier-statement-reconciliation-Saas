-- Migration 0005: company-wide reconciliation defaults
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS default_currency       VARCHAR(8)    NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS amount_tolerance       NUMERIC(10,4) NOT NULL DEFAULT 0.01,
  ADD COLUMN IF NOT EXISTS pdf_extraction_method  VARCHAR(20)   NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS flag_unapplied_credits BOOLEAN       NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS auto_export            BOOLEAN       NOT NULL DEFAULT FALSE;
