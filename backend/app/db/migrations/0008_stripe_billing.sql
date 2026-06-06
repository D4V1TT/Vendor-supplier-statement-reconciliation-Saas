-- Migration 0008: link Stripe customer/subscription to the company
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS stripe_customer_id     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
