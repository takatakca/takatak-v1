-- CreateEnum
CREATE TYPE "ReportTemplateStatus" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ReportPeriod" AS ENUM ('weekly', 'monthly', 'quarterly', 'custom');

-- CreateEnum
CREATE TYPE "ReportSectionType" AS ENUM ('summary', 'metrics', 'chart_placeholder', 'social_posts', 'campaign_performance', 'hosting_status', 'domain_status', 'leads_summary', 'recommendations', 'notes');

-- CreateEnum
CREATE TYPE "ReportSectionStatus" AS ENUM ('draft', 'ready', 'hidden');

-- CreateEnum
CREATE TYPE "ReportMetricSource" AS ENUM ('internal', 'social_foundation', 'web_hosting_foundation', 'ai_foundation', 'manual', 'future_provider');

-- CreateEnum
CREATE TYPE "ReportScheduleFrequency" AS ENUM ('weekly', 'monthly', 'quarterly', 'manual');

-- CreateEnum
CREATE TYPE "ReportScheduleStatus" AS ENUM ('planned', 'active_internal', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "ReportShareStatus" AS ENUM ('draft', 'ready_to_share', 'shared_internal', 'revoked');

-- CreateTable
CREATE TABLE "report_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ReportType" NOT NULL,
    "status" "ReportTemplateStatus" NOT NULL DEFAULT 'draft',
    "defaultPeriod" "ReportPeriod",
    "sectionsJson" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_sections" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ReportSectionType" NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "content" TEXT,
    "dataJson" JSONB,
    "status" "ReportSectionStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_metrics" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "sectionId" UUID,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "source" "ReportMetricSource" NOT NULL DEFAULT 'internal',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "reportTemplateId" UUID,
    "name" TEXT NOT NULL,
    "frequency" "ReportScheduleFrequency" NOT NULL DEFAULT 'manual',
    "status" "ReportScheduleStatus" NOT NULL DEFAULT 'planned',
    "nextRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_shares" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "sharedWithEmail" TEXT,
    "status" "ReportShareStatus" NOT NULL DEFAULT 'draft',
    "shareUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "report_templates_type_idx" ON "report_templates"("type");

-- CreateIndex
CREATE INDEX "report_templates_status_idx" ON "report_templates"("status");

-- CreateIndex
CREATE INDEX "report_templates_defaultPeriod_idx" ON "report_templates"("defaultPeriod");

-- CreateIndex
CREATE INDEX "report_templates_createdAt_idx" ON "report_templates"("createdAt");

-- CreateIndex
CREATE INDEX "report_sections_reportId_idx" ON "report_sections"("reportId");

-- CreateIndex
CREATE INDEX "report_sections_type_idx" ON "report_sections"("type");

-- CreateIndex
CREATE INDEX "report_sections_status_idx" ON "report_sections"("status");

-- CreateIndex
CREATE INDEX "report_sections_order_idx" ON "report_sections"("order");

-- CreateIndex
CREATE INDEX "report_sections_createdAt_idx" ON "report_sections"("createdAt");

-- CreateIndex
CREATE INDEX "report_metrics_reportId_idx" ON "report_metrics"("reportId");

-- CreateIndex
CREATE INDEX "report_metrics_sectionId_idx" ON "report_metrics"("sectionId");

-- CreateIndex
CREATE INDEX "report_metrics_key_idx" ON "report_metrics"("key");

-- CreateIndex
CREATE INDEX "report_metrics_source_idx" ON "report_metrics"("source");

-- CreateIndex
CREATE INDEX "report_metrics_createdAt_idx" ON "report_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "report_schedules_clientId_idx" ON "report_schedules"("clientId");

-- CreateIndex
CREATE INDEX "report_schedules_businessBrandId_idx" ON "report_schedules"("businessBrandId");

-- CreateIndex
CREATE INDEX "report_schedules_reportTemplateId_idx" ON "report_schedules"("reportTemplateId");

-- CreateIndex
CREATE INDEX "report_schedules_frequency_idx" ON "report_schedules"("frequency");

-- CreateIndex
CREATE INDEX "report_schedules_status_idx" ON "report_schedules"("status");

-- CreateIndex
CREATE INDEX "report_schedules_nextRunAt_idx" ON "report_schedules"("nextRunAt");

-- CreateIndex
CREATE INDEX "report_schedules_createdAt_idx" ON "report_schedules"("createdAt");

-- CreateIndex
CREATE INDEX "report_shares_reportId_idx" ON "report_shares"("reportId");

-- CreateIndex
CREATE INDEX "report_shares_clientId_idx" ON "report_shares"("clientId");

-- CreateIndex
CREATE INDEX "report_shares_status_idx" ON "report_shares"("status");

-- CreateIndex
CREATE INDEX "report_shares_expiresAt_idx" ON "report_shares"("expiresAt");

-- CreateIndex
CREATE INDEX "report_shares_createdAt_idx" ON "report_shares"("createdAt");

-- AddForeignKey
ALTER TABLE "report_sections" ADD CONSTRAINT "report_sections_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_metrics" ADD CONSTRAINT "report_metrics_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_metrics" ADD CONSTRAINT "report_metrics_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "report_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_reportTemplateId_fkey" FOREIGN KEY ("reportTemplateId") REFERENCES "report_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
