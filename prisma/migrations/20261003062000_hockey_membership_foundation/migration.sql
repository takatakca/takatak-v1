-- AHMV / hockey membership foundation.
-- Membership belongs to the TAKATAK master identity, not a client workspace.
-- Entitlements are derived server-side from status + planCode.

CREATE TYPE "HockeyMembershipStatus" AS ENUM (
  'incomplete',
  'active',
  'past_due',
  'grace_period',
  'canceled',
  'expired',
  'paused',
  'suspended'
);

CREATE TABLE "hockey_memberships" (
  "id" UUID NOT NULL,
  "identityId" UUID NOT NULL,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "status" "HockeyMembershipStatus" NOT NULL DEFAULT 'incomplete',
  "planCode" TEXT NOT NULL,
  "planName" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stripe',
  "externalCustomerId" TEXT,
  "externalSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "hockey_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hockey_stripe_webhook_events" (
  "id" UUID NOT NULL,
  "stripeEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "identityId" UUID,
  "sourceApplication" TEXT NOT NULL DEFAULT 'ahmverdun',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "hockey_stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hockey_memberships_identityId_sourceApplication_key"
  ON "hockey_memberships"("identityId", "sourceApplication");
CREATE INDEX "hockey_memberships_status_idx"
  ON "hockey_memberships"("status");
CREATE INDEX "hockey_memberships_planCode_idx"
  ON "hockey_memberships"("planCode");
CREATE INDEX "hockey_memberships_externalCustomerId_idx"
  ON "hockey_memberships"("externalCustomerId");
CREATE INDEX "hockey_memberships_externalSubscriptionId_idx"
  ON "hockey_memberships"("externalSubscriptionId");

CREATE UNIQUE INDEX "hockey_stripe_webhook_events_stripeEventId_key"
  ON "hockey_stripe_webhook_events"("stripeEventId");
CREATE INDEX "hockey_stripe_webhook_events_identityId_idx"
  ON "hockey_stripe_webhook_events"("identityId");
CREATE INDEX "hockey_stripe_webhook_events_sourceApplication_idx"
  ON "hockey_stripe_webhook_events"("sourceApplication");

ALTER TABLE "hockey_memberships"
  ADD CONSTRAINT "hockey_memberships_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hockey_stripe_webhook_events"
  ADD CONSTRAINT "hockey_stripe_webhook_events_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Billing tables are backend-only. RLS is enabled with zero Data API policies:
-- Prisma/service-role may access them; anon/authenticated browser roles cannot.
ALTER TABLE "hockey_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hockey_stripe_webhook_events" ENABLE ROW LEVEL SECURITY;
