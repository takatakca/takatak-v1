-- CreateEnum
CREATE TYPE "SocialCredentialStatus" AS ENUM ('active', 'expired', 'revoked', 'invalid', 'superseded');

-- AlterTable
ALTER TABLE "social_credentials" ADD COLUMN "status" "SocialCredentialStatus" NOT NULL DEFAULT 'active';
ALTER TABLE "social_credentials" ADD COLUMN "lastValidatedAt" TIMESTAMP(3);
ALTER TABLE "social_credentials" ADD COLUMN "statusChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "social_credentials_status_idx" ON "social_credentials"("status");

-- CreateIndex
CREATE INDEX "social_credentials_lastValidatedAt_idx" ON "social_credentials"("lastValidatedAt");
