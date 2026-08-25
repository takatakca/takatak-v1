-- Step 8: Facebook Page content items (posts / reels / stories)
CREATE TABLE IF NOT EXISTS "social_content_items" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID NOT NULL,
  "socialAccountId" UUID NOT NULL,
  "contentType" TEXT NOT NULL,
  "externalIdHash" TEXT NOT NULL,
  "externalObjectId" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL,
  "captionExcerpt" TEXT,
  "permalinkUrl" TEXT,
  "thumbnailUrl" TEXT,
  "availability" TEXT NOT NULL DEFAULT 'available',
  "reach" INTEGER,
  "views" INTEGER,
  "reactions" INTEGER,
  "comments" INTEGER,
  "shares" INTEGER,
  "engagement" INTEGER,
  "metricStatus" JSONB,
  "graphApiVersion" TEXT,
  "retrievedAt" TIMESTAMP(3),
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "social_content_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sci_account_type_hash_key"
  ON "social_content_items"("socialAccountId", "contentType", "externalIdHash");

CREATE INDEX IF NOT EXISTS "social_content_items_clientId_businessBrandId_contentType_publishedAt_idx"
  ON "social_content_items"("clientId", "businessBrandId", "contentType", "publishedAt");

CREATE INDEX IF NOT EXISTS "social_content_items_socialAccountId_publishedAt_idx"
  ON "social_content_items"("socialAccountId", "publishedAt");

CREATE INDEX IF NOT EXISTS "social_content_items_socialAccountId_availability_idx"
  ON "social_content_items"("socialAccountId", "availability");

CREATE INDEX IF NOT EXISTS "social_content_items_clientId_publishedAt_idx"
  ON "social_content_items"("clientId", "publishedAt");

DO $$ BEGIN
  ALTER TABLE "social_content_items"
    ADD CONSTRAINT "social_content_items_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_content_items"
    ADD CONSTRAINT "social_content_items_businessBrandId_fkey"
    FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "social_content_items"
    ADD CONSTRAINT "social_content_items_socialAccountId_fkey"
    FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
