-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('planned', 'pending_connection', 'tracked', 'expiring_soon', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "DnsStatus" AS ENUM ('unknown', 'not_configured', 'pending', 'valid', 'warning', 'error');

-- CreateEnum
CREATE TYPE "SslStatus" AS ENUM ('unknown', 'not_configured', 'pending', 'valid', 'expiring_soon', 'expired', 'error');

-- CreateEnum
CREATE TYPE "HostingStatus" AS ENUM ('planned', 'pending_setup', 'active_internal', 'paused', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('unknown', 'pending', 'healthy', 'warning', 'error');

-- CreateEnum
CREATE TYPE "DnsRecordType" AS ENUM ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'NS', 'SRV', 'CAA');

-- CreateEnum
CREATE TYPE "DnsRecordStatus" AS ENUM ('planned', 'pending', 'valid', 'warning', 'error');

-- CreateEnum
CREATE TYPE "WebAssetSource" AS ENUM ('internal_demo', 'upmind', 'manual', 'provider_api');

-- CreateEnum
CREATE TYPE "SslCertStatus" AS ENUM ('planned', 'pending', 'valid', 'expiring_soon', 'expired', 'error');

-- CreateEnum
CREATE TYPE "ProvisioningStepType" AS ENUM ('order_received', 'payment_confirmed', 'hosting_created', 'domain_connected', 'dns_checked', 'ssl_requested', 'ssl_ready', 'website_live');

-- CreateEnum
CREATE TYPE "ProvisioningStepStatus" AS ENUM ('planned', 'pending', 'in_progress', 'completed_internal', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "domain_assets" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "serviceInstanceId" UUID,
    "domainName" TEXT NOT NULL,
    "registrar" TEXT,
    "status" "DomainStatus" NOT NULL DEFAULT 'planned',
    "dnsStatus" "DnsStatus" NOT NULL DEFAULT 'unknown',
    "sslStatus" "SslStatus" NOT NULL DEFAULT 'unknown',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hosting_services" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "serviceInstanceId" UUID,
    "primaryDomainId" UUID,
    "planName" TEXT NOT NULL,
    "status" "HostingStatus" NOT NULL DEFAULT 'planned',
    "serverStatus" "ServerStatus" NOT NULL DEFAULT 'unknown',
    "usageSummary" JSONB,
    "renewalDate" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hosting_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dns_records" (
    "id" UUID NOT NULL,
    "domainAssetId" UUID NOT NULL,
    "type" "DnsRecordType" NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "ttl" INTEGER,
    "status" "DnsRecordStatus" NOT NULL DEFAULT 'planned',
    "source" "WebAssetSource" NOT NULL DEFAULT 'internal_demo',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dns_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ssl_certificates" (
    "id" UUID NOT NULL,
    "domainAssetId" UUID NOT NULL,
    "status" "SslCertStatus" NOT NULL DEFAULT 'planned',
    "issuer" TEXT,
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "source" "WebAssetSource" NOT NULL DEFAULT 'internal_demo',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssl_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provisioning_steps" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID,
    "serviceInstanceId" UUID,
    "hostingServiceId" UUID,
    "type" "ProvisioningStepType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ProvisioningStepStatus" NOT NULL DEFAULT 'planned',
    "order" INTEGER NOT NULL DEFAULT 0,
    "plannedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provisioning_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "domain_assets_clientId_idx" ON "domain_assets"("clientId");

-- CreateIndex
CREATE INDEX "domain_assets_businessBrandId_idx" ON "domain_assets"("businessBrandId");

-- CreateIndex
CREATE INDEX "domain_assets_serviceInstanceId_idx" ON "domain_assets"("serviceInstanceId");

-- CreateIndex
CREATE INDEX "domain_assets_domainName_idx" ON "domain_assets"("domainName");

-- CreateIndex
CREATE INDEX "domain_assets_status_idx" ON "domain_assets"("status");

-- CreateIndex
CREATE INDEX "domain_assets_dnsStatus_idx" ON "domain_assets"("dnsStatus");

-- CreateIndex
CREATE INDEX "domain_assets_sslStatus_idx" ON "domain_assets"("sslStatus");

-- CreateIndex
CREATE INDEX "domain_assets_expiresAt_idx" ON "domain_assets"("expiresAt");

-- CreateIndex
CREATE INDEX "hosting_services_clientId_idx" ON "hosting_services"("clientId");

-- CreateIndex
CREATE INDEX "hosting_services_businessBrandId_idx" ON "hosting_services"("businessBrandId");

-- CreateIndex
CREATE INDEX "hosting_services_serviceInstanceId_idx" ON "hosting_services"("serviceInstanceId");

-- CreateIndex
CREATE INDEX "hosting_services_primaryDomainId_idx" ON "hosting_services"("primaryDomainId");

-- CreateIndex
CREATE INDEX "hosting_services_status_idx" ON "hosting_services"("status");

-- CreateIndex
CREATE INDEX "hosting_services_serverStatus_idx" ON "hosting_services"("serverStatus");

-- CreateIndex
CREATE INDEX "hosting_services_renewalDate_idx" ON "hosting_services"("renewalDate");

-- CreateIndex
CREATE INDEX "dns_records_domainAssetId_idx" ON "dns_records"("domainAssetId");

-- CreateIndex
CREATE INDEX "dns_records_type_idx" ON "dns_records"("type");

-- CreateIndex
CREATE INDEX "dns_records_status_idx" ON "dns_records"("status");

-- CreateIndex
CREATE INDEX "dns_records_source_idx" ON "dns_records"("source");

-- CreateIndex
CREATE INDEX "ssl_certificates_domainAssetId_idx" ON "ssl_certificates"("domainAssetId");

-- CreateIndex
CREATE INDEX "ssl_certificates_status_idx" ON "ssl_certificates"("status");

-- CreateIndex
CREATE INDEX "ssl_certificates_expiresAt_idx" ON "ssl_certificates"("expiresAt");

-- CreateIndex
CREATE INDEX "ssl_certificates_source_idx" ON "ssl_certificates"("source");

-- CreateIndex
CREATE INDEX "provisioning_steps_clientId_idx" ON "provisioning_steps"("clientId");

-- CreateIndex
CREATE INDEX "provisioning_steps_businessBrandId_idx" ON "provisioning_steps"("businessBrandId");

-- CreateIndex
CREATE INDEX "provisioning_steps_serviceInstanceId_idx" ON "provisioning_steps"("serviceInstanceId");

-- CreateIndex
CREATE INDEX "provisioning_steps_hostingServiceId_idx" ON "provisioning_steps"("hostingServiceId");

-- CreateIndex
CREATE INDEX "provisioning_steps_type_idx" ON "provisioning_steps"("type");

-- CreateIndex
CREATE INDEX "provisioning_steps_status_idx" ON "provisioning_steps"("status");

-- CreateIndex
CREATE INDEX "provisioning_steps_order_idx" ON "provisioning_steps"("order");

-- AddForeignKey
ALTER TABLE "domain_assets" ADD CONSTRAINT "domain_assets_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_assets" ADD CONSTRAINT "domain_assets_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domain_assets" ADD CONSTRAINT "domain_assets_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "service_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosting_services" ADD CONSTRAINT "hosting_services_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosting_services" ADD CONSTRAINT "hosting_services_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosting_services" ADD CONSTRAINT "hosting_services_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "service_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hosting_services" ADD CONSTRAINT "hosting_services_primaryDomainId_fkey" FOREIGN KEY ("primaryDomainId") REFERENCES "domain_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dns_records" ADD CONSTRAINT "dns_records_domainAssetId_fkey" FOREIGN KEY ("domainAssetId") REFERENCES "domain_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssl_certificates" ADD CONSTRAINT "ssl_certificates_domainAssetId_fkey" FOREIGN KEY ("domainAssetId") REFERENCES "domain_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_steps" ADD CONSTRAINT "provisioning_steps_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_steps" ADD CONSTRAINT "provisioning_steps_businessBrandId_fkey" FOREIGN KEY ("businessBrandId") REFERENCES "business_brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_steps" ADD CONSTRAINT "provisioning_steps_serviceInstanceId_fkey" FOREIGN KEY ("serviceInstanceId") REFERENCES "service_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provisioning_steps" ADD CONSTRAINT "provisioning_steps_hostingServiceId_fkey" FOREIGN KEY ("hostingServiceId") REFERENCES "hosting_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
