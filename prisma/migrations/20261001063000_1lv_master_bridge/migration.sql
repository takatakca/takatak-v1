-- GROUPE TAKATAK master bridge for 1LV.
-- Marketplace merchants remain source merchants unless explicitly promoted
-- into a TAKATAK managed Client/BusinessBrand through a separate workflow.

CREATE TABLE "source_merchant_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceApplication" TEXT NOT NULL,
    "externalMerchantId" TEXT NOT NULL,
    "ownerExternalUserId" TEXT,
    "storeName" TEXT NOT NULL,
    "storeSlug" TEXT,
    "legalBusinessName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" JSONB,
    "marketplaceStatus" TEXT,
    "subscriptionStatus" TEXT,
    "subscriptionPlan" TEXT,
    "lastSynchronizedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "source_merchant_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_commerce_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceApplication" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerExternalReference" TEXT,
    "customerIsGuest" BOOLEAN NOT NULL DEFAULT false,
    "merchantExternalIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "splits" JSONB NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL,
    "fulfillmentStatus" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "lastSynchronizedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "source_commerce_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "source_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceApplication" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "customerExternalReference" TEXT NOT NULL,
    "customerIsGuest" BOOLEAN NOT NULL DEFAULT false,
    "merchantExternalReference" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "orderCount" INTEGER,
    "lifetimeValueMinor" INTEGER,
    "currency" TEXT NOT NULL,
    "lastSynchronizedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "source_relationships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "source_merchant_profiles_sourceApplication_externalMerchantId_key"
ON "source_merchant_profiles"("sourceApplication", "externalMerchantId");
CREATE INDEX "source_merchant_profiles_sourceApplication_idx"
ON "source_merchant_profiles"("sourceApplication");
CREATE INDEX "source_merchant_profiles_contactEmail_idx"
ON "source_merchant_profiles"("contactEmail");

CREATE UNIQUE INDEX "source_commerce_orders_sourceApplication_externalOrderId_key"
ON "source_commerce_orders"("sourceApplication", "externalOrderId");
CREATE INDEX "source_commerce_orders_sourceApplication_occurredAt_idx"
ON "source_commerce_orders"("sourceApplication", "occurredAt");
CREATE INDEX "source_commerce_orders_orderNumber_idx"
ON "source_commerce_orders"("orderNumber");

CREATE UNIQUE INDEX "source_relationships_sourceApplication_relationshipType_customerExternalReference_merchantExternalReference_key"
ON "source_relationships"("sourceApplication", "relationshipType", "customerExternalReference", "merchantExternalReference");
CREATE INDEX "source_relationships_sourceApplication_merchantExternalReference_idx"
ON "source_relationships"("sourceApplication", "merchantExternalReference");
CREATE INDEX "source_relationships_customerExternalReference_idx"
ON "source_relationships"("customerExternalReference");

ALTER TABLE "source_merchant_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_commerce_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "source_relationships" ENABLE ROW LEVEL SECURITY;
