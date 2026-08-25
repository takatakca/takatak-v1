-- Step 7: incremental watermark, backfill progress, schedule cadence.
ALTER TABLE "social_account_sync_states"
  ADD COLUMN IF NOT EXISTS "lastConfirmedDate" DATE,
  ADD COLUMN IF NOT EXISTS "overlapDays" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "backfillStatus" TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS "backfillCursorDate" DATE,
  ADD COLUMN IF NOT EXISTS "backfillHorizonStart" DATE,
  ADD COLUMN IF NOT EXISTS "nextIncrementalAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastSyncMode" TEXT,
  ADD COLUMN IF NOT EXISTS "dataCompleteness" TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "graphApiVersion" TEXT;

CREATE INDEX IF NOT EXISTS "social_account_sync_states_nextIncrementalAt_idx"
  ON "social_account_sync_states"("nextIncrementalAt");

CREATE INDEX IF NOT EXISTS "social_account_sync_states_backfillStatus_idx"
  ON "social_account_sync_states"("backfillStatus");

CREATE INDEX IF NOT EXISTS "social_account_sync_states_clientId_status_nextIncrementalAt_idx"
  ON "social_account_sync_states"("clientId", "status", "nextIncrementalAt");
