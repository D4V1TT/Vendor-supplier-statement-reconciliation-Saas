-- Migration 0004: per-user notification preferences
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notify_on_completion BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_on_exceptions BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_weekly_digest BOOLEAN NOT NULL DEFAULT FALSE;
