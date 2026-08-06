# Database Access Layer (Phase 4)

Pattern: all database access flows through this folder. Pages and components
never import `@prisma/client` directly — they call functions here.

Safe fallback behavior:
- `isDatabaseConfigured()` checks for `DATABASE_URL` (and reports `DIRECT_URL`).
- `getPrisma()` returns `null` when unconfigured; PrismaClient is never
  instantiated without env vars, so nothing can crash at import time.
- `getDashboardOverviewData()` attempts real queries only when configured.
  On missing config OR any query failure it returns the Phase 2 mock
  foundation data with `source: "mock"` and an honest label. Query errors are
  logged (message only, no secrets) and never crash the dashboard.

No-query guarantee: when env vars are missing, no code path issues a query —
`getPrisma()` short-circuits to `null` before any client exists.

Migrations: `npm run db:migrate` (dev) / `npm run db:deploy` (CI/prod).
Seed: `npm run db:seed` — foundation data only, nothing marked connected.
RLS: see `supabase/sql/001_core_rls_policies.sql` (review before production).
