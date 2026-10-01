-- Make 1LV master OTP calls idempotent and concurrency-safe.

ALTER TABLE "source_otp_challenges"
ADD COLUMN "requestId" TEXT,
ADD COLUMN "verificationRequestId" TEXT;

CREATE UNIQUE INDEX "source_otp_challenges_requestId_key"
ON "source_otp_challenges"("requestId");

CREATE UNIQUE INDEX "source_otp_challenges_verificationRequestId_key"
ON "source_otp_challenges"("verificationRequestId");

CREATE UNIQUE INDEX "source_otp_challenges_one_active_per_identity_key"
ON "source_otp_challenges"("sourceApplication", "identityId", "channel")
WHERE "status" IN ('PENDING', 'VERIFYING');
