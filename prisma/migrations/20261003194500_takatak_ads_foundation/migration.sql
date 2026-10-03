-- TAKATAK ADS proprietary local advertising network foundation.
-- Public ad serving is performed through server-side Prisma only.
-- No raw IP addresses, emails, phone numbers, or browser fingerprints are stored.

ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'view_ads';
ALTER TYPE "PermissionKey" ADD VALUE IF NOT EXISTS 'manage_ads';

CREATE TYPE "AdsPublisherStatus" AS ENUM ('active', 'paused', 'retired');
CREATE TYPE "AdsPlacementStatus" AS ENUM ('active', 'paused', 'retired');
CREATE TYPE "AdsCampaignStatus" AS ENUM ('draft', 'active', 'paused', 'completed', 'canceled');
CREATE TYPE "AdsCampaignScope" AS ENUM ('single_site', 'local_network', 'max_lead_pro');
CREATE TYPE "AdsPricingModel" AS ENUM ('cpm', 'cpc', 'cpl', 'fixed');
CREATE TYPE "AdsCreativeStatus" AS ENUM ('draft', 'active', 'paused', 'rejected', 'archived');
CREATE TYPE "AdsEventType" AS ENUM ('impression', 'click', 'lead', 'call', 'form_submit', 'conversion');

CREATE TABLE "ad_publishers" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "category" TEXT,
  "country" TEXT NOT NULL DEFAULT 'Canada',
  "region" TEXT,
  "allowedOrigins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "AdsPublisherStatus" NOT NULL DEFAULT 'active',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_publishers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_placements" (
  "id" UUID NOT NULL,
  "publisherId" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "pagePattern" TEXT,
  "format" TEXT NOT NULL DEFAULT 'display',
  "width" INTEGER,
  "height" INTEGER,
  "device" TEXT,
  "status" "AdsPlacementStatus" NOT NULL DEFAULT 'active',
  "floorCpmCents" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ad_placements_floor_nonnegative" CHECK ("floorCpmCents" >= 0)
);

CREATE TABLE "ad_subscriptions" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'trial',
  "planCode" TEXT,
  "planName" TEXT,
  "provider" TEXT,
  "externalCustomerId" TEXT,
  "externalSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_campaigns" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "businessBrandId" UUID,
  "name" TEXT NOT NULL,
  "status" "AdsCampaignStatus" NOT NULL DEFAULT 'draft',
  "scope" "AdsCampaignScope" NOT NULL,
  "objective" TEXT,
  "pricingModel" "AdsPricingModel" NOT NULL DEFAULT 'fixed',
  "budgetCents" INTEGER NOT NULL,
  "dailyBudgetCents" INTEGER,
  "spentCents" INTEGER NOT NULL DEFAULT 0,
  "bidCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'CAD',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "targeting" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ad_campaigns_budget_positive" CHECK ("budgetCents" > 0),
  CONSTRAINT "ad_campaigns_daily_budget_positive" CHECK ("dailyBudgetCents" IS NULL OR "dailyBudgetCents" > 0),
  CONSTRAINT "ad_campaigns_spent_nonnegative" CHECK ("spentCents" >= 0),
  CONSTRAINT "ad_campaigns_bid_nonnegative" CHECK ("bidCents" IS NULL OR "bidCents" >= 0),
  CONSTRAINT "ad_campaigns_dates_valid" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE TABLE "ad_creatives" (
  "id" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "headline" TEXT NOT NULL,
  "body" TEXT,
  "callToAction" TEXT,
  "destinationUrl" TEXT NOT NULL,
  "imageUrl" TEXT,
  "status" "AdsCreativeStatus" NOT NULL DEFAULT 'draft',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ad_creatives_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_campaign_placements" (
  "campaignId" UUID NOT NULL,
  "placementId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_campaign_placements_pkey" PRIMARY KEY ("campaignId", "placementId")
);

