-- TAKATAK public-schema RLS + Data API lockdown + Advisor FK indexes.
--
-- Application table access is Prisma via DATABASE_URL (table owner / BYPASSRLS).
-- The Supabase JS clients in this repo are Auth-only. These policies are the
-- secondary control for PostgREST/Data API if the anon key is used with a JWT.
--
-- Design rules:
--   * Enable RLS on every public table (including _prisma_migrations).
--   * Do NOT FORCE RLS — Prisma must keep working.
--   * Authorization uses auth.uid() + profiles + active client_memberships.
--     Never user_metadata.
--   * Every SELECT policy has an ownership or membership predicate.
--   * No INSERT/UPDATE/DELETE policies for anon/authenticated. Writes stay on
--     the Prisma path. If a write policy is added later it MUST have both
--     USING and WITH CHECK.
--   * Secrets, webhooks, OAuth state, credentials, OTP hashes, invitation
--     tokens, provider object IDs, and operational logs have RLS enabled,
--     zero policies, and zero grants to anon/authenticated (Prisma only).
--   * Never GRANT SELECT ON TABLE for a relation that stores secrets.
--     PostgreSQL: table-level SELECT includes every column; REVOKE SELECT (col)
--     after a table GRANT has no effect.

-- ── 1. Replace any previously applied foundation policies/functions ─────────
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      rec.policyname,
      rec.schemaname,
      rec.tablename
    );
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.has_client_access(uuid);
DROP FUNCTION IF EXISTS public.has_any_workspace_membership();
DROP FUNCTION IF EXISTS public.is_current_profile(uuid);
DROP FUNCTION IF EXISTS public.is_platform_admin();
DROP FUNCTION IF EXISTS public.current_profile_id();
DROP FUNCTION IF EXISTS public.current_jwt_email();

-- ── 2. SECURITY DEFINER helpers in non-exposed schema `private` ─────────────
-- PostgREST Data API exposes `public` (and optionally graphql_public) only.
-- Do not add `private` to Extra Exposed Schemas. Helpers live here so they
-- are not /rpc endpoints. search_path is pg_catalog only. User objects are
-- schema-qualified. Identity is always auth.uid(). Boolean return only.

CREATE SCHEMA IF NOT EXISTS private;

DROP FUNCTION IF EXISTS private.has_client_access(uuid);
DROP FUNCTION IF EXISTS private.has_any_workspace_membership();
DROP FUNCTION IF EXISTS private.is_current_profile(uuid);

COMMENT ON SCHEMA private IS
  'Non-exposed RLS helpers. Do not add to PostgREST Extra Exposed Schemas.';

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA private FROM PUBLIC;

DO $$
DECLARE
  exposed text;
BEGIN
  BEGIN
    exposed := current_setting('pgrst.db_schemas', true);
  EXCEPTION
    WHEN undefined_object THEN
      exposed := NULL;
  END;
  IF exposed IS NOT NULL AND exposed ~* '(^|[, ])private([, ]|$)' THEN
    RAISE EXCEPTION
      'schema private must not be in pgrst.db_schemas (%). Remove it from Extra Exposed Schemas.',
      exposed;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA private FROM anon;
    REVOKE CREATE ON SCHEMA public FROM anon;
    REVOKE CREATE ON SCHEMA private FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE CREATE ON SCHEMA public FROM authenticated;
    REVOKE CREATE ON SCHEMA private FROM authenticated;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION private.is_current_profile(target_profile pg_catalog.uuid)
RETURNS pg_catalog.boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT
    target_profile IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      WHERE profile.id = target_profile
        AND profile."authUserId" = auth.uid()
        AND profile.status = 'active'::public."ProfileStatus"
    );
$$;

CREATE OR REPLACE FUNCTION private.has_client_access(target_client pg_catalog.uuid)
RETURNS pg_catalog.boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT
    target_client IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_memberships AS membership
      INNER JOIN public.profiles AS profile
        ON profile.id = membership."profileId"
      WHERE membership."clientId" = target_client
        AND membership.status = 'active'::public."MembershipStatus"
        AND profile.status = 'active'::public."ProfileStatus"
        AND profile."authUserId" = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION private.has_any_workspace_membership()
RETURNS pg_catalog.boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.client_memberships AS membership
    INNER JOIN public.profiles AS profile
      ON profile.id = membership."profileId"
    WHERE membership.status = 'active'::public."MembershipStatus"
      AND profile.status = 'active'::public."ProfileStatus"
      AND profile."authUserId" = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION private.is_current_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_client_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.has_any_workspace_membership() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION private.is_current_profile(uuid) FROM anon;
    REVOKE ALL ON FUNCTION private.has_client_access(uuid) FROM anon;
    REVOKE ALL ON FUNCTION private.has_any_workspace_membership() FROM anon;
  END IF;
END $$;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_current_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_client_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_any_workspace_membership() TO authenticated;

