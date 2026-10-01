-- 1LV -> TAKATAK master control-plane bridge.
-- TAKATAK stores normalized source projections and remains identity authority.
-- 1LV remains transaction authority for its marketplace.

ALTER TABLE "source_synchronization_events"
ADD COLUMN IF NOT EXISTS "payload" JSONB;

CREATE TABLE IF NOT EXISTS "master_merchants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "legalName" TEXT,
  "primaryEmail" TEXT,
  "primaryPhone" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "master_merchants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_merchants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "merchantId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL,
  "externalMerchantId" TEXT NOT NULL,
  "ownerExternalUserId" TEXT,
  "storeName" TEXT NOT NULL,
  "storeSlug" TEXT,
  "collectedFields" JSONB NOT NULL,
  "marketplaceStatus" TEXT,
  "subscriptionStatus" TEXT,
  "subscriptionPlan" TEXT,
  "lastSynchronizedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "source_merchants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "source_merchants_merchantId_fkey"
    FOREIGN KEY ("merchantId")
    REFERENCES "master_merchants"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS
  "source_merchants_sourceApplication_externalMerchantId_key"
ON "source_merchants"("sourceApplication", "externalMerchantId");

CREATE INDEX IF NOT EXISTS "source_merchants_merchantId_idx"
ON "source_merchants"("merchantId");

CREATE INDEX IF NOT EXISTS
  "source_merchants_sourceApplication_lastSynchronizedAt_idx"
ON "source_merchants"("sourceApplication", "lastSynchronizedAt");

CREATE INDEX IF NOT EXISTS "master_merchants_primaryEmail_idx"
ON "master_merchants"("primaryEmail");

CREATE INDEX IF NOT EXISTS "master_merchants_primaryPhone_idx"
ON "master_merchants"("primaryPhone");


-- Master merchant projections are server-only control-plane data.
-- The canonical RLS migration ran before these tables existed, so lock them
-- down explicitly here. Prisma's owner connection keeps server-side access;
-- Supabase Data API roles receive no privileges and no policies.
ALTER TABLE public.master_merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_merchants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.master_merchants FROM PUBLIC;
REVOKE ALL ON TABLE public.source_merchants FROM PUBLIC;

DO $
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.master_merchants FROM anon;
    REVOKE ALL ON TABLE public.source_merchants FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.master_merchants FROM authenticated;
    REVOKE ALL ON TABLE public.source_merchants FROM authenticated;
  END IF;
END $;
