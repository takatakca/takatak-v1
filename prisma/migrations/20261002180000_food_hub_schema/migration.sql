-- TAKATAK Food Hub inside the shared TAKATAK Supabase project.
-- Identity, sign-up, workspaces and roles stay in auth.users + public.profiles /
-- public.client_memberships. Food Hub operational data (orders, channel stores,
-- menus, jobs, activity, payouts/reconciliation documents) lives in this schema.
--
-- Access model: server-only. The dashboard reads and writes with the service
-- role after checking the TAKATAK session (src/lib/food-hub/access.ts).
-- anon and authenticated get no grants, and RLS is enabled with no policies.
-- Idempotent: safe to re-run.

CREATE SCHEMA IF NOT EXISTS foodhub;

COMMENT ON SCHEMA foodhub IS
  'TAKATAK Food Hub operational domain (delivery platforms, Clover, payouts). Server-only: service_role access, no anon/authenticated grants.';

CREATE TABLE IF NOT EXISTS foodhub.fh_channel_stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('uber_eats','doordash','skip','tgtg')),
  channel_store_id text NOT NULL,
  brand_name text NOT NULL,
  location_code text NOT NULL,
  clover_merchant_id text,
  auto_accept boolean NOT NULL DEFAULT true,
  online boolean NOT NULL DEFAULT true,
  paused_until timestamptz,
  last_status_source text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, channel_store_id)
);

CREATE TABLE IF NOT EXISTS foodhub.fh_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL,
  marketplace text NOT NULL,
  external_order_id text NOT NULL,
  channel_store_id text,
  brand_name text,
  location_code text,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','accepted','ready','dispatched','completed','cancelled','failed')),
  total numeric(12,2) NOT NULL DEFAULT 0,
  pos_order_id text,
  pos_error text,
  channel_error text,
  placed_at timestamptz,
  data jsonb NOT NULL,
  timeline jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, external_order_id)
);
CREATE INDEX IF NOT EXISTS fh_orders_created_idx ON foodhub.fh_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS fh_orders_status_idx ON foodhub.fh_orders (status);
CREATE INDEX IF NOT EXISTS fh_orders_location_idx ON foodhub.fh_orders (location_code, created_at DESC);

CREATE TABLE IF NOT EXISTS foodhub.fh_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES foodhub.fh_orders(id) ON DELETE CASCADE,
  type text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fh_order_events_order_idx ON foodhub.fh_order_events (order_id, created_at);

CREATE TABLE IF NOT EXISTS foodhub.fh_menus (
  brand_name text PRIMARY KEY,
  menu jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS foodhub.fh_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  channel text NOT NULL,
  reference text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','done','error')),
  request jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fh_jobs_reference_idx ON foodhub.fh_jobs (reference);

-- Small key/value settings (catalog, hours, commission plans, workspace activation…).
CREATE TABLE IF NOT EXISTS foodhub.fh_kv (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS foodhub.fh_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  source text NOT NULL,
  kind text NOT NULL,
  action text NOT NULL,
  status text NOT NULL,
  summary text NOT NULL,
  channel text,
  brand_name text,
  location_code text,
  store_id text,
  order_id text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS fh_activity_at_idx ON foodhub.fh_activity (at DESC);
CREATE INDEX IF NOT EXISTS fh_activity_kind_idx ON foodhub.fh_activity (kind, at DESC);

-- Generic documents: statement imports, payout lines, reconciliation cases,
-- ledger approvals, TGTG bag log, courier events… keyed by collection.
CREATE TABLE IF NOT EXISTS foodhub.fh_docs (
  collection text NOT NULL,
  id text NOT NULL,
  key text,
  at timestamptz,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS fh_docs_collection_at_idx ON foodhub.fh_docs (collection, at DESC);
CREATE INDEX IF NOT EXISTS fh_docs_collection_key_idx ON foodhub.fh_docs (collection, key);

-- Row-level security on, no policies: only the service role (which bypasses RLS) can read/write.
ALTER TABLE foodhub.fh_channel_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodhub.fh_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodhub.fh_order_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodhub.fh_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodhub.fh_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodhub.fh_kv ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodhub.fh_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE foodhub.fh_docs ENABLE ROW LEVEL SECURITY;

-- Grants: service_role only.
REVOKE ALL ON SCHEMA foodhub FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA foodhub FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA foodhub FROM anon';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA foodhub FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA foodhub REVOKE ALL ON TABLES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA foodhub FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA foodhub FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA foodhub REVOKE ALL ON TABLES FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA foodhub TO service_role';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA foodhub TO service_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA foodhub GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role';
  END IF;
END
$$;

-- Expose public + GraphQL + Rentauto + Food Hub through PostgREST (the server
-- reaches foodhub with the service role; anon/authenticated still have no grants).
-- Keep this list in sync with every exposed schema; never add "private".
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'ALTER ROLE authenticator SET pgrst.db_schemas = ''public,graphql_public,rentauto,foodhub''';
  END IF;
END
$$;

NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
