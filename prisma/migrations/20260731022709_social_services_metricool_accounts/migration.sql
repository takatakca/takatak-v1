/*
  Warnings:

  - A unique constraint covering the columns `[clientId,businessBrandId,provider]` on the table `integration_accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[clientId,businessBrandId,serviceType]` on the table `service_instances` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[integrationAccountId,platform,externalAccountId]` on the table `social_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SocialPlatform" ADD VALUE 'threads';
ALTER TYPE "SocialPlatform" ADD VALUE 'pinterest';
ALTER TYPE "SocialPlatform" ADD VALUE 'bluesky';
ALTER TYPE "SocialPlatform" ADD VALUE 'twitch';

-- AlterTable
ALTER TABLE "integration_accounts" ADD COLUMN     "connectedAt" TIMESTAMP(3),
ADD COLUMN     "disconnectedAt" TIMESTAMP(3),
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "lastError" TEXT;

-- AlterTable
ALTER TABLE "social_accounts" ADD COLUMN     "accountType" TEXT,
ADD COLUMN     "externalAccountId" TEXT,
ADD COLUMN     "profileUrl" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "integration_accounts_clientId_businessBrandId_provider_key" ON "integration_accounts"("clientId", "businessBrandId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "service_instances_clientId_businessBrandId_serviceType_key" ON "service_instances"("clientId", "businessBrandId", "serviceType");

-- CreateIndex
CREATE INDEX "social_accounts_integrationAccountId_idx" ON "social_accounts"("integrationAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_integrationAccountId_platform_externalAccou_key" ON "social_accounts"("integrationAccountId", "platform", "externalAccountId");
