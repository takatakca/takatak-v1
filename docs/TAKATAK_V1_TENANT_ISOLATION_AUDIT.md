# TAKATAK V1 — Tenant Isolation Audit (updated Phase 15A)

**Verdict: ENFORCED at the server query layer (Phase 15A), verified by a
16-check two-tenant test against a real database. Live-Supabase E2E
verification remains a staging prerequisite.**

## What Phase 15A enforced
- **Single access model:** Supabase session → persistent Profile
  (`authUserId` unique) → ClientMembership grants → explicit Prisma scoping.
  `user_metadata` is never used for authorization; `roleForUser` no longer
  defaults to owner (returns null; display-hint only).
- **Profile sync:** `ensureProfileForAuthenticatedUser()` runs in the auth
  callback — least privilege always (viewer/active, zero memberships).
  Owner creation happens ONLY via `npm run bootstrap:owner`
  (idempotent, audited, refuses a second owner, never writes fake auth ids).
- **Access resolution:** pure `computeTenantAccess()` (15-case matrix in
  `qa:access`) + cached per-request `getServerAccessContext()`. Modes:
  foundation_demo (dev only, warned) · platform_admin (owner/admin, global
  and explicitly labeled) · client_scoped (memberships only, active client)
  · selection_required · denied (not_authenticated / profile_missing /
  profile_disabled / membership_missing / client_not_allowed /
  database_unavailable / production_foundation_blocked).
- **Query scoping:** ALL module data layers (dashboard, social, web-hosting,
  ai, reports, local-listings, leads) filter every query through
  `resolveDataScope` + `clientWhere`; relation-scoped for DNS/SSL (via
  domainAsset) and report metrics/preview (via report). Admin data requires
  platform_admin (client-scoped callers get "unavailable"). Configured
  environments NEVER fall back to mock data (foundation-only), and a scoped
  miss returns an honest empty database result (bug found + fixed by the
  isolation test in report preview).
- **Active client:** cookie stores ONLY a client id, set by a validated
  server action, re-validated against memberships EVERY request — tampering
  yields `client_not_allowed` (matrix-tested), never data.

## Verified by tests
- `npm run qa:access` — 15/15 pure access matrix (in CI).
- `npm run qa:tenant-isolation` — real DB, two tenants with records in every
  module: 16/16 including cross-tenant direct-ID probe, admin global view,
  denied/disabled/selection/no-membership zero-data paths.

## RLS posture (documented decision)
Server-side Prisma scoping is the PRIMARY enforcement (Prisma bypasses RLS
by design of its direct connection). RLS 001–007 remain applied as
SECONDARY defense for any Supabase-client access path. Both layers use the
same membership model.

## Remaining before production (staging verification)
1. Live Supabase E2E: real sign-in → profile-sync → bootstrap owner →
   assign memberships → verify two real users cannot see each other.
2. Membership assignment is manual/SQL-side until an admin CRUD flow ships
   (Phase 15B+).
