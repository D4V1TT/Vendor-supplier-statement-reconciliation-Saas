-- Migration 0003: Add Clerk user ID to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(255) UNIQUE,
  ALTER COLUMN hashed_password SET DEFAULT '';
