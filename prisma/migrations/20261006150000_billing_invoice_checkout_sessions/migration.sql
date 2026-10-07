-- GROUPE TAKATAK Billing — Stripe Checkout sessions opened from the client
-- invoice center to pay a Facturations invoice. Used to reuse an open
-- session, refuse a second payment while one is complete or processing, and
-- expire an outdated session before a new one is opened. Append-only: the
-- session's live state is always re-read from Stripe.
-- Server-side Prisma access only; the Supabase Data API gets no grants.

-- CreateTable
CREATE TABLE "billing_invoice_checkout_sessions" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "issuedInvoiceId" UUID NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_invoice_checkout_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "billing_invoice_checkout_sessions_session_format"
      CHECK ("stripeSessionId" ~ '^cs_(test_|live_)?[A-Za-z0-9]{6,250}$'),
    CONSTRAINT "billing_invoice_checkout_sessions_amount_range"
      CHECK ("amountCents" BETWEEN 50 AND 99999999)
);

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoice_checkout_sessions_stripeSessionId_key" ON "billing_invoice_checkout_sessions"("stripeSessionId");

-- CreateIndex
CREATE INDEX "billing_invoice_checkout_sessions_requestId_createdAt_idx" ON "billing_invoice_checkout_sessions"("requestId", "createdAt");

-- AddForeignKey
ALTER TABLE "billing_invoice_checkout_sessions" ADD CONSTRAINT "billing_invoice_checkout_sessions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "billing_invoice_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION public.billing_invoice_checkout_sessions_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'billing_invoice_checkout_sessions rows are append-only'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER "billing_invoice_checkout_sessions_guard"
  BEFORE UPDATE OR DELETE ON "billing_invoice_checkout_sessions"
  FOR EACH ROW EXECUTE FUNCTION public.billing_invoice_checkout_sessions_guard();

-- Lockdown: Prisma uses the owner/BYPASSRLS path. No Data API grants/policies.
ALTER TABLE public.billing_invoice_checkout_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_invoice_checkout_sessions FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_invoice_checkout_sessions_guard() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.billing_invoice_checkout_sessions FROM anon;
    REVOKE ALL ON FUNCTION public.billing_invoice_checkout_sessions_guard() FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.billing_invoice_checkout_sessions FROM authenticated;
    REVOKE ALL ON FUNCTION public.billing_invoice_checkout_sessions_guard() FROM authenticated;
  END IF;
END $$;
