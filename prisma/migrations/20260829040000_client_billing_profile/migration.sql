ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "vatTaxId" TEXT;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "billingAddress" TEXT;

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "billingCountry" TEXT NOT NULL DEFAULT 'Canada';

ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "invoiceEmails" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "client_subscriptions"
  ADD COLUMN IF NOT EXISTS "xAccountAllowance" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "client_subscriptions"
  ADD COLUMN IF NOT EXISTS "advancedAnalytics" BOOLEAN NOT NULL DEFAULT false;
