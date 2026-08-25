-- Brand-selector / selected-Page identity indexes matching live filters.
-- Verified: prior Seq Scans on small tables were fine; under pooler contention
-- selective indexes keep canonical identity lookups index-backed as data grows.

CREATE INDEX IF NOT EXISTS "business_brands_clientId_status_name_idx"
  ON "business_brands" ("clientId", "status", "name");

CREATE INDEX IF NOT EXISTS "social_accounts_client_brand_connected_selected_idx"
  ON "social_accounts" ("clientId", "businessBrandId", "status", "accessStatus")
  WHERE "status" = 'connected' AND "accessStatus" = 'selected';

CREATE INDEX IF NOT EXISTS "social_accounts_client_brand_connected_idx"
  ON "social_accounts" ("clientId", "businessBrandId", "status")
  WHERE "status" = 'connected';

CREATE INDEX IF NOT EXISTS "spc_client_brand_connected_idx"
  ON "social_provider_connections" ("clientId", "businessBrandId", "status")
  WHERE "status" = 'connected';

-- Durable dispatch pointer for Facebook Page sync jobs.
ALTER TABLE "social_account_sync_states"
  ADD COLUMN IF NOT EXISTS "dispatchJobId" UUID;

CREATE INDEX IF NOT EXISTS "social_account_sync_states_dispatchJobId_idx"
  ON "social_account_sync_states" ("dispatchJobId");

CREATE INDEX IF NOT EXISTS "jobs_type_status_scheduled_idx"
  ON "jobs" ("type", "status", "scheduledFor");
