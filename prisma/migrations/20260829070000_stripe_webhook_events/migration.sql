-- Stripe webhook idempotency for Social billing.
-- Lookup indexes for Customer / Subscription IDs written by Stripe webhooks.
CREATE TABLE "stripe_webhook_events" (
    "id" UUID NOT NULL,
    "stripeEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "clientId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stripe_webhook_events_stripeEventId_key" ON "stripe_webhook_events"("stripeEventId");

CREATE INDEX "stripe_webhook_events_clientId_idx" ON "stripe_webhook_events"("clientId");

CREATE INDEX "client_subscriptions_externalCustomerId_idx" ON "client_subscriptions"("externalCustomerId");

CREATE INDEX "client_subscriptions_externalSubscriptionId_idx" ON "client_subscriptions"("externalSubscriptionId");
