-- CreateEnum
CREATE TYPE "LeadSourceType" AS ENUM ('website_form', 'social_media', 'local_listing', 'referral', 'phone_call', 'email', 'paid_ads', 'flexs', 'manual', 'internal_demo', 'future_provider');

-- CreateEnum
CREATE TYPE "LeadProvider" AS ENUM ('flexs', 'qmaps', 'metricool', 'google_business', 'manual', 'internal_demo', 'future_provider');

-- CreateEnum
CREATE TYPE "LeadSourceStatus" AS ENUM ('planned', 'active_internal', 'paused', 'disabled', 'archived');

-- CreateEnum
CREATE TYPE "LeadCampaignStatus" AS ENUM ('draft', 'planned', 'active_internal', 'paused', 'completed_internal', 'archived');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new_internal', 'follow_up_planned', 'contacted_internal', 'qualified_internal', 'proposal_planned', 'won_internal', 'lost_internal', 'archived');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "PipelineStageStatus" AS ENUM ('active_internal', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('note', 'follow_up', 'call', 'email', 'meeting', 'proposal', 'status_change', 'internal_reminder');

-- CreateEnum
CREATE TYPE "LeadActivityStatus" AS ENUM ('planned', 'completed_internal', 'cancelled', 'archived');

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "name" TEXT NOT NULL,
    "type" "LeadSourceType" NOT NULL DEFAULT 'manual',
    "provider" "LeadProvider" NOT NULL DEFAULT 'internal_demo',
    "status" "LeadSourceStatus" NOT NULL DEFAULT 'planned',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_campaigns" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "leadSourceId" UUID,
    "serviceInstanceId" UUID,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "status" "LeadCampaignStatus" NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "budgetCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "leadSourceId" UUID,
    "leadCampaignId" UUID,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'new_internal',
    "priority" "LeadPriority" NOT NULL DEFAULT 'normal',
    "valueCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "assignedProfileId" UUID,
    "followUpAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_pipeline_stages" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "name" TEXT NOT NULL,
    "status" "PipelineStageStatus" NOT NULL DEFAULT 'active_internal',
    "order" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_pipeline_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "leadId" UUID,
    "leadCampaignId" UUID,
    "type" "LeadActivityType" NOT NULL DEFAULT 'note',
    "status" "LeadActivityStatus" NOT NULL DEFAULT 'planned',
    "title" TEXT NOT NULL,
    "note" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_sources_clientId_idx" ON "lead_sources"("clientId");

-- CreateIndex
CREATE INDEX "lead_sources_businessBrandId_idx" ON "lead_sources"("businessBrandId");

-- CreateIndex
CREATE INDEX "lead_sources_type_idx" ON "lead_sources"("type");

-- CreateIndex
CREATE INDEX "lead_sources_provider_idx" ON "lead_sources"("provider");

-- CreateIndex
CREATE INDEX "lead_sources_status_idx" ON "lead_sources"("status");

-- CreateIndex
CREATE INDEX "lead_sources_createdAt_idx" ON "lead_sources"("createdAt");

-- CreateIndex
CREATE INDEX "lead_campaigns_clientId_idx" ON "lead_campaigns"("clientId");

-- CreateIndex
CREATE INDEX "lead_campaigns_businessBrandId_idx" ON "lead_campaigns"("businessBrandId");

-- CreateIndex
CREATE INDEX "lead_campaigns_leadSourceId_idx" ON "lead_campaigns"("leadSourceId");

-- CreateIndex
CREATE INDEX "lead_campaigns_serviceInstanceId_idx" ON "lead_campaigns"("serviceInstanceId");

-- CreateIndex
CREATE INDEX "lead_campaigns_status_idx" ON "lead_campaigns"("status");

-- CreateIndex
CREATE INDEX "lead_campaigns_startsAt_idx" ON "lead_campaigns"("startsAt");

-- CreateIndex
CREATE INDEX "lead_campaigns_createdAt_idx" ON "lead_campaigns"("createdAt");

-- CreateIndex
CREATE INDEX "leads_clientId_idx" ON "leads"("clientId");

-- CreateIndex
CREATE INDEX "leads_businessBrandId_idx" ON "leads"("businessBrandId");

-- CreateIndex
CREATE INDEX "leads_leadSourceId_idx" ON "leads"("leadSourceId");

-- CreateIndex
CREATE INDEX "leads_leadCampaignId_idx" ON "leads"("leadCampaignId");

-- CreateIndex
CREATE INDEX "leads_assignedProfileId_idx" ON "leads"("assignedProfileId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_priority_idx" ON "leads"("priority");

-- CreateIndex
CREATE INDEX "leads_followUpAt_idx" ON "leads"("followUpAt");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE INDEX "lead_pipeline_stages_clientId_idx" ON "lead_pipeline_stages"("clientId");

-- CreateIndex
CREATE INDEX "lead_pipeline_stages_businessBrandId_idx" ON "lead_pipeline_stages"("businessBrandId");

-- CreateIndex
CREATE INDEX "lead_pipeline_stages_status_idx" ON "lead_pipeline_stages"("status");

-- CreateIndex
CREATE INDEX "lead_pipeline_stages_order_idx" ON "lead_pipeline_stages"("order");

-- CreateIndex
CREATE INDEX "lead_pipeline_stages_createdAt_idx" ON "lead_pipeline_stages"("createdAt");

-- CreateIndex
CREATE INDEX "lead_activities_clientId_idx" ON "lead_activities"("clientId");

-- CreateIndex
CREATE INDEX "lead_activities_businessBrandId_idx" ON "lead_activities"("businessBrandId");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_idx" ON "lead_activities"("leadId");

-- CreateIndex
CREATE INDEX "lead_activities_leadCampaignId_idx" ON "lead_activities"("leadCampaignId");

-- CreateIndex
CREATE INDEX "lead_activities_type_idx" ON "lead_activities"("type");

-- CreateIndex
CREATE INDEX "lead_activities_status_idx" ON "lead_activities"("status");

-- CreateIndex
CREATE INDEX "lead_activities_dueAt_idx" ON "lead_activities"("dueAt");

-- CreateIndex
CREATE INDEX "lead_activities_createdAt_idx" ON "lead_activities"("createdAt");

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_campaigns" ADD CONSTRAINT "lead_campaigns_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_campaigns" ADD CONSTRAINT "lead_campaigns_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_campaigns" ADD CONSTRAINT "lead_campaigns_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_campaigns" ADD CONSTRAINT "lead_campaigns_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "service_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_leadCampaignId_fkey" FOREIGN KEY ("leadCampaignId") REFERENCES "lead_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedProfileId_fkey" FOREIGN KEY ("assignedProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_pipeline_stages" ADD CONSTRAINT "lead_pipeline_stages_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_pipeline_stages" ADD CONSTRAINT "lead_pipeline_stages_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadCampaignId_fkey" FOREIGN KEY ("leadCampaignId") REFERENCES "lead_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
