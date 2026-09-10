-- SUPERSEDED. Do not apply this file.
-- Canonical RLS is prisma/migrations/20260909170000_public_rls_and_fk_indexes.
-- This draft included profiles_update_own, which would let a JWT holder
-- change profiles.role through the Data API. Write policies are deny-by-default.
-- ============================================================================
-- TAKATAK User Official Dashboard V1 — Phase 4 RLS Policy Foundation
-- ============================================================================
-- ⚠️ REVIEW BEFORE PRODUCTION. This file is a foundation, not a final audit.
-- Apply in the Supabase SQL editor (or psql) AFTER running Prisma migrations.
-- Prisma migrations create the tables; this file adds row-level security.
--
-- Concepts:
--   * Admin/owner access: profiles.role IN ('owner','admin') see all tenant data.
--   * Client membership access: users reach a client's data only via a row in
--     client_memberships linking their profile to that client.
--   * The Prisma app connection (Supabase "postgres"/service connection)
--     BYPASSES RLS. RLS protects direct PostgREST/Supabase-client access.
-- ============================================================================

-- ── Helper functions ────────────────────────────────────────────────────────
create or replace function public.current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.profiles where "authUserId" = auth.uid();
$$;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where "authUserId" = auth.uid() and role in ('owner','admin') and status = 'active'
  );
$$;

create or replace function public.has_client_access(target_client uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_platform_admin() or exists (
    select 1 from public.client_memberships m
    where m."clientId" = target_client and m."profileId" = public.current_profile_id()
  );
$$;

-- ── Enable RLS on all core tables ───────────────────────────────────────────
alter table public.profiles             enable row level security;
alter table public.clients              enable row level security;
alter table public.client_memberships   enable row level security;
alter table public.business_brands      enable row level security;
alter table public.service_instances    enable row level security;
alter table public.integration_accounts enable row level security;
alter table public.integration_events   enable row level security;
alter table public.jobs                 enable row level security;
alter table public.job_logs             enable row level security;
alter table public.reports              enable row level security;
alter table public.notifications        enable row level security;
alter table public.audit_logs           enable row level security;

-- ── Policy skeletons (authenticated users) ──────────────────────────────────
-- Profiles: a user can read their own profile; platform admins read all.
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using ("authUserId" = auth.uid() or public.is_platform_admin());

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ("authUserId" = auth.uid())
  with check ("authUserId" = auth.uid());

-- Clients: membership or platform admin.
create policy "clients_select_by_membership" on public.clients
  for select to authenticated
  using (public.has_client_access(id));

-- Memberships: see your own memberships; admins see all.
create policy "memberships_select_own_or_admin" on public.client_memberships
  for select to authenticated
  using ("profileId" = public.current_profile_id() or public.is_platform_admin());

-- Tenant-scoped tables: access via client membership.
create policy "brands_select_by_membership" on public.business_brands
  for select to authenticated using (public.has_client_access("clientId"));

create policy "services_select_by_membership" on public.service_instances
  for select to authenticated using (public.has_client_access("clientId"));

create policy "integration_accounts_select_by_membership" on public.integration_accounts
  for select to authenticated using (public.has_client_access("clientId"));

create policy "integration_events_select_admin_only" on public.integration_events
  for select to authenticated using (public.is_platform_admin());

create policy "jobs_select_by_membership" on public.jobs
  for select to authenticated
  using ("clientId" is null and public.is_platform_admin() or "clientId" is not null and public.has_client_access("clientId"));

create policy "job_logs_select_admin_only" on public.job_logs
  for select to authenticated using (public.is_platform_admin());

create policy "reports_select_by_membership" on public.reports
  for select to authenticated using (public.has_client_access("clientId"));

create policy "notifications_select_own" on public.notifications
  for select to authenticated
  using (
    "profileId" = public.current_profile_id()
    or ("clientId" is not null and public.has_client_access("clientId"))
  );

create policy "audit_logs_select_admin_only" on public.audit_logs
  for select to authenticated using (public.is_platform_admin());

-- ── Writes ──────────────────────────────────────────────────────────────────
-- Phase 4 intentionally defines NO insert/update/delete policies for
-- authenticated users on tenant tables: all writes flow through the app's
-- server-side Prisma connection (which bypasses RLS). Add scoped write
-- policies in later phases if client-side Supabase writes become necessary.

-- ── DEVELOPMENT-ONLY escape hatch (DO NOT RUN IN PRODUCTION) ────────────────
-- If you need quick read access for local experimentation, uncomment below.
-- These are NOT production safe and must never ship:
-- create policy "DEV_ONLY_read_all_clients" on public.clients
--   for select to authenticated using (true);
