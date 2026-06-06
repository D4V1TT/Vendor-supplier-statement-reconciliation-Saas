-- Migration 0006: billing plan (gates premium features like AI/LLM fallback)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS plan VARCHAR(20) NOT NULL DEFAULT 'free';
