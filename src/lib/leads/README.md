# Leads Data Layer (Phase 12)

Pattern: all leads data flows through `leads-data.ts`; pages never import
Prisma directly. Every function returns `{ source, sourceLabel, ... }` —
database when configured and queries succeed, otherwise typed mock foundation
data mirroring the seed, with safe error logging and no crashes.

Hard boundaries (Phase 12):
- NO provider calls: FLEXS, CRMs, and email/SMS providers are never touched.
  No lead capture widgets, imports, outreach automation, ad sync, scoring AI,
  or follow-up workers exist.
- Status meanings: every "_internal" status renders with an explicit label —
  "New (internal only)", "Contacted (internal only)", "Qualified (internal
  only)", "Won (internal only)", "Completed (internal only)", "Active
  (internal only)". These are internal foundation tracking states; no lead
  was really contacted, converted, or won through the system.
- Seeded leads use demo-safe emails (…@example.test), carry the prefix
  "[Internal demo lead — …]", and have no external IDs. The FLEXS lead
  source exists with status `planned` only.
- Campaign budgets are null — no real ad spend or ROI is recorded.
- Privacy: leads contain private customer/prospect information; access is
  strictly membership-scoped (supabase/sql/007_leads_rls_policies.sql).

Future phases: the FLEXS adapter (mirroring the Metricool/Upmind ladder),
real capture forms, CRM handoff, follow-up workflow, and conversion
reporting — each behind its own verified activation boundary.
