-- Source-scoped OTP challenges for 1LV sign-in through GROUPE TAKATAK.
-- OTP codes are never stored here; Twilio Verify owns the verification code.

CREATE TABLE "source_otp_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceApplication" TEXT NOT NULL,
    "identityId" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "source_otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "source_otp_challenges_sourceApplication_identityId_requestedAt_idx"
ON "source_otp_challenges"("sourceApplication", "identityId", "requestedAt");

CREATE INDEX "source_otp_challenges_status_expiresAt_idx"
ON "source_otp_challenges"("status", "expiresAt");

ALTER TABLE "source_otp_challenges"
ADD CONSTRAINT "source_otp_challenges_identityId_fkey"
FOREIGN KEY ("identityId")
REFERENCES "master_identities"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "source_otp_challenges" ENABLE ROW LEVEL SECURITY;
