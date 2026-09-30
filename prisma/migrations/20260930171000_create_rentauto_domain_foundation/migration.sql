-- Rentauto domain foundation inside the shared TAKATAK Supabase project.
-- Shared identity/auth stay in auth.users + public.profiles/master_identities.
-- Rentauto-specific authorization and lifecycle state live in this schema.

CREATE SCHEMA IF NOT EXISTS rentauto;

COMMENT ON SCHEMA rentauto IS
  'Rentauto operational domain. Shared identity remains authoritative in TAKATAK public/auth schemas.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'app_role'
      AND n.nspname = 'rentauto'
  ) THEN
    CREATE TYPE rentauto.app_role AS ENUM ('guest', 'host', 'admin');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'account_status'
      AND n.nspname = 'rentauto'
  ) THEN
    CREATE TYPE rentauto.account_status AS ENUM (
      'active',
      'pending_verification',
      'suspended',
      'closed'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS rentauto.accounts (
  auth_user_id uuid PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,
  master_identity_id uuid UNIQUE
    REFERENCES public.master_identities(id) ON DELETE SET NULL,
  legacy_user_id text UNIQUE,
  status rentauto.account_status NOT NULL DEFAULT 'pending_verification',
  driver_verification_status text NOT NULL DEFAULT 'not_started',
  host_onboarding_status text NOT NULL DEFAULT 'not_started',
  preferred_locale text NOT NULL DEFAULT 'fr'
    CHECK (preferred_locale IN ('fr','en','es')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_accounts_master_identity_idx
  ON rentauto.accounts(master_identity_id);

CREATE INDEX IF NOT EXISTS rentauto_accounts_status_idx
  ON rentauto.accounts(status);

CREATE TABLE IF NOT EXISTS rentauto.account_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  role rentauto.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auth_user_id, role)
);

CREATE INDEX IF NOT EXISTS rentauto_account_roles_user_idx
  ON rentauto.account_roles(auth_user_id);

CREATE TABLE IF NOT EXISTS rentauto.identity_link_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  master_identity_id uuid
    REFERENCES public.master_identities(id) ON DELETE SET NULL,
  legacy_user_id text,
  event_type text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('linked','pending','conflict','failed')),
  detail_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rentauto_identity_link_events_user_idx
  ON rentauto.identity_link_events(auth_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rentauto_identity_link_events_master_idx
  ON rentauto.identity_link_events(master_identity_id, created_at DESC);

CREATE OR REPLACE FUNCTION rentauto.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = rentauto, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rentauto_accounts_set_updated_at
  ON rentauto.accounts;

CREATE TRIGGER rentauto_accounts_set_updated_at
BEFORE UPDATE ON rentauto.accounts
FOR EACH ROW
EXECUTE FUNCTION rentauto.set_updated_at();

CREATE OR REPLACE FUNCTION rentauto.has_role(
  p_role rentauto.app_role,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rentauto, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM rentauto.account_roles r
    WHERE r.auth_user_id = p_user_id
      AND r.role = p_role
  );
$$;

REVOKE ALL ON FUNCTION rentauto.has_role(rentauto.app_role, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION rentauto.has_role(rentauto.app_role, uuid)
  TO authenticated, service_role;

ALTER TABLE rentauto.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.account_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rentauto.identity_link_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rentauto_accounts_self_select
  ON rentauto.accounts;
CREATE POLICY rentauto_accounts_self_select
ON rentauto.accounts
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_accounts_admin_select
  ON rentauto.accounts;
CREATE POLICY rentauto_accounts_admin_select
ON rentauto.accounts
FOR SELECT
TO authenticated
USING (rentauto.has_role('admin'::rentauto.app_role));

DROP POLICY IF EXISTS rentauto_roles_self_select
  ON rentauto.account_roles;
CREATE POLICY rentauto_roles_self_select
ON rentauto.account_roles
FOR SELECT
TO authenticated
USING (auth_user_id = auth.uid());

DROP POLICY IF EXISTS rentauto_roles_admin_select
  ON rentauto.account_roles;
CREATE POLICY rentauto_roles_admin_select
ON rentauto.account_roles
FOR SELECT
TO authenticated
USING (rentauto.has_role('admin'::rentauto.app_role));

DROP POLICY IF EXISTS rentauto_identity_events_admin_select
  ON rentauto.identity_link_events;
CREATE POLICY rentauto_identity_events_admin_select
ON rentauto.identity_link_events
FOR SELECT
TO authenticated
USING (rentauto.has_role('admin'::rentauto.app_role));

GRANT USAGE ON SCHEMA rentauto TO authenticated, service_role;

GRANT SELECT ON rentauto.accounts TO authenticated;
GRANT SELECT ON rentauto.account_roles TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON rentauto.accounts FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON rentauto.account_roles FROM anon, authenticated;
REVOKE ALL ON rentauto.identity_link_events FROM anon, authenticated;

GRANT ALL ON rentauto.accounts TO service_role;
GRANT ALL ON rentauto.account_roles TO service_role;
GRANT ALL ON rentauto.identity_link_events TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rentauto TO service_role;

COMMENT ON TABLE rentauto.accounts IS
  'Rentauto application account keyed by the shared TAKATAK Supabase auth user.';
COMMENT ON TABLE rentauto.account_roles IS
  'Rentauto-only roles. These never imply permissions in other TAKATAK services.';
COMMENT ON TABLE rentauto.identity_link_events IS
  'Audit trail for legacy Rentauto identity to shared TAKATAK identity linkage.';
