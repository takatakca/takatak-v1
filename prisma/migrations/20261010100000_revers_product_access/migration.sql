-- REVERS CANADA product access on the TAKATAK master identity.
-- This is a product entitlement/membership record, not a client commercial
-- billing record and not a second identity system.

CREATE TYPE "ReversMembershipStatus" AS ENUM (
  'active',
  'suspended',
  'canceled',
  'expired'
);

CREATE TABLE "revers_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'revers',
  "status" "ReversMembershipStatus" NOT NULL DEFAULT 'active',
  "planCode" TEXT NOT NULL DEFAULT 'revers_community',
  "planName" TEXT NOT NULL DEFAULT 'REVERS CANADA Community',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "revers_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "revers_memberships_identityId_sourceApplication_key"
  ON "revers_memberships"("identityId","sourceApplication");
CREATE INDEX "revers_memberships_status_idx"
  ON "revers_memberships"("status");
CREATE INDEX "revers_memberships_planCode_idx"
  ON "revers_memberships"("planCode");

ALTER TABLE "revers_memberships"
  ADD CONSTRAINT "revers_memberships_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "revers_memberships" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "revers_memberships" FROM PUBLIC;
REVOKE ALL ON TABLE "revers_memberships" FROM anon;
REVOKE ALL ON TABLE "revers_memberships" FROM authenticated;

-- The product/entitlement catalog is the authoritative feature definition.
INSERT INTO "product_catalog" ("id","code","name","status","createdAt","updatedAt")
VALUES (gen_random_uuid(),'revers','REVERS CANADA','active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "status" = 'active',
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "product_plans"
  ("id","productId","code","legacyCode","name","status","selfServeEligible","createdAt","updatedAt")
SELECT
  gen_random_uuid(),
  product."id",
  'revers_community',
  NULL,
  'REVERS CANADA Community',
  'active',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "product_catalog" product
WHERE product."code" = 'revers'
ON CONFLICT ("productId","code") DO UPDATE
SET "name" = EXCLUDED."name",
    "status" = 'active',
    "selfServeEligible" = false,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "product_entitlements"
  ("id","productId","code","name","description","active","createdAt","updatedAt")
SELECT
  gen_random_uuid(),
  product."id",
  'revers_access',
  'REVERS CANADA Access',
  'Access to the independent REVERS CANADA product experience.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "product_catalog" product
WHERE product."code" = 'revers'
ON CONFLICT ("productId","code") DO UPDATE
SET "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "active" = true,
    "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "product_plan_entitlements" ("planId","entitlementId")
SELECT plan."id", entitlement."id"
FROM "product_plans" plan
JOIN "product_catalog" product ON product."id" = plan."productId"
JOIN "product_entitlements" entitlement ON entitlement."productId" = product."id"
WHERE product."code" = 'revers'
  AND plan."code" = 'revers_community'
  AND entitlement."code" = 'revers_access'
ON CONFLICT DO NOTHING;
