-- Step 6 — Facebook Page initial sync state + idempotent daily metrics

CREATE TYPE "SocialSyncStatus" AS ENUM (
  'idle',
  'syncing',
  'ready',
  'empty',
  'degraded',
  'action_required',
  'failed'
);

CREATE TABLE "social_account_sync_states" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID NOT NULL,
  "socialAccountId" UUID NOT NULL,
  "providerConnectionId" UUID NOT NULL,
  "status" "SocialSyncStatus" NOT NULL DEFAULT 'idle',
  "lastAttemptAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastErrorCategory" TEXT,
  "lastErrorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "syncCursor" TEXT,
  "rangeStart" DATE,
  "rangeEnd" DATE,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "partialData" BOOLEAN NOT NULL DEFAULT false,
  "providerSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "social_account_sync_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "social_account_sync_states_socialAccountId_key"
  ON "social_account_sync_states"("socialAccountId");

CREATE INDEX "social_account_sync_states_clientId_status_idx"
  ON "social_account_sync_states"("clientId", "status");

CREATE INDEX "social_account_sync_states_businessBrandId_status_idx"
  ON "social_account_sync_states"("businessBrandId", "status");

CREATE INDEX "social_account_sync_states_providerConnectionId_status_idx"
  ON "social_account_sync_states"("providerConnectionId", "status");

CREATE INDEX "social_account_sync_states_lastAttemptAt_idx"
  ON "social_account_sync_states"("lastAttemptAt");

ALTER TABLE "social_account_sync_states"
  ADD CONSTRAINT "social_account_sync_states_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_account_sync_states"
  ADD CONSTRAINT "social_account_sync_states_businessBrandId_fkey"
  FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_account_sync_states"
  ADD CONSTRAINT "social_account_sync_states_socialAccountId_fkey"
  FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_account_sync_states"
  ADD CONSTRAINT "social_account_sync_states_providerConnectionId_fkey"
  FOREIGN KEY ("providerConnectionId") REFERENCES "social_provider_connections"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "sad_account_date_source_key"
  ON "social_analytics_daily"("socialAccountId", "date", "source");
