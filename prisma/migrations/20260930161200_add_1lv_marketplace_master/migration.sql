-- TAKATAK master marketplace foundation for 1LV.CA.
-- Master identity remains global; merchant-facing access must stay source/tenant scoped.

CREATE TABLE "master_companies" (
  "id" UUID NOT NULL,
  "legalName" TEXT,
  "displayName" TEXT NOT NULL,
  "primaryEmail" TEXT,
  "primaryPhone" TEXT,
  "country" TEXT,
  "province" TEXT,
  "status" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "master_companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_merchants" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL,
  "externalMerchantId" TEXT NOT NULL,
  "vertical" TEXT NOT NULL,
  "publicSlug" TEXT,
  "collectedFields" JSONB NOT NULL,
  "status" TEXT,
  "lastSynchronizedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "source_merchants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketplace_relationships" (
  "id" UUID NOT NULL,
  "identityId" UUID,
  "companyId" UUID NOT NULL,
  "sourceMerchantId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL,
  "sourceCustomerRef" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL DEFAULT 'customer_of',
  "firstSeenAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3),
  "orderCount" INTEGER,
  "lifetimeValue" DECIMAL(14,2),
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "marketplace_relationships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_marketplace_orders" (
  "id" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL,
  "externalOrderId" TEXT NOT NULL,
  "externalOrderNumber" TEXT,
  "identityId" UUID,
  "sourceMerchantId" UUID,
  "companyId" UUID,
  "customerReference" TEXT,
  "total" DECIMAL(14,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "paymentStatus" TEXT,
  "fulfillmentStatus" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "collectedFields" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "source_marketplace_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "master_companies_displayName_idx" ON "master_companies"("displayName");
CREATE INDEX "master_companies_primaryEmail_idx" ON "master_companies"("primaryEmail");
CREATE UNIQUE INDEX "source_merchants_sourceApplication_externalMerchantId_key"
  ON "source_merchants"("sourceApplication", "externalMerchantId");
CREATE INDEX "source_merchants_companyId_idx" ON "source_merchants"("companyId");
CREATE INDEX "source_merchants_sourceApplication_status_idx" ON "source_merchants"("sourceApplication", "status");
CREATE UNIQUE INDEX "marketplace_relationships_sourceApplication_sourceCustomerRef_sourceMerchantId_relationshipType_key"
  ON "marketplace_relationships"("sourceApplication", "sourceCustomerRef", "sourceMerchantId", "relationshipType");
CREATE INDEX "marketplace_relationships_identityId_sourceApplication_idx"
  ON "marketplace_relationships"("identityId", "sourceApplication");
CREATE INDEX "marketplace_relationships_companyId_sourceApplication_idx"
  ON "marketplace_relationships"("companyId", "sourceApplication");
CREATE UNIQUE INDEX "source_marketplace_orders_sourceApplication_externalOrderId_key"
  ON "source_marketplace_orders"("sourceApplication", "externalOrderId");
CREATE INDEX "source_marketplace_orders_identityId_occurredAt_idx"
  ON "source_marketplace_orders"("identityId", "occurredAt");
CREATE INDEX "source_marketplace_orders_companyId_occurredAt_idx"
  ON "source_marketplace_orders"("companyId", "occurredAt");
CREATE INDEX "source_marketplace_orders_sourceApplication_paymentStatus_idx"
  ON "source_marketplace_orders"("sourceApplication", "paymentStatus");

ALTER TABLE "source_merchants"
  ADD CONSTRAINT "source_merchants_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "master_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "marketplace_relationships"
  ADD CONSTRAINT "marketplace_relationships_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "marketplace_relationships"
  ADD CONSTRAINT "marketplace_relationships_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "master_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "marketplace_relationships"
  ADD CONSTRAINT "marketplace_relationships_sourceMerchantId_fkey"
  FOREIGN KEY ("sourceMerchantId") REFERENCES "source_merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "source_marketplace_orders"
  ADD CONSTRAINT "source_marketplace_orders_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "source_marketplace_orders"
  ADD CONSTRAINT "source_marketplace_orders_sourceMerchantId_fkey"
  FOREIGN KEY ("sourceMerchantId") REFERENCES "source_merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "source_marketplace_orders"
  ADD CONSTRAINT "source_marketplace_orders_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "master_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Master marketplace tables are Prisma/server-only in this phase.
-- Enable RLS and revoke Data API privileges explicitly because this migration
-- runs after the canonical all-public-table lockdown migration.
DO $$
DECLARE
  table_name text;
  protected_tables text[] := ARRAY[
    'master_companies',
    'source_merchants',
    'marketplace_relationships',
    'source_marketplace_orders'
  ];
BEGIN
  FOREACH table_name IN ARRAY protected_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', table_name);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', table_name);
    END IF;
  END LOOP;
END $$;
