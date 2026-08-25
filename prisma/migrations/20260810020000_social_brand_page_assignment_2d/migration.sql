-- Step 2D — Provider connection + Facebook Page assignment foundation
-- Safe notes:
-- 1) Do NOT unique (clientId, provider, externalSubjectId): same Meta user
--    may authorize multiple Brands under one Client.
-- 2) Run statements separately (or use the apply script). Enum ADD VALUE
--    must commit before the new value is used in later DDL.

-- AlterEnum SocialConnectionStatus
ALTER TYPE "SocialConnectionStatus" ADD VALUE IF NOT EXISTS 'reauthorization_required';
ALTER TYPE "SocialConnectionStatus" ADD VALUE IF NOT EXISTS 'failed';

-- CreateEnum SocialAccountAccessStatus
DO $$ BEGIN
  CREATE TYPE "SocialAccountAccessStatus" AS ENUM ('available', 'selected', 'permission_lost', 'removed', 'reauthorization_required');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum SocialBrandAssignmentStatus
DO $$ BEGIN
  CREATE TYPE "SocialBrandAssignmentStatus" AS ENUM ('active', 'inactive', 'permission_lost');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable social_provider_connections
ALTER TABLE "social_provider_connections" ADD COLUMN IF NOT EXISTS "authorizedAt" TIMESTAMP(3);
ALTER TABLE "social_provider_connections" ADD COLUMN IF NOT EXISTS "lastErrorAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "social_provider_connections_clientId_provider_externalSubje_idx"
  ON "social_provider_connections"("clientId", "provider", "externalSubjectId");
CREATE INDEX IF NOT EXISTS "social_provider_connections_externalSubjectId_idx"
  ON "social_provider_connections"("externalSubjectId");
CREATE INDEX IF NOT EXISTS "social_provider_connections_authorizedAt_idx"
  ON "social_provider_connections"("authorizedAt");
CREATE INDEX IF NOT EXISTS "social_provider_connections_lastErrorAt_idx"
  ON "social_provider_connections"("lastErrorAt");

-- AlterTable social_accounts
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "profileImageUrl" TEXT;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "accessStatus" "SocialAccountAccessStatus" NOT NULL DEFAULT 'available';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "isAvailableThroughAuth" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "firstDiscoveredAt" TIMESTAMP(3);
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "lastDiscoveredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "social_accounts_accessStatus_idx" ON "social_accounts"("accessStatus");
CREATE INDEX IF NOT EXISTS "social_accounts_clientId_platform_externalAccountId_idx"
  ON "social_accounts"("clientId", "platform", "externalAccountId");
CREATE INDEX IF NOT EXISTS "social_accounts_isAvailableThroughAuth_idx"
  ON "social_accounts"("isAvailableThroughAuth");

-- CreateTable social_brand_account_assignments
CREATE TABLE IF NOT EXISTS "social_brand_account_assignments" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID NOT NULL,
    "socialAccountId" UUID NOT NULL,
    "status" "SocialBrandAssignmentStatus" NOT NULL DEFAULT 'active',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByProfileId" UUID,
    "unassignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_brand_account_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_brand_account_assignments_businessBrandId_socialAccountId_key"
  ON "social_brand_account_assignments"("businessBrandId", "socialAccountId");
CREATE INDEX IF NOT EXISTS "social_brand_account_assignments_clientId_status_idx"
  ON "social_brand_account_assignments"("clientId", "status");
CREATE INDEX IF NOT EXISTS "social_brand_account_assignments_businessBrandId_status_idx"
  ON "social_brand_account_assignments"("businessBrandId", "status");
CREATE INDEX IF NOT EXISTS "social_brand_account_assignments_socialAccountId_status_idx"
  ON "social_brand_account_assignments"("socialAccountId", "status");
CREATE INDEX IF NOT EXISTS "social_brand_account_assignments_assignedByProfileId_idx"
  ON "social_brand_account_assignments"("assignedByProfileId");

-- MVP: one active assignment per Page (no Brand sharing)
CREATE UNIQUE INDEX IF NOT EXISTS "sbaa_one_active_account_key"
  ON "social_brand_account_assignments"("socialAccountId")
  WHERE "status" = 'active';

DO $$ BEGIN
  ALTER TABLE "social_brand_account_assignments"
    ADD CONSTRAINT "social_brand_account_assignments_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "social_brand_account_assignments"
    ADD CONSTRAINT "social_brand_account_assignments_businessBrandId_clientId_fkey"
    FOREIGN KEY ("businessBrandId", "clientId") REFERENCES "business_brands"("id", "clientId")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "social_brand_account_assignments"
    ADD CONSTRAINT "social_brand_account_assignments_socialAccountId_fkey"
    FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "social_brand_account_assignments"
    ADD CONSTRAINT "social_brand_account_assignments_assignedByProfileId_fkey"
    FOREIGN KEY ("assignedByProfileId") REFERENCES "profiles"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
