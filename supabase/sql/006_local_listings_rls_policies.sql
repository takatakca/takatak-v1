-- SUPERSEDED. Do not apply this file.
-- Canonical RLS is prisma/migrations/20260909170000_public_rls_and_fk_indexes.
-- ============================================================================
-- TAKATAK User Official Dashboard V1 — Phase 11 Local Listings RLS Foundation
-- ============================================================================
-- ⚠️ REVIEW BEFORE PRODUCTION. Apply AFTER 001–005 and after the Phase 11
-- Prisma migration. Reuses helper functions from 001. This file only ADDS
-- policies for the new local listing tables — existing RLS is untouched.
-- NOTE: listings and reviews may contain private business reputation data;
-- keep access membership-scoped and review carefully before production.
-- ============================================================================

alter table public.local_listings             enable row level security;
alter table public.listing_citations          enable row level security;
alter table public.listing_reviews            enable row level security;
alter table public.listing_photos             enable row level security;
alter table public.local_visibility_snapshots enable row level security;

-- Membership-based read policies (all tables are client-scoped)
create policy "local_listings_select_by_membership" on public.local_listings
  for select to authenticated using (public.has_client_access("clientId"));

create policy "listing_citations_select_by_membership" on public.listing_citations
  for select to authenticated using (public.has_client_access("clientId"));

create policy "listing_reviews_select_by_membership" on public.listing_reviews
  for select to authenticated using (public.has_client_access("clientId"));

create policy "listing_photos_select_by_membership" on public.listing_photos
  for select to authenticated using (public.has_client_access("clientId"));

create policy "local_visibility_snapshots_select_by_membership" on public.local_visibility_snapshots
  for select to authenticated using (public.has_client_access("clientId"));

-- Writes: NONE for authenticated users in Phase 11. All writes flow through
-- the app's server-side Prisma connection. No allow-all policies exist.
