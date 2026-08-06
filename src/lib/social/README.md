# Social Module Data Layer (Phase 5)

Pattern: all social data flows through `social-data.ts`. Pages never import
Prisma directly. Every function returns `{ source, sourceLabel, ... }`:

- database configured + queries succeed → `source: "database"`
- database missing OR any query fails → `source: "mock"` (typed foundation
  data defined in `social-data.ts`), logged safely in development, no crash.

Status machine (`status.ts`): draft → pending_approval → approved →
scheduled → published/failed; failed → draft; pending_approval → draft.
Phase 5 DISPLAYS the machine; it performs no scheduling/publishing.

Metricool boundary: nothing in this folder calls Metricool. Connect flows,
publishing, and analytics sync arrive with the Phase 6 adapter in
`src/lib/integrations/metricool`. Social accounts render honest statuses
(`not_connected`, `pending_connection`, `disabled`) until then. Analytics
shows an empty state — no data is seeded, and nothing is ever labeled
Metricool data before a real sync exists.
