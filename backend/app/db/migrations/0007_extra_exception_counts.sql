-- Migration 0007: denormalised counts for the two new exception categories
ALTER TABLE reconciliation_jobs
  ADD COLUMN IF NOT EXISTS count_likely_match         INT,
  ADD COLUMN IF NOT EXISTS count_missing_in_statement INT;
