-- Allow multiple SocialProviderConnection rows per Brand+provider so
-- "Add another account" can create a separate shell without touching
-- an authorized/connected connection.
-- Keep at most one pending_authorization per Brand+provider.

DROP INDEX IF EXISTS "social_provider_connections_clientId_businessBrandId_provid_key";

CREATE INDEX IF NOT EXISTS "social_provider_connections_clientId_businessBrandId_provider_idx"
  ON "social_provider_connections"("clientId", "businessBrandId", "provider");

CREATE UNIQUE INDEX IF NOT EXISTS "spc_one_pending_per_brand_provider_key"
  ON "social_provider_connections"("clientId", "businessBrandId", "provider")
  WHERE "status" = 'pending_authorization';
