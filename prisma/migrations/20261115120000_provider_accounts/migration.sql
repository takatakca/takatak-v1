-- Ecosystem provider registry on the TAKATAK master identity.
-- One row per identity per provider source (e.g. 'sc4nner'): the provider
-- copy of the account, created at signup/first authorization. Identity and
-- email are captured once here so every provider is grouped in the main
-- database. This is not a second identity system and not a billing record:
-- MasterIdentity stays the only identity authority, and no address or
-- verification is required to open a row.

CREATE TABLE "provider_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "identityId" UUID NOT NULL,
  "email" TEXT,
  "displayName" TEXT,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "provisionStatus" TEXT NOT NULL DEFAULT 'pending',
  "firstLinkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastProvisionedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "provider_accounts_identityId_source_key"
  ON "provider_accounts"("identityId","source");
CREATE INDEX "provider_accounts_email_idx"
  ON "provider_accounts"("email");
CREATE INDEX "provider_accounts_source_provisionStatus_idx"
  ON "provider_accounts"("source","provisionStatus");

ALTER TABLE "provider_accounts"
  ADD CONSTRAINT "provider_accounts_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "master_identities"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "provider_accounts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "provider_accounts" FROM PUBLIC;
REVOKE ALL ON TABLE "provider_accounts" FROM anon;
REVOKE ALL ON TABLE "provider_accounts" FROM authenticated;
