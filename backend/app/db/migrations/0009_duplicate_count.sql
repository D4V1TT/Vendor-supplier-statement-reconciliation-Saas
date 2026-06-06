-- Migration 0009: denormalised count for the duplicate-invoice exception category
ALTER TABLE reconciliation_jobs
  ADD COLUMN IF NOT EXISTS count_duplicate INT;
