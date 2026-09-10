-- SUPERSEDED. Do not apply this file.
-- Canonical RLS is prisma/migrations/20260909170000_public_rls_and_fk_indexes.
-- ============================================================================
-- TAKATAK User Official Dashboard V1 — Phase 7 Web/Hosting RLS Foundation
-- ============================================================================
-- ⚠️ REVIEW BEFORE PRODUCTION. Apply AFTER 001 + 002 and after the Phase 7
-- Prisma migration. Reuses helper functions from 001. This file only ADDS
-- policies for the new web/hosting tables — existing RLS is untouched.
-- ============================================================================

alter table public.domain_assets      enable row level security;
alter table public.hosting_services   enable row level security;
alter table public.dns_records        enable row level security;
alter table public.ssl_certificates   enable row level security;
alter table public.provisioning_steps enable row level security;

-- Membership-based read policies (client-scoped tables)
create policy "domain_assets_select_by_membership" on public.domain_assets
  for select to authenticated using (public.has_client_access("clientId"));

create policy "hosting_services_select_by_membership" on public.hosting_services
  for select to authenticated using (public.has_client_access("clientId"));

create policy "provisioning_steps_select_by_membership" on public.provisioning_steps
  for select to authenticated using (public.has_client_access("clientId"));

-- Child tables reached through the parent domain
create policy "dns_records_select_by_membership" on public.dns_records
  for select to authenticated using (
    exists (
      select 1 from public.domain_assets d
      where d.id = dns_records."domainAssetId" and public.has_client_access(d."clientId")
    )
  );

create policy "ssl_certificates_select_by_membership" on public.ssl_certificates
  for select to authenticated using (
    exists (
      select 1 from public.domain_assets d
      where d.id = ssl_certificates."domainAssetId" and public.has_client_access(d."clientId")
    )
  );

-- Writes: NONE for authenticated users in Phase 7. All writes flow through
-- the app's server-side Prisma connection. No allow-all policies exist.
