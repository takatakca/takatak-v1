-- Supporter thank-you Parent Premium grants.
-- This is an entitlement ledger, not a charitable receipt ledger.
-- It stores no payment-card data and no OAuth credentials.

CREATE TABLE "hockey_premium_grants" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "grantType" TEXT NOT NULL DEFAULT 'supporter_thank_you',
  "sourceReference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'available',
  "planCode" TEXT NOT NULL DEFAULT 'hockey_member_weekly_10',
  "grantedWeeks" INTEGER NOT NULL DEFAULT 4,
  "activatedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_premium_grants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hockey_premium_grants_weeks_check"
    CHECK ("grantedWeeks" >= 1 AND "grantedWeeks" <= 52),
  CONSTRAINT "hockey_premium_grants_status_check"
    CHECK ("status" IN ('available', 'active', 'used', 'revoked'))
);

CREATE UNIQUE INDEX "hockey_premium_grants_source_reference_key"
  ON "hockey_premium_grants"("sourceApplication", "sourceReference");

CREATE INDEX "hockey_premium_grants_identity_source_status_idx"
  ON "hockey_premium_grants"("identityId", "sourceApplication", "status");

CREATE INDEX "hockey_premium_grants_identity_expires_idx"
  ON "hockey_premium_grants"("identityId", "expiresAt");

ALTER TABLE "hockey_premium_grants"
  ADD CONSTRAINT "hockey_premium_grants_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.hockey_premium_grants ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.hockey_premium_grants FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.hockey_premium_grants FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.hockey_premium_grants FROM authenticated;
  END IF;
END $$;
