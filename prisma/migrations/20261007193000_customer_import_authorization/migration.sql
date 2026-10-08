CREATE TABLE "customer_import_authorizations" (
  "id" UUID NOT NULL,
  "clientId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_import_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_import_authorizations_tokenHash_key"
  ON "customer_import_authorizations"("tokenHash");
CREATE INDEX "customer_import_authorizations_clientId_status_idx"
  ON "customer_import_authorizations"("clientId","status");
CREATE INDEX "customer_import_authorizations_expiresAt_idx"
  ON "customer_import_authorizations"("expiresAt");

ALTER TABLE "customer_import_authorizations"
  ADD CONSTRAINT "customer_import_authorizations_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public.customer_import_authorizations ENABLE ROW LEVEL SECURITY;
-- Intentionally no authenticated policies: this table is backend-only.
