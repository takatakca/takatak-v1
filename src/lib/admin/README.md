# Admin Ops Data Layer (Phase 13)

Pattern: all admin control tower data flows through `admin-data.ts`; pages
never import Prisma directly. Every function returns
`{ source, sourceLabel, ... }` — database when configured and queries
succeed, otherwise typed mock foundation data mirroring the seed.

Role / access foundation:
`src/lib/security/guard.ts` → `requireAdminAccess()` runs server-side on
every admin page (defense beyond the sidebar's nav gating): auth configured
+ role lacks `view_admin` → redirect to /dashboard; auth configured + no
session → redirect to /login; auth NOT configured → foundation mode renders
with a visible warning banner instead of pretending to enforce security.

Hard boundaries (Phase 13 — view only):
- NO write actions: no job execution or retry, no cancellation, no role
  changes, no user invitations, no client disabling, no webhook replay, no
  provider repair, no notification sending. Buttons for these are disabled
  and labeled "coming soon" / "not active".
- NO provider calls anywhere in this layer.
- Sensitive log handling: audit metadata is reduced to an explicit `note`
  string via `safeNote()` — raw JSON, webhook payloads, IP addresses, and
  user agents are never selected into the UI. Job/integration error
  messages are adapter-written safe text only.
- Team data is honestly empty until real auth users exist; integration
  events are honestly empty until a real webhook or credentialed test
  writes one.
