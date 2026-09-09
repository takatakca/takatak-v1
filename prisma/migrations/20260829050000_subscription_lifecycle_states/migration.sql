-- Social subscription lifecycle states. `free` already exists.
-- Paid access during past_due / grace_period is a policy decision, not a schema one.
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'incomplete';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'grace_period';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'suspended';
