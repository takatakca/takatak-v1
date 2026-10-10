-- Growth Suite: modular plan subscriptions (Stripe) and webhook idempotency.
-- Separate from the Social client_subscriptions table.

-- CreateTable
CREATE TABLE "growth_subscriptions" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "planKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'incomplete',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_billing_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_billing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_subscriptions_stripeSubscriptionId_key" ON "growth_subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "growth_subscriptions_stripeCustomerId_idx" ON "growth_subscriptions"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "growth_subscriptions_clientId_planKey_key" ON "growth_subscriptions"("clientId", "planKey");

-- AddForeignKey
ALTER TABLE "growth_subscriptions" ADD CONSTRAINT "growth_subscriptions_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;


ALTER TABLE "growth_subscriptions"
  ADD CONSTRAINT "growth_subscriptions_status_values" CHECK ("status" IN ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'));
ALTER TABLE "growth_subscriptions"
  ADD CONSTRAINT "growth_subscriptions_plan_key_format" CHECK ("planKey" ~ '^[a-z0-9_]{2,40}$');

ALTER TABLE "growth_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "growth_billing_events" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL ON TABLE "growth_subscriptions", "growth_billing_events" FROM %I', role_name);
    END IF;
  END LOOP;
END $$;
