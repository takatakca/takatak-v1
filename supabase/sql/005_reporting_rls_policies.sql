-- ============================================================================
-- TAKATAK User Official Dashboard V1 — Phase 10 Reporting RLS Foundation
-- (Corrected during Phases 10–12 checkpoint audit: aligned to the final
--  Phase 10 schema — report_templates has NO clientId column, and the
--  report_metrics / report_schedules / report_shares tables are now covered.)
-- ============================================================================
-- ⚠️ REVIEW BEFORE PRODUCTION. Apply AFTER 001–004 and after the Phase 10
-- Prisma migration. Reuses helper functions from 001. This file only ADDS
-- policies for the reporting tables — existing RLS is untouched.
-- NOTE: reports may contain private client business information; keep access
-- membership-scoped and review carefully before production.
-- ============================================================================

alter table public.report_templates enable row level security;
alter table public.report_sections  enable row level security;
alter table public.report_metrics   enable row level security;
alter table public.report_schedules enable row level security;
alter table public.report_shares    enable row level security;

-- Templates are global (no clientId column): readable by any authenticated
-- user. Template WRITES remain server-side only.
create policy "report_templates_select_authenticated" on public.report_templates
  for select to authenticated using (true);

-- Sections reached through the parent report (client-scoped).
create policy "report_sections_select_by_membership" on public.report_sections
  for select to authenticated using (
    exists (
      select 1 from public.reports r
      where r.id = report_sections."reportId" and public.has_client_access(r."clientId")
    )
  );

-- Metrics reached through the parent report (client-scoped).
create policy "report_metrics_select_by_membership" on public.report_metrics
  for select to authenticated using (
    exists (
      select 1 from public.reports r
      where r.id = report_metrics."reportId" and public.has_client_access(r."clientId")
    )
  );

-- Schedules and shares are client-scoped directly.
create policy "report_schedules_select_by_membership" on public.report_schedules
  for select to authenticated using (public.has_client_access("clientId"));

create policy "report_shares_select_by_membership" on public.report_shares
  for select to authenticated using (public.has_client_access("clientId"));

-- Writes: NONE for authenticated users in Phase 10. All writes flow through
-- the app's server-side Prisma connection. The single using(true) above is a
-- deliberate READ policy for global templates only — no allow-all writes exist.
