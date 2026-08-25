-- Job ownership / generation for Facebook Page initial sync.
-- Prevents a stale sync from overwriting a newer claim after Page change or retry.

ALTER TABLE "social_account_sync_states"
  ADD COLUMN "syncGeneration" INTEGER NOT NULL DEFAULT 0;
