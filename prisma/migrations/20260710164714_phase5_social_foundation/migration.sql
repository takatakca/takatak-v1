-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('facebook', 'instagram', 'tiktok', 'google_business', 'linkedin', 'x', 'youtube');

-- CreateEnum
CREATE TYPE "SocialAccountStatus" AS ENUM ('not_connected', 'pending_connection', 'connected', 'expired', 'error', 'disabled');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'planned', 'active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'failed');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'changes_requested', 'cancelled');

-- CreateEnum
CREATE TYPE "AnalyticsSource" AS ENUM ('manual', 'metricool', 'provider_api', 'internal_mock');

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "integrationAccountId" UUID,
    "platform" "SocialPlatform" NOT NULL,
    "handle" TEXT,
    "displayName" TEXT,
    "status" "SocialAccountStatus" NOT NULL DEFAULT 'not_connected',
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "serviceInstanceId" UUID,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "description" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "campaignId" UUID,
    "socialAccountId" UUID,
    "platform" "SocialPlatform" NOT NULL,
    "caption" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "mediaUrls" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "socialPostId" UUID NOT NULL,
    "requestedByProfileId" UUID,
    "reviewedByProfileId" UUID,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "comments" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_analytics_daily" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "socialAccountId" UUID,
    "campaignId" UUID,
    "platform" "SocialPlatform" NOT NULL,
    "date" DATE NOT NULL,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagement" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "source" "AnalyticsSource" NOT NULL DEFAULT 'manual',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_accounts_clientId_idx" ON "social_accounts"("clientId");

-- CreateIndex
CREATE INDEX "social_accounts_businessBrandId_idx" ON "social_accounts"("businessBrandId");

-- CreateIndex
CREATE INDEX "social_accounts_platform_idx" ON "social_accounts"("platform");

-- CreateIndex
CREATE INDEX "social_accounts_status_idx" ON "social_accounts"("status");

-- CreateIndex
CREATE INDEX "campaigns_clientId_idx" ON "campaigns"("clientId");

-- CreateIndex
CREATE INDEX "campaigns_businessBrandId_idx" ON "campaigns"("businessBrandId");

-- CreateIndex
CREATE INDEX "campaigns_status_idx" ON "campaigns"("status");

-- CreateIndex
CREATE INDEX "campaigns_startsAt_idx" ON "campaigns"("startsAt");

-- CreateIndex
CREATE INDEX "campaigns_createdAt_idx" ON "campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "social_posts_clientId_idx" ON "social_posts"("clientId");

-- CreateIndex
CREATE INDEX "social_posts_businessBrandId_idx" ON "social_posts"("businessBrandId");

-- CreateIndex
CREATE INDEX "social_posts_campaignId_idx" ON "social_posts"("campaignId");

-- CreateIndex
CREATE INDEX "social_posts_socialAccountId_idx" ON "social_posts"("socialAccountId");

-- CreateIndex
CREATE INDEX "social_posts_platform_idx" ON "social_posts"("platform");

-- CreateIndex
CREATE INDEX "social_posts_status_idx" ON "social_posts"("status");

-- CreateIndex
CREATE INDEX "social_posts_scheduledAt_idx" ON "social_posts"("scheduledAt");

-- CreateIndex
CREATE INDEX "social_posts_createdAt_idx" ON "social_posts"("createdAt");

-- CreateIndex
CREATE INDEX "approvals_clientId_idx" ON "approvals"("clientId");

-- CreateIndex
CREATE INDEX "approvals_businessBrandId_idx" ON "approvals"("businessBrandId");

-- CreateIndex
CREATE INDEX "approvals_socialPostId_idx" ON "approvals"("socialPostId");

-- CreateIndex
CREATE INDEX "approvals_status_idx" ON "approvals"("status");

-- CreateIndex
CREATE INDEX "approvals_requestedAt_idx" ON "approvals"("requestedAt");

-- CreateIndex
CREATE INDEX "social_analytics_daily_clientId_idx" ON "social_analytics_daily"("clientId");

-- CreateIndex
CREATE INDEX "social_analytics_daily_businessBrandId_idx" ON "social_analytics_daily"("businessBrandId");

-- CreateIndex
CREATE INDEX "social_analytics_daily_platform_idx" ON "social_analytics_daily"("platform");

-- CreateIndex
CREATE INDEX "social_analytics_daily_date_idx" ON "social_analytics_daily"("date");

-- CreateIndex
CREATE INDEX "social_analytics_daily_source_idx" ON "social_analytics_daily"("source");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "service_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "social_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requestedByProfileId_fkey" FOREIGN KEY ("requestedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_reviewedByProfileId_fkey" FOREIGN KEY ("reviewedByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_analytics_daily" ADD CONSTRAINT "social_analytics_daily_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_analytics_daily" ADD CONSTRAINT "social_analytics_daily_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_analytics_daily" ADD CONSTRAINT "social_analytics_daily_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_analytics_daily" ADD CONSTRAINT "social_analytics_daily_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
