-- Durable sync job leases for Facebook Page analytics workers.

ALTER TABLE "jobs"
  ADD COLUMN IF NOT EXISTS "leaseOwner" UUID,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "jobs_sync_lease_due_idx"
  ON "jobs" ("type", "status", "scheduledFor", "leaseExpiresAt");

CREATE INDEX IF NOT EXISTS "jobs_lease_owner_idx"
  ON "jobs" ("leaseOwner");
