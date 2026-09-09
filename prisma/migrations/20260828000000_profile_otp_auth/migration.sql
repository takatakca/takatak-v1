-- AlterTable
ALTER TABLE "profiles" ADD COLUMN "phone" TEXT;
ALTER TABLE "profiles" ADD COLUMN "otpHash" TEXT;
ALTER TABLE "profiles" ADD COLUMN "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN "lastOtpRequestedAt" TIMESTAMP(3);
ALTER TABLE "profiles" ADD COLUMN "otpAttemptCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_phone_key" ON "profiles"("phone");
