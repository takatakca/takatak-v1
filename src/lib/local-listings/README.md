# Local Listings Data Layer (Phase 11)

Pattern: all local listings data flows through `local-listings-data.ts`;
pages never import Prisma directly. Every function returns
`{ source, sourceLabel, ... }` — database when configured and queries
succeed, otherwise typed mock foundation data mirroring the seed, with safe
error logging and no crashes.

Hard boundaries (Phase 11):
- NO provider calls: QMAPS, Google Business, and any other provider API are
  never touched. No citation scans, review imports, listing publishing,
  photo sync, or NAP correction requests exist.
- Status meanings: `active_internal` = "Active (internal only)",
  `found_internal` = "Found (internal only)", `consistent_internal` =
  "Consistent (internal only)", `replied_internal` = "Replied (internal
  only)" — internal foundation records that never imply provider activity.
- Reviews: seeded rows are provider `internal_demo` with bodies prefixed
  "[Internal demo review — not imported from Google or QMAPS]". Reviews and
  listings may contain private business reputation data — access is
  membership-scoped (supabase/sql/006_local_listings_rls_policies.sql).
- Visibility snapshots: source `internal_foundation` with `score: null` —
  counts come from internal records and are never presented as a local SEO
  score from any provider. `future_provider` is reserved.

Future phases: the QMAPS adapter (mirroring the Metricool/Upmind ladder),
Google Business connection, real citation scans, review import + reply
workflow, photo sync, and provider visibility scores — each behind its own
verified activation boundary.
