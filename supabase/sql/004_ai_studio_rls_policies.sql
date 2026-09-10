-- SUPERSEDED. Do not apply this file.
-- Canonical RLS is prisma/migrations/20260909170000_public_rls_and_fk_indexes.
-- ============================================================================
-- TAKATAK User Official Dashboard V1 — Phase 9 AI Studio RLS Foundation
-- ============================================================================
-- ⚠️ REVIEW BEFORE PRODUCTION. Apply AFTER 001–003 and after the Phase 9
-- Prisma migration. Reuses helper functions from 001. This file only ADDS
-- policies for the new AI tables — existing RLS is untouched.
-- ============================================================================

alter table public.brand_voices       enable row level security;
alter table public.ai_content_jobs    enable row level security;
alter table public.saved_ai_outputs   enable row level security;
alter table public.ai_provider_events enable row level security;

-- Membership-based read policies (client-scoped tables)
create policy "brand_voices_select_by_membership" on public.brand_voices
  for select to authenticated using (public.has_client_access("clientId"));

create policy "ai_content_jobs_select_by_membership" on public.ai_content_jobs
  for select to authenticated using (public.has_client_access("clientId"));

create policy "saved_ai_outputs_select_by_membership" on public.saved_ai_outputs
  for select to authenticated using (public.has_client_access("clientId"));

-- Provider events are platform-level observability: admins only.
create policy "ai_provider_events_select_admin_only" on public.ai_provider_events
  for select to authenticated using (public.is_platform_admin());

-- Writes: NONE for authenticated users in Phase 9. All writes flow through
-- the app's server-side Prisma connection. No allow-all policies exist.
