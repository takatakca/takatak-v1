-- CreateEnum
CREATE TYPE "SocialAdPlatform" AS ENUM ('meta_ads', 'google_ads');

-- CreateEnum
CREATE TYPE "SocialAdAccountStatus" AS ENUM ('not_connected', 'pending_connection', 'connected', 'expired', 'error', 'disabled');

-- CreateTable
CREATE TABLE "social_ad_accounts" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID NOT NULL,
    "providerConnectionId" UUID,
    "platform" "SocialAdPlatform" NOT NULL,
    "externalAccountId" TEXT NOT NULL,
    "displayName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "status" "SocialAdAccountStatus" NOT NULL DEFAULT 'not_connected',
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_ad_analytics_daily" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID NOT NULL,
    "adAccountId" UUID NOT NULL,
    "platform" "SocialAdPlatform" NOT NULL,
    "date" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spendMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "source" "AnalyticsSource" NOT NULL DEFAULT 'manual',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_ad_analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_ad_accounts_clientId_status_idx" ON "social_ad_accounts"("clientId", "status");

-- CreateIndex
CREATE INDEX "social_ad_accounts_businessBrandId_status_idx" ON "social_ad_accounts"("businessBrandId", "status");

-- CreateIndex
CREATE INDEX "social_ad_accounts_providerConnectionId_idx" ON "social_ad_accounts"("providerConnectionId");

-- CreateIndex
CREATE INDEX "social_ad_accounts_platform_status_idx" ON "social_ad_accounts"("platform", "status");

-- CreateIndex
CREATE INDEX "social_ad_accounts_lastSyncAt_idx" ON "social_ad_accounts"("lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_ad_accounts_provider_key" ON "social_ad_accounts"("clientId", "businessBrandId", "platform", "externalAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "social_ad_accounts_scope_key" ON "social_ad_accounts"("id", "clientId", "businessBrandId");

-- CreateIndex
CREATE INDEX "social_ad_analytics_daily_clientId_date_idx" ON "social_ad_analytics_daily"("clientId", "date");

-- CreateIndex
CREATE INDEX "social_ad_analytics_daily_businessBrandId_date_idx" ON "social_ad_analytics_daily"("businessBrandId", "date");

-- CreateIndex
CREATE INDEX "social_ad_analytics_daily_platform_date_idx" ON "social_ad_analytics_daily"("platform", "date");

-- CreateIndex
CREATE INDEX "social_ad_analytics_daily_source_idx" ON "social_ad_analytics_daily"("source");

-- CreateIndex
CREATE UNIQUE INDEX "social_ad_analytics_daily_adAccountId_date_key" ON "social_ad_analytics_daily"("adAccountId", "date");

-- AddForeignKey
ALTER TABLE "social_ad_accounts" ADD CONSTRAINT "social_ad_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_ad_accounts" ADD CONSTRAINT "social_ad_accounts_businessBrandId_clientId_fkey" FOREIGN KEY ("businessBrandId", "clientId") REFERENCES "business_brands"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_ad_accounts" ADD CONSTRAINT "social_ad_accounts_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "social_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_ad_analytics_daily" ADD CONSTRAINT "social_ad_analytics_daily_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_ad_analytics_daily" ADD CONSTRAINT "social_ad_analytics_daily_businessBrandId_clientId_fkey" FOREIGN KEY ("businessBrandId", "clientId") REFERENCES "business_brands"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_ad_analytics_daily" ADD CONSTRAINT "social_ad_analytics_daily_adAccountId_clientId_businessBra_fkey" FOREIGN KEY ("adAccountId", "clientId", "businessBrandId") REFERENCES "social_ad_accounts"("id", "clientId", "businessBrandId") ON DELETE CASCADE ON UPDATE CASCADE;
