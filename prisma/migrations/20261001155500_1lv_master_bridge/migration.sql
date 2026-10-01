-- 1LV -> TAKATAK master control-plane bridge.
-- TAKATAK stores normalized source projections and remains identity authority.
-- 1LV remains transaction authority for its marketplace.
--
-- IMPORTANT: production may already contain the earlier 1LV marketplace
-- projection tables (master_companies/source_merchants). This migration is
-- deliberately an in-place compatibility upgrade and must work on both a
-- fresh database and that legacy production shape.

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

ALTER TABLE public.master_merchants
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

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

-- Upgrade the legacy source_merchants shape in place when it already exists.
-- New columns are initially nullable so existing rows can be backfilled first.
ALTER TABLE public.source_merchants
  ADD COLUMN IF NOT EXISTS "merchantId" UUID,
  ADD COLUMN IF NOT EXISTS "ownerExternalUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "storeName" TEXT,
  ADD COLUMN IF NOT EXISTS "storeSlug" TEXT,
  ADD COLUMN IF NOT EXISTS "marketplaceStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT;

ALTER TABLE public.source_merchants
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

DO $$
BEGIN
  -- Legacy production used companyId -> master_companies.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'source_merchants'
      AND column_name = 'companyId'
  ) AND to_regclass('public.master_companies') IS NOT NULL THEN
    EXECUTE $legacy$
      INSERT INTO public.master_merchants (
        "id",
        "legalName",
        "primaryEmail",
        "primaryPhone",
        "createdAt",
        "updatedAt"
      )
      SELECT DISTINCT
        mc."id",
        mc."legalName",
        mc."primaryEmail",
        mc."primaryPhone",
        mc."createdAt",
        mc."updatedAt"
      FROM public.master_companies mc
      JOIN public.source_merchants sm
        ON sm."companyId" = mc."id"
      ON CONFLICT ("id") DO NOTHING
    $legacy$;

    EXECUTE $legacy$
      UPDATE public.source_merchants
      SET "merchantId" = COALESCE("merchantId", "companyId")
      WHERE "companyId" IS NOT NULL
    $legacy$;

    EXECUTE $legacy$
      UPDATE public.source_merchants sm
      SET "storeName" = COALESCE(
        sm."storeName",
        mc."displayName",
        sm."externalMerchantId"
      )
      FROM public.master_companies mc
      WHERE sm."companyId" = mc."id"
    $legacy$;

    -- New writes no longer use these legacy required columns.
    EXECUTE 'ALTER TABLE public.source_merchants ALTER COLUMN "companyId" DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'source_merchants'
      AND column_name = 'vertical'
  ) THEN
    EXECUTE 'ALTER TABLE public.source_merchants ALTER COLUMN "vertical" DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'source_merchants'
      AND column_name = 'publicSlug'
  ) THEN
    EXECUTE $legacy$
      UPDATE public.source_merchants
      SET "storeSlug" = COALESCE("storeSlug", "publicSlug")
      WHERE "publicSlug" IS NOT NULL
    $legacy$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'source_merchants'
      AND column_name = 'status'
  ) THEN
    EXECUTE $legacy$
      UPDATE public.source_merchants
      SET "marketplaceStatus" = COALESCE("marketplaceStatus", "status")
      WHERE "status" IS NOT NULL
    $legacy$;
  END IF;
END
$$;

-- A legacy row without a master_companies match is still made deterministic.
-- In the historical schema companyId had an FK, so this is only a final guard.
UPDATE public.source_merchants
SET "storeName" = COALESCE("storeName", "externalMerchantId")
WHERE "storeName" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.source_merchants
    WHERE "merchantId" IS NULL OR "storeName" IS NULL
  ) THEN
    RAISE EXCEPTION
      '1LV source_merchants legacy backfill incomplete; refusing migration';
  END IF;
END
$$;

ALTER TABLE public.source_merchants
  ALTER COLUMN "merchantId" SET NOT NULL,
  ALTER COLUMN "storeName" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'source_merchants_merchantId_fkey'
      AND conrelid = 'public.source_merchants'::regclass
  ) THEN
    ALTER TABLE public.source_merchants
      ADD CONSTRAINT "source_merchants_merchantId_fkey"
      FOREIGN KEY ("merchantId")
      REFERENCES public.master_merchants("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

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

REVOKE ALL ON TABLE public.master_merchants FROM anon;
REVOKE ALL ON TABLE public.source_merchants FROM anon;
REVOKE ALL ON TABLE public.master_merchants FROM authenticated;
REVOKE ALL ON TABLE public.source_merchants FROM authenticated;
