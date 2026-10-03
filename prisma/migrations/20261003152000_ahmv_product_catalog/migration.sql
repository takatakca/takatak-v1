-- GROUPE TAKATAK — AHMV configurable product / entitlement catalog.
-- AHMV prices live in data, not TypeScript constants. The initial commercial
-- configuration can be changed without an application redeploy.
-- Existing hockey_* plan codes remain legacy aliases for current subscriptions.

CREATE TABLE "product_catalog" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_catalog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_plans" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "legacyCode" TEXT,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "selfServeEligible" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_prices" (
  "id" UUID NOT NULL,
  "planId" UUID NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "unitAmountMinor" INTEGER NOT NULL,
  "billingInterval" TEXT NOT NULL,
  "intervalCount" INTEGER NOT NULL DEFAULT 1,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "providerPriceId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_entitlements" (
  "id" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "product_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_plan_entitlements" (
  "planId" UUID NOT NULL,
  "entitlementId" UUID NOT NULL,
  CONSTRAINT "product_plan_entitlements_pkey" PRIMARY KEY ("planId", "entitlementId")
);

CREATE TABLE "support_contributions" (
  "id" UUID NOT NULL,
  "customerId" UUID,
  "organizationId" UUID,
  "productCode" TEXT NOT NULL DEFAULT 'ahmv',
  "amountMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "frequency" TEXT NOT NULL DEFAULT 'one_time',
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "stripePaymentIntentId" TEXT,
  "stripeSubscriptionId" TEXT,
  "status" TEXT NOT NULL,
  "source" TEXT,
  "campaign" TEXT,
  "feesMinor" INTEGER NOT NULL DEFAULT 0,
  "netAmountMinor" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "support_contributions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "experience_launch_codes" (
  "id" UUID NOT NULL,
  "codeHash" TEXT NOT NULL,
  "identityId" UUID NOT NULL,
  "productCode" TEXT NOT NULL,
  "entitlementCode" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "experience_launch_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_catalog_code_key" ON "product_catalog"("code");
CREATE INDEX "product_catalog_status_idx" ON "product_catalog"("status");

CREATE UNIQUE INDEX "product_plans_productId_code_key" ON "product_plans"("productId", "code");
CREATE UNIQUE INDEX "product_plans_productId_legacyCode_key" ON "product_plans"("productId", "legacyCode");
CREATE INDEX "product_plans_status_idx" ON "product_plans"("status");

CREATE UNIQUE INDEX "product_prices_providerPriceId_key" ON "product_prices"("providerPriceId");
CREATE INDEX "product_prices_planId_active_idx" ON "product_prices"("planId", "active");
CREATE INDEX "product_prices_currency_idx" ON "product_prices"("currency");

CREATE UNIQUE INDEX "product_entitlements_productId_code_key" ON "product_entitlements"("productId", "code");
CREATE INDEX "product_entitlements_active_idx" ON "product_entitlements"("active");

CREATE UNIQUE INDEX "support_contributions_stripePaymentIntentId_key" ON "support_contributions"("stripePaymentIntentId");
CREATE UNIQUE INDEX "support_contributions_stripeSubscriptionId_key" ON "support_contributions"("stripeSubscriptionId");
CREATE INDEX "support_contributions_productCode_status_createdAt_idx" ON "support_contributions"("productCode","status","createdAt");
CREATE INDEX "support_contributions_customerId_idx" ON "support_contributions"("customerId");
CREATE INDEX "support_contributions_organizationId_idx" ON "support_contributions"("organizationId");

CREATE UNIQUE INDEX "experience_launch_codes_codeHash_key" ON "experience_launch_codes"("codeHash");
CREATE INDEX "experience_launch_codes_identityId_productCode_entitlementCode_idx"
  ON "experience_launch_codes"("identityId", "productCode", "entitlementCode");
CREATE INDEX "experience_launch_codes_expiresAt_idx" ON "experience_launch_codes"("expiresAt");

ALTER TABLE "product_plans"
  ADD CONSTRAINT "product_plans_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "product_catalog"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_prices"
  ADD CONSTRAINT "product_prices_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "product_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_entitlements"
  ADD CONSTRAINT "product_entitlements_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "product_catalog"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_plan_entitlements"
  ADD CONSTRAINT "product_plan_entitlements_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "product_plans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_plan_entitlements"
  ADD CONSTRAINT "product_plan_entitlements_entitlementId_fkey"
  FOREIGN KEY ("entitlementId") REFERENCES "product_entitlements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "experience_launch_codes"
  ADD CONSTRAINT "experience_launch_codes_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Server-only tables: deny browser Data API roles and enable RLS as defense in depth.
ALTER TABLE "product_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_prices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "product_plan_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_contributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "experience_launch_codes" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "product_catalog" FROM anon, authenticated;
REVOKE ALL ON TABLE "product_plans" FROM anon, authenticated;
REVOKE ALL ON TABLE "product_prices" FROM anon, authenticated;
REVOKE ALL ON TABLE "product_entitlements" FROM anon, authenticated;
REVOKE ALL ON TABLE "product_plan_entitlements" FROM anon, authenticated;
REVOKE ALL ON TABLE "support_contributions" FROM anon, authenticated;
REVOKE ALL ON TABLE "experience_launch_codes" FROM anon, authenticated;

-- Initial AHMV catalog. IDs are generated by PostgreSQL; all relationships
-- are resolved by stable product/plan/entitlement codes.
INSERT INTO "product_catalog" ("id","code","name","status","updatedAt")
VALUES (gen_random_uuid(),'ahmv','AHMV Parent Experience','active',CURRENT_TIMESTAMP);

INSERT INTO "product_plans"
  ("id","productId","code","legacyCode","name","status","selfServeEligible","updatedAt")
SELECT gen_random_uuid(), p."id", seed."code", seed."legacyCode", seed."name", seed."status", seed."selfServeEligible", CURRENT_TIMESTAMP
FROM "product_catalog" p
CROSS JOIN (
  VALUES
    ('parent_essential','hockey_member_weekly_10','AHMV Parent Essential','active',true),
    ('parent_premium','hockey_vip_weekly_30','AHMV Parent Premium','planned',false)
) AS seed("code","legacyCode","name","status","selfServeEligible")
WHERE p."code" = 'ahmv';

INSERT INTO "product_prices"
  ("id","planId","currency","unitAmountMinor","billingInterval","intervalCount","provider","providerPriceId","active","updatedAt")
SELECT
  gen_random_uuid(),
  plan."id",
  seed."currency",
  seed."unitAmountMinor",
  seed."billingInterval",
  seed."intervalCount",
  'stripe',
  NULL,
  true,
  CURRENT_TIMESTAMP
FROM "product_plans" plan
JOIN "product_catalog" product ON product."id" = plan."productId"
JOIN (
  VALUES
    ('parent_essential','CAD',1000,'month',1),
    ('parent_premium','CAD',3000,'month',1)
) AS seed("planCode","currency","unitAmountMinor","billingInterval","intervalCount")
  ON seed."planCode" = plan."code"
WHERE product."code" = 'ahmv';

INSERT INTO "product_entitlements"
  ("id","productId","code","name","active","updatedAt")
SELECT gen_random_uuid(), p."id", seed."code", seed."name", true, CURRENT_TIMESTAMP
FROM "product_catalog" p
CROSS JOIN (
  VALUES
    ('ahmv_access','AHMV Experience Access'),
    ('ad_free','Ad-free experience'),
    ('ai_assistant','AI assistant'),
    ('game_reminders','Game reminders'),
    ('calendar_sync','Calendar sync'),
    ('team_community','Team community'),
    ('parent_messaging','Parent messaging'),
    ('parent_rideshare','Parent rideshare'),
    ('tournament_travel','Tournament travel'),
    ('family_live_coordination','Family live coordination')
) AS seed("code","name")
WHERE p."code" = 'ahmv';

INSERT INTO "product_plan_entitlements" ("planId","entitlementId")
SELECT plan."id", entitlement."id"
FROM "product_plans" plan
JOIN "product_catalog" product ON product."id" = plan."productId"
JOIN "product_entitlements" entitlement ON entitlement."productId" = product."id"
WHERE product."code" = 'ahmv'
  AND plan."code" = 'parent_essential'
  AND entitlement."code" IN (
    'ahmv_access','ad_free','ai_assistant','game_reminders','calendar_sync',
    'team_community','parent_messaging','parent_rideshare'
  );

INSERT INTO "product_plan_entitlements" ("planId","entitlementId")
SELECT plan."id", entitlement."id"
FROM "product_plans" plan
JOIN "product_catalog" product ON product."id" = plan."productId"
JOIN "product_entitlements" entitlement ON entitlement."productId" = product."id"
WHERE product."code" = 'ahmv'
  AND plan."code" = 'parent_premium';