-- Leftover public copies would remain PostgREST /rpc endpoints.
DROP FUNCTION IF EXISTS public.has_client_access(uuid);
DROP FUNCTION IF EXISTS public.has_any_workspace_membership();
DROP FUNCTION IF EXISTS public.is_current_profile(uuid);
DROP FUNCTION IF EXISTS public.current_profile_id();

-- ── 3. Enable RLS and revoke Data API writes on every public table ──────────
DO $$
DECLARE
  table_name text;
BEGIN
  FOR table_name IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
      table_name
    );

    EXECUTE format(
      'REVOKE ALL ON TABLE public.%I FROM PUBLIC',
      table_name
    );

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM anon',
        table_name
      );
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format(
        'REVOKE ALL ON TABLE public.%I FROM authenticated',
        table_name
      );
    END IF;
  END LOOP;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL ON TABLES FROM authenticated;
  END IF;
END $$;

-- ── 4. Tenant-scoped SELECT policies (safe-column tables only) ──────────────
-- PostgreSQL: table-level SELECT implies every column. A later
-- REVOKE SELECT (secret_col) does NOT hide that column. Secret-bearing
-- tables therefore get RLS + zero policies + zero grants (Prisma only).
-- Membership helpers are SECURITY DEFINER so policy evaluation can read
-- profiles / client_memberships without granting those tables to authenticated.

CREATE POLICY clients_select_by_membership
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (private.has_client_access(id));

CREATE POLICY memberships_select_own
  ON public.client_memberships
  FOR SELECT
  TO authenticated
  USING (private.is_current_profile("profileId"));

CREATE POLICY notifications_select_own
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (private.is_current_profile("profileId"));

CREATE POLICY social_onboarding_select_own
  ON public.social_onboarding
  FOR SELECT
  TO authenticated
  USING (private.is_current_profile("profileId"));

CREATE POLICY report_templates_select_workspace_members
  ON public.report_templates
  FOR SELECT
  TO authenticated
  USING (private.has_any_workspace_membership());

DO $$
DECLARE
  table_name text;
  tenant_tables text[] := ARRAY[
    'business_brands',
    'business_locations',
    'service_instances',
    'reports',
    'campaigns',
    'social_posts',
    'social_accounts',
    'social_brand_account_assignments',
    'social_competitor_snapshots',
    'social_analytics_daily',
    'social_ad_accounts',
    'social_ad_analytics_daily',
    'domain_assets',
    'hosting_services',
    'provisioning_steps',
    'brand_voices',
    'ai_content_jobs',
    'saved_ai_outputs',
    'report_schedules',
    'report_shares',
    'local_listings',
    'listing_citations',
    'listing_reviews',
    'listing_photos',
    'local_visibility_snapshots',
    'lead_sources',
    'lead_campaigns',
    'leads',
    'lead_pipeline_stages',
    'lead_activities',
    'workspace_custom_roles',
    'workspace_role_permission_overrides',
    'approvals',
    'client_subscriptions'
  ];
BEGIN
  FOREACH table_name IN ARRAY tenant_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
         private.has_client_access(%I)
       )',
      table_name || '_select_by_membership',
      table_name,
      'clientId'
    );
  END LOOP;
END $$;

CREATE POLICY dns_records_select_by_membership
  ON public.dns_records
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.domain_assets AS domain_asset
      WHERE domain_asset.id = dns_records."domainAssetId"
        AND private.has_client_access(domain_asset."clientId")
    )
  );

CREATE POLICY ssl_certificates_select_by_membership
  ON public.ssl_certificates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.domain_assets AS domain_asset
      WHERE domain_asset.id = ssl_certificates."domainAssetId"
        AND private.has_client_access(domain_asset."clientId")
    )
  );

CREATE POLICY report_sections_select_by_membership
  ON public.report_sections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reports AS report
      WHERE report.id = report_sections."reportId"
        AND private.has_client_access(report."clientId")
    )
  );

CREATE POLICY report_metrics_select_by_membership
  ON public.report_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reports AS report
      WHERE report.id = report_metrics."reportId"
        AND private.has_client_access(report."clientId")
    )
  );

-- ── 5. Table-level SELECT only where every column is Data-API safe ──────────
-- Never GRANT SELECT ON TABLE for a relation that stores secrets. Column
-- REVOKE after table GRANT is a documented no-op (PostgreSQL GRANT/REVOKE).
DO $$
DECLARE
  table_name text;
  selectable text[] := ARRAY[
    'clients',
    'client_memberships',
    'notifications',
    'social_onboarding',
    'report_templates',
    'business_brands',
    'business_locations',
    'service_instances',
    'reports',
    'campaigns',
    'social_posts',
    'social_accounts',
    'social_brand_account_assignments',
    'social_competitor_snapshots',
    'social_analytics_daily',
    'social_ad_accounts',
    'social_ad_analytics_daily',
    'domain_assets',
    'hosting_services',
    'provisioning_steps',
    'brand_voices',
    'ai_content_jobs',
    'saved_ai_outputs',
    'report_schedules',
    'report_shares',
    'local_listings',
    'listing_citations',
    'listing_reviews',
    'listing_photos',
    'local_visibility_snapshots',
    'lead_sources',
    'lead_campaigns',
    'leads',
    'lead_pipeline_stages',
    'lead_activities',
    'workspace_custom_roles',
    'workspace_role_permission_overrides',
    'approvals',
    'client_subscriptions',
    'dns_records',
    'ssl_certificates',
    'report_sections',
    'report_metrics'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'authenticated role is required for TAKATAK RLS grants';
  END IF;

  FOREACH table_name IN ARRAY selectable LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'GRANT SELECT ON TABLE public.%I TO authenticated',
      table_name
    );
  END LOOP;
