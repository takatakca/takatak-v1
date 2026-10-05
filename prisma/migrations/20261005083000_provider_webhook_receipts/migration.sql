-- Durable intent for verified Stripe webhooks.
-- The event id is stored. The raw body and signature are not.
-- Apply idempotency stays on stripe_webhook_events / hockey_stripe_webhook_events.
-- Prisma uses the owner path. The Data API gets no grants.

CREATE TABLE "provider_webhook_receipts" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_webhook_receipts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_webhook_receipts_provider_eventId_key" ON "provider_webhook_receipts"("provider", "eventId");

CREATE INDEX "provider_webhook_receipts_status_updatedAt_idx" ON "provider_webhook_receipts"("status", "updatedAt");

ALTER TABLE "provider_webhook_receipts" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "provider_webhook_receipts" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "provider_webhook_receipts" FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "provider_webhook_receipts" FROM authenticated;
  END IF;
END $$;
