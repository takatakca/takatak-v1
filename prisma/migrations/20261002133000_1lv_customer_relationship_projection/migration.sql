-- Modern 1LV customer <-> merchant relationship projection.
-- GROUPE TAKATAK stores identity/CRM relationship context only.
-- 1LV remains the transaction and financial authority.
--
-- Production may already contain the legacy marketplace_relationships table
-- created before the modern 1LV master bridge. Upgrade it in place without
-- deleting or rewriting existing relationship rows.

CREATE TABLE IF NOT EXISTS public.marketplace_relationships (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityId" UUID,
  "companyId" UUID,
  "sourceMerchantId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL,
  "sourceCustomerRef" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL DEFAULT 'customer_of',
  "firstSeenAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "orderCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketplace_relationships_pkey" PRIMARY KEY ("id")
);

-- Legacy rows required master_companies.companyId even though the modern 1LV
-- bridge resolves merchants through master_merchants/source_merchants.
-- Keep the old column for compatibility, but new 1LV writes do not require it.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_relationships'
      AND column_name = 'companyId'
  ) THEN
    ALTER TABLE public.marketplace_relationships
      ALTER COLUMN "companyId" DROP NOT NULL;
  END IF;
END
$$;

ALTER TABLE public.marketplace_relationships
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
  ALTER COLUMN "relationshipType" SET DEFAULT 'customer_of',
  ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_relationships_identityId_fkey'
      AND conrelid = 'public.marketplace_relationships'::regclass
  ) THEN
    ALTER TABLE public.marketplace_relationships
      ADD CONSTRAINT "marketplace_relationships_identityId_fkey"
      FOREIGN KEY ("identityId")
      REFERENCES public.master_identities("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'marketplace_relationships_sourceMerchantId_fkey'
      AND conrelid = 'public.marketplace_relationships'::regclass
  ) THEN
    ALTER TABLE public.marketplace_relationships
      ADD CONSTRAINT "marketplace_relationships_sourceMerchantId_fkey"
      FOREIGN KEY ("sourceMerchantId")
      REFERENCES public.source_merchants("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS
  "marketplace_relationships_sourceApplication_sourceCustomerRef_s"
ON public.marketplace_relationships(
  "sourceApplication",
  "sourceCustomerRef",
  "sourceMerchantId",
  "relationshipType"
);

CREATE INDEX IF NOT EXISTS
  "marketplace_relationships_identityId_sourceApplication_idx"
ON public.marketplace_relationships("identityId", "sourceApplication");

CREATE INDEX IF NOT EXISTS
  "marketplace_relationships_sourceMerchantId_idx"
ON public.marketplace_relationships("sourceMerchantId");

-- Master relationship projections are server-only. Browser/Data API roles do
-- not receive a policy or table grant.
ALTER TABLE public.marketplace_relationships ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketplace_relationships FROM PUBLIC;
REVOKE ALL ON TABLE public.marketplace_relationships FROM anon;
REVOKE ALL ON TABLE public.marketplace_relationships FROM authenticated;
