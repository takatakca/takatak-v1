-- Step 9: Facebook competitor tracks + dated public snapshots
CREATE TABLE IF NOT EXISTS "social_competitor_tracks" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID NOT NULL,
  "publicRef" TEXT NOT NULL,
  "externalPageIdHash" TEXT NOT NULL,
  "externalPageId" TEXT NOT NULL,
  "usernameCanonical" TEXT,
  "displayLabel" TEXT,
  "pageName" TEXT,
  "profileImageUrl" TEXT,
  "category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "availability" TEXT NOT NULL DEFAULT 'pending',
  "capabilityStatus" TEXT NOT NULL DEFAULT 'unknown',
  "lastAttemptAt" TIMESTAMP(3),
  "lastSuccessAt" TIMESTAMP(3),
  "lastErrorCategory" TEXT,
  "lastErrorMessage" TEXT,
  "nextRefreshAt" TIMESTAMP(3),
  "dispatchJobId" UUID,
  "syncGeneration" INTEGER NOT NULL DEFAULT 0,
  "graphApiVersion" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "social_competitor_tracks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sct_brand_public_ref_key"
  ON "social_competitor_tracks"("clientId", "businessBrandId", "publicRef");

CREATE UNIQUE INDEX IF NOT EXISTS "sct_brand_page_hash_key"
  ON "social_competitor_tracks"("clientId", "businessBrandId", "externalPageIdHash");

CREATE INDEX IF NOT EXISTS "social_competitor_tracks_clientId_businessBrandId_status_idx"
  ON "social_competitor_tracks"("clientId", "businessBrandId", "status");

CREATE INDEX IF NOT EXISTS "social_competitor_tracks_nextRefreshAt_idx"
  ON "social_competitor_tracks"("nextRefreshAt");

CREATE INDEX IF NOT EXISTS "social_competitor_tracks_dispatchJobId_idx"
  ON "social_competitor_tracks"("dispatchJobId");

CREATE TABLE IF NOT EXISTS "social_competitor_snapshots" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID NOT NULL,
  "competitorTrackId" UUID NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL,
  "snapshotDate" DATE NOT NULL,
  "followerCount" INTEGER,
  "followerFieldSource" TEXT,
  "pageName" TEXT,
  "category" TEXT,
  "profileImageUrl" TEXT,
  "publicPostCount" INTEGER,
  "publicReactionsSum" INTEGER,
  "publicCommentsSum" INTEGER,
  "publicSharesSum" INTEGER,
  "availability" TEXT NOT NULL DEFAULT 'unavailable',
  "metricStatus" JSONB,
  "graphApiVersion" TEXT,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "social_competitor_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "scs_track_date_key"
  ON "social_competitor_snapshots"("competitorTrackId", "snapshotDate");

CREATE INDEX IF NOT EXISTS "social_competitor_snapshots_clientId_businessBrandId_snapshotDate_idx"
  ON "social_competitor_snapshots"("clientId", "businessBrandId", "snapshotDate");

CREATE INDEX IF NOT EXISTS "social_competitor_snapshots_competitorTrackId_snapshotAt_idx"
  ON "social_competitor_snapshots"("competitorTrackId", "snapshotAt");

DO $$ BEGIN
  ALTER TABLE "social_competitor_tracks"
    ADD CONSTRAINT "social_competitor_tracks_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_competitor_tracks"
    ADD CONSTRAINT "social_competitor_tracks_businessBrandId_fkey"
    FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_competitor_snapshots"
    ADD CONSTRAINT "social_competitor_snapshots_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_competitor_snapshots"
    ADD CONSTRAINT "social_competitor_snapshots_businessBrandId_fkey"
    FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_competitor_snapshots"
    ADD CONSTRAINT "social_competitor_snapshots_competitorTrackId_fkey"
    FOREIGN KEY ("competitorTrackId") REFERENCES "social_competitor_tracks"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
