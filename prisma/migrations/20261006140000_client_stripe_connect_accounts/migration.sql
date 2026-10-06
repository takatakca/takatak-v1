-- Client invoicing — each client workspace's OWN Stripe account (Stripe
-- Connect with a Stripe-hosted dashboard). One account per workspace; the
-- Stripe account id never moves to another workspace. No card data, no
-- balances: only the onboarding flags Stripe reports.
-- Server-side Prisma access only; the Supabase Data API gets no grants.

-- CreateTable
CREATE TABLE "client_stripe_connect_accounts" (
    "id" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "stripeAccountId" TEXT NOT NULL,
    "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "detailsSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "country" TEXT,
    "defaultCurrency" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "connectedByProfileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_stripe_connect_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_stripe_connect_accounts_account_id_format"
      CHECK ("stripeAccountId" ~ '^acct_[A-Za-z0-9]{6,64}$'),
    CONSTRAINT "client_stripe_connect_accounts_country_format"
      CHECK ("country" IS NULL OR "country" ~ '^[A-Z]{2}$'),
    CONSTRAINT "client_stripe_connect_accounts_currency_format"
      CHECK ("defaultCurrency" IS NULL OR "defaultCurrency" ~ '^[a-z]{3}$')
);

-- CreateIndex
CREATE UNIQUE INDEX "client_stripe_connect_accounts_clientId_key" ON "client_stripe_connect_accounts"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "client_stripe_connect_accounts_stripeAccountId_key" ON "client_stripe_connect_accounts"("stripeAccountId");

-- AddForeignKey
ALTER TABLE "client_stripe_connect_accounts" ADD CONSTRAINT "client_stripe_connect_accounts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The link between a workspace and its Stripe account is permanent.
CREATE OR REPLACE FUNCTION public.client_stripe_connect_accounts_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'client_stripe_connect_accounts rows cannot be deleted'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW."id" IS DISTINCT FROM OLD."id"
     OR NEW."clientId" IS DISTINCT FROM OLD."clientId"
     OR NEW."stripeAccountId" IS DISTINCT FROM OLD."stripeAccountId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'client_stripe_connect_accounts link is immutable'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "client_stripe_connect_accounts_guard_update"
  BEFORE UPDATE ON "client_stripe_connect_accounts"
  FOR EACH ROW EXECUTE FUNCTION public.client_stripe_connect_accounts_guard();

CREATE TRIGGER "client_stripe_connect_accounts_guard_delete"
  BEFORE DELETE ON "client_stripe_connect_accounts"
  FOR EACH ROW EXECUTE FUNCTION public.client_stripe_connect_accounts_guard();

-- Lockdown: Prisma uses the owner/BYPASSRLS path. No Data API grants/policies.
ALTER TABLE public.client_stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.client_stripe_connect_accounts FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_stripe_connect_accounts_guard() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.client_stripe_connect_accounts FROM anon;
    REVOKE ALL ON FUNCTION public.client_stripe_connect_accounts_guard() FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.client_stripe_connect_accounts FROM authenticated;
    REVOKE ALL ON FUNCTION public.client_stripe_connect_accounts_guard() FROM authenticated;
  END IF;
END $$;