END $$;

-- Deny-all Data API (RLS on, no policy, no GRANT to anon/authenticated):
--   profiles                  (otpHash, otpExpiresAt, lastOtpRequestedAt, otpAttemptCount)
--   user_invitations          (tokenHash)
--   social_oauth_states       (stateHash, codeVerifierCiphertext/iv/authTag)
--   social_credentials        (encryptedPayload, iv, authTag)
--   social_content_items      (externalObjectId)
--   social_competitor_tracks  (externalPageId)
--   social_provider_connections (metadata / provider subject)
--   social_account_sync_states (internal worker state)
--   jobs, job_logs            (leases, operational logs)
--   stripe_webhook_events
--   integration_accounts, integration_events
--   audit_logs, ai_provider_events
--   _prisma_migrations

-- ── 6. Advisor: covering indexes for unindexed foreign keys ─────────────────
CREATE INDEX IF NOT EXISTS "clients_assignedProfileId_idx"
  ON "clients"("assignedProfileId");

CREATE INDEX IF NOT EXISTS "user_invitations_invitedByProfileId_idx"
  ON "user_invitations"("invitedByProfileId");

CREATE INDEX IF NOT EXISTS "business_locations_businessBrandId_clientId_idx"
  ON "business_locations"("businessBrandId", "clientId");

CREATE INDEX IF NOT EXISTS "integration_events_integrationAccountId_idx"
  ON "integration_events"("integrationAccountId");

CREATE INDEX IF NOT EXISTS "jobs_serviceInstanceId_idx"
  ON "jobs"("serviceInstanceId");

CREATE INDEX IF NOT EXISTS "campaigns_serviceInstanceId_idx"
  ON "campaigns"("serviceInstanceId");

CREATE INDEX IF NOT EXISTS "social_provider_connections_businessBrandId_clientId_idx"
  ON "social_provider_connections"("businessBrandId", "clientId");

CREATE INDEX IF NOT EXISTS "social_brand_account_assignments_businessBrandId_clientId_idx"
  ON "social_brand_account_assignments"("businessBrandId", "clientId");

CREATE INDEX IF NOT EXISTS "social_oauth_states_businessBrandId_clientId_idx"
  ON "social_oauth_states"("businessBrandId", "clientId");

CREATE INDEX IF NOT EXISTS "social_oauth_states_connectionId_clientId_businessBrandId_provider_idx"
  ON "social_oauth_states"("connectionId", "clientId", "businessBrandId", "provider");

CREATE INDEX IF NOT EXISTS "social_content_items_businessBrandId_idx"
  ON "social_content_items"("businessBrandId");

CREATE INDEX IF NOT EXISTS "social_competitor_tracks_businessBrandId_idx"
  ON "social_competitor_tracks"("businessBrandId");

CREATE INDEX IF NOT EXISTS "social_competitor_snapshots_businessBrandId_idx"
  ON "social_competitor_snapshots"("businessBrandId");

CREATE INDEX IF NOT EXISTS "approvals_requestedByProfileId_idx"
  ON "approvals"("requestedByProfileId");

CREATE INDEX IF NOT EXISTS "approvals_reviewedByProfileId_idx"
  ON "approvals"("reviewedByProfileId");

CREATE INDEX IF NOT EXISTS "social_analytics_daily_campaignId_idx"
  ON "social_analytics_daily"("campaignId");

CREATE INDEX IF NOT EXISTS "social_ad_accounts_businessBrandId_clientId_idx"
  ON "social_ad_accounts"("businessBrandId", "clientId");

CREATE INDEX IF NOT EXISTS "social_ad_analytics_daily_businessBrandId_clientId_idx"
  ON "social_ad_analytics_daily"("businessBrandId", "clientId");

CREATE INDEX IF NOT EXISTS "social_ad_analytics_daily_adAccountId_clientId_businessBrandId_idx"
  ON "social_ad_analytics_daily"("adAccountId", "clientId", "businessBrandId");

CREATE INDEX IF NOT EXISTS "ai_content_jobs_brandVoiceId_idx"
  ON "ai_content_jobs"("brandVoiceId");

CREATE INDEX IF NOT EXISTS "saved_ai_outputs_brandVoiceId_idx"
  ON "saved_ai_outputs"("brandVoiceId");

CREATE INDEX IF NOT EXISTS "saved_ai_outputs_aiContentJobId_idx"
  ON "saved_ai_outputs"("aiContentJobId");
