-- Migration 0010: record proof of Terms of Service / Privacy Policy acceptance.
-- Written server-side when a user clicks "I agree" so we have a durable,
-- tamper-resistant record (who, when, which version, from which IP).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version     VARCHAR(40),
  ADD COLUMN IF NOT EXISTS terms_accepted_ip VARCHAR(64);
