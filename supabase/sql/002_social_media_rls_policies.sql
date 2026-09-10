-- SUPERSEDED. Do not apply this file.
-- Canonical RLS is prisma/migrations/20260909170000_public_rls_and_fk_indexes.
-- ============================================================================
-- TAKATAK User Official Dashboard V1 — Phase 5 Social Media RLS Foundation
-- ============================================================================
-- ⚠️ REVIEW BEFORE PRODUCTION. Apply AFTER 001_core_rls_policies.sql and after
-- the Phase 5 Prisma migration. Reuses helper functions from 001
-- (current_profile_id, is_platform_admin, has_client_access).
-- This file only ADDS policies for the new social tables — it does not modify
-- or weaken existing core policies.
-- ============================================================================

-- ── Enable RLS on social tables ─────────────────────────────────────────────
alter table public.social_accounts        enable row level security;
alter table public.campaigns              enable row level security;
alter table public.social_posts           enable row level security;
alter table public.approvals              enable row level security;
alter table public.social_analytics_daily enable row level security;

-- ── Membership-based read policies ──────────────────────────────────────────
create policy "social_accounts_select_by_membership" on public.social_accounts
  for select to authenticated using (public.has_client_access("clientId"));

create policy "campaigns_select_by_membership" on public.campaigns
  for select to authenticated using (public.has_client_access("clientId"));

create policy "social_posts_select_by_membership" on public.social_posts
  for select to authenticated using (public.has_client_access("clientId"));

create policy "approvals_select_by_membership" on public.approvals
  for select to authenticated using (public.has_client_access("clientId"));

create policy "social_analytics_select_by_membership" on public.social_analytics_daily
  for select to authenticated using (public.has_client_access("clientId"));

-- ── Writes ──────────────────────────────────────────────────────────────────
-- Phase 5 defines NO insert/update/delete policies for authenticated users:
-- all writes flow through the app's server-side Prisma connection (bypasses
-- RLS). When client-side approval actions arrive in a later phase, add a
-- narrowly-scoped UPDATE policy on approvals (status/comments only, member of
-- the client, reviewer = current profile) instead of broad write access.

-- ── No allow-all policies ────────────────────────────────────────────────────
-- Intentionally none. If you need temporary local read access for
-- experimentation, model it on the commented DEV_ONLY example in 001 and
-- never apply it to production.
