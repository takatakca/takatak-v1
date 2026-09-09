-- Permanent Free Social plan (not a trial). Used when a Client is created
-- without Stripe. Paid statuses are unchanged.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'free';
