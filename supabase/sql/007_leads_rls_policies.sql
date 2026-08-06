-- ============================================================================
-- TAKATAK User Official Dashboard V1 — Phase 12 Leads RLS Foundation
-- ============================================================================
-- ⚠️ REVIEW BEFORE PRODUCTION. Apply AFTER 001–006 and after the Phase 12
-- Prisma migration. Reuses helper functions from 001. This file only ADDS
-- policies for the new lead tables — existing RLS is untouched.
-- NOTE: leads contain private customer/prospect information (names, emails,
-- phones, messages); keep access strictly membership-scoped and review
-- carefully before production.
-- ============================================================================

alter table public.lead_sources         enable row level security;
alter table public.lead_campaigns       enable row level security;
alter table public.leads                enable row level security;
alter table public.lead_pipeline_stages enable row level security;
alter table public.lead_activities      enable row level security;

-- Membership-based read policies (all tables are client-scoped)
create policy "lead_sources_select_by_membership" on public.lead_sources
  for select to authenticated using (public.has_client_access("clientId"));

create policy "lead_campaigns_select_by_membership" on public.lead_campaigns
  for select to authenticated using (public.has_client_access("clientId"));

create policy "leads_select_by_membership" on public.leads
  for select to authenticated using (public.has_client_access("clientId"));

create policy "lead_pipeline_stages_select_by_membership" on public.lead_pipeline_stages
  for select to authenticated using (public.has_client_access("clientId"));

create policy "lead_activities_select_by_membership" on public.lead_activities
  for select to authenticated using (public.has_client_access("clientId"));

-- Writes: NONE for authenticated users in Phase 12. All writes flow through
-- the app's server-side Prisma connection. No allow-all policies exist.
