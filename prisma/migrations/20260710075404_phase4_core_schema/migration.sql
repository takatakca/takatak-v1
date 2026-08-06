-- CreateEnum
CREATE TYPE "ProfileRole" AS ENUM ('owner', 'admin', 'manager', 'staff', 'viewer');

-- CreateEnum
CREATE TYPE "ProfileStatus" AS ENUM ('active', 'invited', 'disabled');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('prospect', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "BrandStatus" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('social_media', 'web_hosting', 'domain', 'local_listings', 'leads', 'ai_studio', 'reports', 'billing', 'support', 'custom');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('metricool', 'upmind', 'tryholo', 'openai', 'qmaps', 'flexs', 'stripe', 'supabase', 'internal');

-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('planned', 'pending_setup', 'active', 'paused', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('not_connected', 'planned', 'disabled', 'pending_credentials', 'connected', 'error', 'expired');

-- CreateEnum
CREATE TYPE "IntegrationEventStatus" AS ENUM ('received', 'processed', 'failed', 'ignored');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('create_campaign', 'generate_content', 'approve_post', 'send_to_metricool', 'sync_analytics', 'generate_report', 'send_notification', 'provision_hosting', 'sync_domain_status', 'retry_integration_task');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'retrying', 'planned');

-- CreateEnum
CREATE TYPE "JobLogLevel" AS ENUM ('info', 'warning', 'error', 'debug');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('social_media', 'web_hosting', 'local_listings', 'leads', 'monthly_business', 'client_summary');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'ready', 'sent', 'archived');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('approval_needed', 'report_ready', 'invoice_due', 'integration_error', 'job_failed', 'support_reply', 'service_renewal', 'system');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('unread', 'read', 'archived');

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL,
    "authUserId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "role" "ProfileRole" NOT NULL DEFAULT 'viewer',
    "status" "ProfileStatus" NOT NULL DEFAULT 'invited',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "companyName" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'prospect',
    "planName" TEXT,
    "assignedProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_memberships" (
    "id" UUID NOT NULL,
    "profileId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "role" "ProfileRole" NOT NULL DEFAULT 'viewer',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_brands" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "category" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "addressLine1" TEXT,
    "city" TEXT,
    "region" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Canada',
    "status" "BrandStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_instances" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "serviceType" "ServiceType" NOT NULL,
    "provider" "Provider",
    "name" TEXT NOT NULL,
    "status" "ServiceStatus" NOT NULL DEFAULT 'planned',
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "renewalDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_accounts" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "provider" "Provider" NOT NULL,
    "externalAccountId" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'not_connected',
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_events" (
    "id" UUID NOT NULL,
    "integrationAccountId" UUID,
    "provider" "Provider" NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "IntegrationEventStatus" NOT NULL DEFAULT 'received',
    "payload" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "clientId" UUID,
    "businessBrandId" UUID,
    "serviceInstanceId" UUID,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'planned',
    "provider" "Provider",
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "level" "JobLogLevel" NOT NULL DEFAULT 'info',
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "type" "ReportType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "summary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "clientId" UUID,
    "profileId" UUID,
    "type" "NotificationType" NOT NULL DEFAULT 'system',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'unread',
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "profileId" UUID,
    "clientId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_authUserId_key" ON "profiles"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- CreateIndex
CREATE INDEX "clients_status_idx" ON "clients"("status");

-- CreateIndex
CREATE INDEX "clients_createdAt_idx" ON "clients"("createdAt");

-- CreateIndex
CREATE INDEX "client_memberships_clientId_idx" ON "client_memberships"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_memberships_profileId_clientId_key" ON "client_memberships"("profileId", "clientId");

-- CreateIndex
CREATE INDEX "business_brands_clientId_idx" ON "business_brands"("clientId");

-- CreateIndex
CREATE INDEX "business_brands_status_idx" ON "business_brands"("status");

-- CreateIndex
CREATE INDEX "service_instances_clientId_idx" ON "service_instances"("clientId");

-- CreateIndex
CREATE INDEX "service_instances_businessBrandId_idx" ON "service_instances"("businessBrandId");

-- CreateIndex
CREATE INDEX "service_instances_serviceType_idx" ON "service_instances"("serviceType");

-- CreateIndex
CREATE INDEX "service_instances_status_idx" ON "service_instances"("status");

-- CreateIndex
CREATE INDEX "service_instances_provider_idx" ON "service_instances"("provider");

-- CreateIndex
CREATE INDEX "integration_accounts_clientId_idx" ON "integration_accounts"("clientId");

-- CreateIndex
CREATE INDEX "integration_accounts_businessBrandId_idx" ON "integration_accounts"("businessBrandId");

-- CreateIndex
CREATE INDEX "integration_accounts_provider_idx" ON "integration_accounts"("provider");

-- CreateIndex
CREATE INDEX "integration_accounts_status_idx" ON "integration_accounts"("status");

-- CreateIndex
CREATE INDEX "integration_events_provider_idx" ON "integration_events"("provider");

-- CreateIndex
CREATE INDEX "integration_events_status_idx" ON "integration_events"("status");

-- CreateIndex
CREATE INDEX "integration_events_createdAt_idx" ON "integration_events"("createdAt");

-- CreateIndex
CREATE INDEX "jobs_clientId_idx" ON "jobs"("clientId");

-- CreateIndex
CREATE INDEX "jobs_businessBrandId_idx" ON "jobs"("businessBrandId");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "jobs"("type");

-- CreateIndex
CREATE INDEX "jobs_provider_idx" ON "jobs"("provider");

-- CreateIndex
CREATE INDEX "jobs_createdAt_idx" ON "jobs"("createdAt");

-- CreateIndex
CREATE INDEX "job_logs_jobId_idx" ON "job_logs"("jobId");

-- CreateIndex
CREATE INDEX "job_logs_createdAt_idx" ON "job_logs"("createdAt");

-- CreateIndex
CREATE INDEX "reports_clientId_idx" ON "reports"("clientId");

-- CreateIndex
CREATE INDEX "reports_businessBrandId_idx" ON "reports"("businessBrandId");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "reports"("type");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_clientId_idx" ON "notifications"("clientId");

-- CreateIndex
CREATE INDEX "notifications_profileId_idx" ON "notifications"("profileId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_clientId_idx" ON "audit_logs"("clientId");

-- CreateIndex
CREATE INDEX "audit_logs_profileId_idx" ON "audit_logs"("profileId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_assignedProfileId_fkey" FOREIGN KEY ("assignedProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_memberships" ADD CONSTRAINT "client_memberships_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_brands" ADD CONSTRAINT "business_brands_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_instances" ADD CONSTRAINT "service_instances_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_instances" ADD CONSTRAINT "service_instances_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_integrationAccountId_fkey" FOREIGN KEY ("integrationAccountId") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "service_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
