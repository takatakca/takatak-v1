/*
  Warnings:

  - A unique constraint covering the columns `[providerConnectionId,platform,externalAccountId]` on the table `social_accounts` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "SocialConnectionProvider" AS ENUM ('meta', 'google', 'linkedin', 'tiktok', 'pinterest', 'x', 'bluesky', 'twitch');

-- CreateEnum
CREATE TYPE "SocialConnectionStatus" AS ENUM ('not_connected', 'pending_authorization', 'authorized', 'connected', 'expired', 'error', 'disconnected', 'disabled');

-- CreateEnum
CREATE TYPE "SocialOAuthStateStatus" AS ENUM ('pending', 'completed', 'failed', 'expired', 'cancelled');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PermissionKey" ADD VALUE 'view_social';
ALTER TYPE "PermissionKey" ADD VALUE 'manage_social_accounts';

-- AlterTable
ALTER TABLE "social_accounts" ADD COLUMN     "businessLocationId" UUID,
ADD COLUMN     "providerConnectionId" UUID;

-- CreateTable
CREATE TABLE "social_provider_connections" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID NOT NULL,
    "provider" "SocialConnectionProvider" NOT NULL,
    "status" "SocialConnectionStatus" NOT NULL DEFAULT 'not_connected',
    "externalSubjectId" TEXT,
    "displayName" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "lastValidatedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "connectedAt" TIMESTAMP(3),
    "disconnectedAt" TIMESTAMP(3),
    "createdByProfileId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_provider_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_credentials" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "tokenExpiresAt" TIMESTAMP(3),
    "refreshExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_oauth_states" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "businessBrandId" UUID NOT NULL,
    "connectionId" UUID,
    "provider" "SocialConnectionProvider" NOT NULL,
    "status" "SocialOAuthStateStatus" NOT NULL DEFAULT 'pending',
    "stateHash" TEXT NOT NULL,
    "codeVerifierCiphertext" TEXT NOT NULL,
    "codeVerifierIv" TEXT NOT NULL,
    "codeVerifierAuthTag" TEXT NOT NULL,
    "returnPath" TEXT NOT NULL DEFAULT '/dashboard/social/accounts',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdByProfileId" UUID,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_provider_connections_clientId_status_idx" ON "social_provider_connections"("clientId", "status");

-- CreateIndex
CREATE INDEX "social_provider_connections_businessBrandId_status_idx" ON "social_provider_connections"("businessBrandId", "status");

-- CreateIndex
CREATE INDEX "social_provider_connections_provider_status_idx" ON "social_provider_connections"("provider", "status");

-- CreateIndex
CREATE INDEX "social_provider_connections_createdByProfileId_idx" ON "social_provider_connections"("createdByProfileId");

-- CreateIndex
CREATE INDEX "social_provider_connections_accessTokenExpiresAt_idx" ON "social_provider_connections"("accessTokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_provider_connections_clientId_businessBrandId_provid_key" ON "social_provider_connections"("clientId", "businessBrandId", "provider");

-- Tenant-safe composite relation targets
CREATE UNIQUE INDEX "spc_id_client_key" ON "social_provider_connections"("id", "clientId");

CREATE UNIQUE INDEX "spc_oauth_scope_key" ON "social_provider_connections"("id", "clientId", "businessBrandId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "social_credentials_connectionId_key" ON "social_credentials"("connectionId");

-- Required by Prisma for the tenant-safe composite one-to-one relation
CREATE UNIQUE INDEX "social_credentials_connection_client_key" ON "social_credentials"("connectionId", "clientId");

-- CreateIndex
CREATE INDEX "social_credentials_clientId_idx" ON "social_credentials"("clientId");

-- CreateIndex
CREATE INDEX "social_credentials_tokenExpiresAt_idx" ON "social_credentials"("tokenExpiresAt");

-- CreateIndex
CREATE INDEX "social_credentials_refreshExpiresAt_idx" ON "social_credentials"("refreshExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "social_oauth_states_stateHash_key" ON "social_oauth_states"("stateHash");

-- CreateIndex
CREATE INDEX "social_oauth_states_clientId_status_idx" ON "social_oauth_states"("clientId", "status");

-- CreateIndex
CREATE INDEX "social_oauth_states_businessBrandId_status_idx" ON "social_oauth_states"("businessBrandId", "status");

-- CreateIndex
CREATE INDEX "social_oauth_states_connectionId_idx" ON "social_oauth_states"("connectionId");

-- CreateIndex
CREATE INDEX "social_oauth_states_provider_status_idx" ON "social_oauth_states"("provider", "status");

-- CreateIndex
CREATE INDEX "social_oauth_states_expiresAt_idx" ON "social_oauth_states"("expiresAt");

-- CreateIndex
CREATE INDEX "social_oauth_states_createdByProfileId_idx" ON "social_oauth_states"("createdByProfileId");

-- CreateIndex
CREATE INDEX "social_accounts_providerConnectionId_idx" ON "social_accounts"("providerConnectionId");

-- CreateIndex
CREATE INDEX "social_accounts_businessLocationId_idx" ON "social_accounts"("businessLocationId");

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_providerConnectionId_platform_externalAccou_key" ON "social_accounts"("providerConnectionId", "platform", "externalAccountId");

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_providerConnectionId_fkey" FOREIGN KEY ("providerConnectionId") REFERENCES "social_provider_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_businessLocationId_fkey" FOREIGN KEY ("businessLocationId") REFERENCES "business_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_provider_connections" ADD CONSTRAINT "social_provider_connections_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_provider_connections" ADD CONSTRAINT "social_provider_connections_businessBrandId_fkey" FOREIGN KEY ("businessBrandId", "clientId") REFERENCES "business_brands"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_provider_connections" ADD CONSTRAINT "social_provider_connections_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_credentials" ADD CONSTRAINT "social_credentials_connectionId_fkey" FOREIGN KEY ("connectionId", "clientId") REFERENCES "social_provider_connections"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_businessBrandId_fkey" FOREIGN KEY ("businessBrandId", "clientId") REFERENCES "business_brands"("id", "clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_connectionId_fkey" FOREIGN KEY ("connectionId", "clientId", "businessBrandId", "provider") REFERENCES "social_provider_connections"("id", "clientId", "businessBrandId", "provider") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "social_oauth_states" ADD CONSTRAINT "social_oauth_states_createdByProfileId_fkey" FOREIGN KEY ("createdByProfileId") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