CREATE TABLE "ad_events" (
  "id" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "creativeId" UUID,
  "placementId" UUID NOT NULL,
  "type" "AdsEventType" NOT NULL,
  "dedupeKey" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "country" TEXT,
  "region" TEXT,
  "city" TEXT,
  "postalPrefix" TEXT,
  "locale" TEXT,
  "metadata" JSONB,
  CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ad_publishers_code_key" ON "ad_publishers"("code");
CREATE INDEX "ad_publishers_status_idx" ON "ad_publishers"("status");
CREATE INDEX "ad_publishers_domain_idx" ON "ad_publishers"("domain");

CREATE UNIQUE INDEX "ad_placements_publisherId_code_key" ON "ad_placements"("publisherId", "code");
CREATE INDEX "ad_placements_code_idx" ON "ad_placements"("code");
CREATE INDEX "ad_placements_status_idx" ON "ad_placements"("status");

CREATE UNIQUE INDEX "ad_subscriptions_clientId_key" ON "ad_subscriptions"("clientId");
CREATE INDEX "ad_subscriptions_status_idx" ON "ad_subscriptions"("status");
CREATE INDEX "ad_subscriptions_planCode_idx" ON "ad_subscriptions"("planCode");
CREATE INDEX "ad_subscriptions_externalCustomerId_idx" ON "ad_subscriptions"("externalCustomerId");
CREATE INDEX "ad_subscriptions_externalSubscriptionId_idx" ON "ad_subscriptions"("externalSubscriptionId");

CREATE INDEX "ad_campaigns_clientId_idx" ON "ad_campaigns"("clientId");
CREATE INDEX "ad_campaigns_businessBrandId_idx" ON "ad_campaigns"("businessBrandId");
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");
CREATE INDEX "ad_campaigns_scope_idx" ON "ad_campaigns"("scope");
CREATE INDEX "ad_campaigns_startsAt_endsAt_idx" ON "ad_campaigns"("startsAt", "endsAt");

CREATE INDEX "ad_creatives_campaignId_status_idx" ON "ad_creatives"("campaignId", "status");
CREATE INDEX "ad_campaign_placements_placementId_idx" ON "ad_campaign_placements"("placementId");

CREATE UNIQUE INDEX "ad_events_dedupeKey_key" ON "ad_events"("dedupeKey");
CREATE INDEX "ad_events_campaignId_occurredAt_idx" ON "ad_events"("campaignId", "occurredAt");
CREATE INDEX "ad_events_creativeId_occurredAt_idx" ON "ad_events"("creativeId", "occurredAt");
CREATE INDEX "ad_events_placementId_occurredAt_idx" ON "ad_events"("placementId", "occurredAt");
CREATE INDEX "ad_events_type_occurredAt_idx" ON "ad_events"("type", "occurredAt");

ALTER TABLE "ad_placements"
  ADD CONSTRAINT "ad_placements_publisherId_fkey"
  FOREIGN KEY ("publisherId") REFERENCES "ad_publishers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_subscriptions"
  ADD CONSTRAINT "ad_subscriptions_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_campaigns"
  ADD CONSTRAINT "ad_campaigns_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_campaigns"
  ADD CONSTRAINT "ad_campaigns_businessBrandId_fkey"
  FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ad_creatives"
  ADD CONSTRAINT "ad_creatives_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_campaign_placements"
  ADD CONSTRAINT "ad_campaign_placements_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_campaign_placements"
  ADD CONSTRAINT "ad_campaign_placements_placementId_fkey"
  FOREIGN KEY ("placementId") REFERENCES "ad_placements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_events"
  ADD CONSTRAINT "ad_events_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_events"
  ADD CONSTRAINT "ad_events_creativeId_fkey"
  FOREIGN KEY ("creativeId") REFERENCES "ad_creatives"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ad_events"
  ADD CONSTRAINT "ad_events_placementId_fkey"
  FOREIGN KEY ("placementId") REFERENCES "ad_placements"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Prisma server access only in V1. No PostgREST client policies are installed.
ALTER TABLE "ad_publishers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_placements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_creatives" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_campaign_placements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_events" ENABLE ROW LEVEL SECURITY;
