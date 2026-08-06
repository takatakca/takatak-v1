# TAKATAK User Official Dashboard V1

Modular SaaS platform and control tower for client digital services. AI is one powerful layer inside the system — not the system itself.

**Repo/package:** `takatak-user-official-dashboard-v1`
**Phase status:** Phase 15A complete — Tenant Isolation and Real Membership Enforcement (server-side scoping in every data layer, profile sync, audited owner bootstrap, 15-case access matrix + 16-check two-tenant isolation test all passing). Phases 0–15A ✅. **Production remains gated on staging verification:** live Supabase E2E (sign-in → profile-sync → owner bootstrap → memberships → two-user isolation) — see docs/TAKATAK_V1_PRODUCTION_READINESS.md. Next: staging deployment + live E2E, or Phase 15B — Membership Administration & Persistent CRUD.
**Architecture:** [`docs/TAKATAK_DASHBOARD_V1_ARCHITECTURE.md`](docs/TAKATAK_DASHBOARD_V1_ARCHITECTURE.md) (layer rules) · [`docs/TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md`](docs/TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md) (master screen map + build order)

## Purpose

Unified dashboard for clients, businesses/brands, services, campaigns, reports, and jobs, with operational engines behind adapters: Metricool (social), Upmind (web/domain/hosting), QMAPS (local listings), FLEXS (leads), TryHolo (optional creative AI, feature-flagged), Stripe (billing, later).

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS, ESLint
- `src/` directory, import alias `@/*`
- Planned: Supabase (Auth, Postgres, Storage), Prisma, shadcn/ui, Stripe

## Local setup

```bash
npm install
npm run dev        # http://localhost:3000
```

Health check: `GET /api/health` → `{ "status": "ok", "app": "TAKATAK User Official Dashboard V1" }`

## Environment setup

Copy `.env.example` to `.env.local` and fill in real values. Never commit real secrets — `.env*` is gitignored (only `.env.example` is tracked). All API credentials come from environment variables, server-side only.

## Build commands

```bash
npm run dev        # development server
npm run typecheck  # TypeScript check
npm run lint       # ESLint
npm run build      # production build
```

## Dashboard routes (Phase 1)

Run `npm run dev` and open `http://localhost:3000/dashboard`.

Implemented shell: dark sidebar (16 sections), topbar, responsive layout, and the `/dashboard` overview (KPI cards, service module cards, integration status panel, jobs preview, activity feed, quick actions). All other sections (`/dashboard/clients`, `/dashboard/brands`, `/dashboard/social`, `/dashboard/web-hosting`, `/dashboard/local-listings`, `/dashboard/leads`, `/dashboard/ai-studio`, `/dashboard/reports`, `/dashboard/invoices`, `/dashboard/files`, `/dashboard/notifications`, `/dashboard/support`, `/dashboard/team`, `/dashboard/admin`, `/dashboard/settings`) are honest foundation placeholder pages rendered from `src/lib/dashboard/dashboard-config.ts`.

**Phase 2 structured pages:** `/dashboard/clients`, `/dashboard/brands`, `/dashboard/locations`, `/dashboard/services`, `/dashboard/integrations`, `/dashboard/jobs`, and `/dashboard/activity` now render typed mock foundation data from `src/lib/data/{types.ts, mock-data.ts}` through reusable SaaS components in `src/components/saas/` (DataTable, StatusBadge, ModuleHeader, FoundationNotice, DetailCard, EmptyState, DisabledActionButton, IntegrationStatusRow, ServiceInstanceCard, ActivityTimeline). Every record self-declares `dataOrigin: "mock_foundation"` and every page states what is mock, what becomes live, and what is not connected.

**All dashboard data is mock/foundation data.** Integrations, auth, and the database are NOT connected: Metricool, Upmind, TryHolo, QMAPS, FLEXS, Supabase, and Stripe show honest statuses (Not connected / Planned / Disabled).

## Authentication (Phase 3)

Auth uses Supabase (cookie-based, via `@supabase/ssr`) with a Next.js 16 `src/proxy.ts` route guard.

**Setup:** create a Supabase project, then add to `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Create a user in the Supabase dashboard (Authentication → Users) and sign in at `/login`. No service-role key is used in Phase 3.

**Behavior with credentials configured:** unauthenticated visits to `/dashboard/*` redirect to `/login`; authenticated users are redirected away from `/login`; the sidebar shows the user email, role badge, and sign-out. **Without credentials:** the app never crashes — `/login` shows an "Auth not configured yet" card and the dashboard runs in open foundation mode with a visible warning banner.

**Active:** email/password sign-in, sign-out (`POST /auth/signout`), auth callback (`/auth/callback`), route protection, session display. **Planned but disabled (honestly labeled, not clickable):** Google sign-in, magic link, one-time passcode.

**Roles (foundation mode):** owner, admin, manager, staff, viewer — defined in `src/lib/security/roles.ts` with permission maps and `hasPermission` / `canAccessModule` helpers. A user's role is read from Supabase `user_metadata.takatak_role`; if absent it defaults to **owner** (temporary, documented foundation mode until real memberships + RLS arrive in Phase 4). Navigation is permission-aware: modules a role cannot access render locked.

## Database (Phase 4)

Prisma 6 + PostgreSQL (Supabase-ready with pooled `DATABASE_URL` + `DIRECT_URL`). 12 core models: Profile, Client, ClientMembership, BusinessBrand, ServiceInstance, IntegrationAccount, IntegrationEvent, Job, JobLog, Report, Notification, AuditLog.

**Setup:** add to `.env.local` (never committed):

```
DATABASE_URL=your-supabase-pooled-connection-string
DIRECT_URL=your-supabase-direct-connection-string
```

Then run:

```bash
npm run db:generate   # generate Prisma client (works without DB)
npm run db:migrate    # apply migrations (dev)
npm run db:seed       # foundation seed — nothing marked connected
npm run db:studio     # inspect data
```

After migrating, apply `supabase/sql/001_core_rls_policies.sql` in the Supabase SQL editor (review it first — it is a foundation, not a production audit).

**Fallback behavior:** without `DATABASE_URL` the app builds, runs, performs zero queries, and the dashboard shows clearly-labeled mock foundation data. With it configured, `/dashboard` shows a "Database connected" badge and live counts — only when real queries succeed. If a query fails, the dashboard logs a safe message and falls back to mock data. `/api/health` reports `database.configured` without querying.

**Integration providers remain not connected.** The seed creates integration accounts with honest statuses only (`not_connected` / `disabled`).

## Social Media Module (Phase 5)

Internal social structure — **Metricool is still NOT connected** (that's Phase 6). Routes: `/dashboard/social` (overview: KPIs, account status, campaigns, post pipeline, approvals, Metricool prep panel, quick actions) plus `/accounts`, `/calendar`, `/campaigns`, `/posts`, `/approvals`, `/analytics` (honest empty state until real sync), and `/reports`.

Models: SocialAccount, Campaign, SocialPost, Approval, SocialAnalyticsDaily — migration `phase5_social_foundation` is committed; run `npm run db:migrate && npm run db:seed` after Phase 4 setup. Seed adds 6 accounts (none connected), 2 campaigns, 4 posts (draft/pending/approved — never published), 1 pending approval, 0 analytics; it is idempotent per section. Post status machine: draft → pending_approval → approved → scheduled → published/failed (displayed only — no real scheduling or publishing exists yet). Apply `supabase/sql/002_social_media_rls_policies.sql` after migrating.

## Metricool Integration (Phase 6)

Adapter lives in `src/lib/integrations/metricool` — **no real publishing or analytics sync exists yet**, and endpoints are never guessed.

Env vars: `METRICOOL_API_KEY` + `METRICOOL_ACCOUNT_ID` (required for "configured"), plus `METRICOOL_API_BASE_URL` and `METRICOOL_TEST_ENDPOINT` which **stay empty until confirmed from official Metricool documentation** — without them no live request is ever attempted. `METRICOOL_WHITE_LABEL_BASE_URL` is optional.

Connection states: `not_configured` (required vars missing) → `configured_untested` (vars present, no confirmed live test succeeded) → `connected` (**only after a real documented API call succeeds**) / `error` (real test attempted, failed safely) / `disabled`. API: `GET /api/integrations/metricool/status`, `POST /api/integrations/metricool/test` (secrets never returned or logged; errors redacted). Admin UI: `/dashboard/admin/integrations` and `/dashboard/admin/integrations/metricool` (credential presence checklist, test-connection panel, capability roadmap, planned jobs).

## Web / Domain / Hosting Module (Phase 7)

Internal web infrastructure tracking — **Upmind is still NOT connected** (that's Phase 8; no Upmind API routes exist). Routes: `/dashboard/web-hosting` (overview: KPIs, domain portfolio, hosting services, DNS/SSL health, provisioning timeline, Upmind prep panel, quick actions) plus `/domains`, `/hosting`, `/dns`, `/ssl`, and `/provisioning`.

Models: DomainAsset, HostingService, DnsRecord, SslCertificate, ProvisioningStep — migration `phase7_web_hosting_foundation` is committed; run `npm run db:migrate && npm run db:seed`. Seed adds 2 clearly-demo domains (`.demo` TLD, registrar `internal_demo`), 2 hosting services (pending_setup/planned), 2 `internal_demo` DNS placeholder records, 2 SSL tracking rows, and 16 provisioning steps (only `order_received` is `completed_internal`); idempotent per section. Statuses `active_internal` / `completed_internal` / `internal_demo` are internal foundation states and never imply real provider activity. Apply `supabase/sql/003_web_hosting_rls_policies.sql` after migrating.

## Upmind Integration (Phase 8)

Adapter lives in `src/lib/integrations/upmind` and mirrors the Metricool pattern — **no real domain registration, DNS editing, SSL installation, invoice sync, product sync, or hosting provisioning exists yet**, and endpoints are never guessed.

Env vars: `UPMIND_API_KEY` + `UPMIND_API_BASE_URL` (required for "configured"), `UPMIND_TEST_ENDPOINT` (**stays empty until confirmed from official Upmind documentation** — without it no live request is ever attempted), `UPMIND_WEBHOOK_SECRET`, and `UPMIND_WEBHOOK_ENABLED=false` by default.

Connection states: `not_configured` → `configured_untested` → `connected` (**only after a real documented API call succeeds**) / `error` / `disabled`. API: `GET /api/integrations/upmind/status`, `POST /api/integrations/upmind/test`, and `POST /api/integrations/upmind/webhook` — a skeleton that **never trusts events**: disabled by default; even when enabled with a secret present it records events as `ignored` (never processed) because the official signature verification rules must be confirmed first. Admin UI: `/dashboard/admin/integrations/upmind` (credential checklist, test panel, webhook readiness, capability roadmap, planned jobs).

## AI Studio (Phase 9)

Internal AI workspace foundation — **no AI provider is connected, no generation runs, and nothing is claimed as AI-generated**. Routes: `/dashboard/ai-studio` (overview: KPIs, tools grid, provider readiness, planned jobs, voices, recent outputs) plus `/content-generator`, `/campaign-builder`, `/video-ideas` (disabled planned forms — no AI calls happen), `/brand-voice`, `/saved`, and `/provider-status`.

Models: BrandVoice, AiContentJob, SavedAiOutput, AiProviderEvent — migration `phase9_ai_studio_foundation` is committed; run `npm run db:migrate && npm run db:seed`. Seed adds 2 brand voices, 3 saved outputs with origin **`foundation_template` (hand-written templates, explicitly labeled "not AI generated")**, 2 planned AI jobs, and 0 provider events; idempotent per section. The `ai_generated` origin is reserved and unused until a real provider call succeeds. Apply `supabase/sql/004_ai_studio_rls_policies.sql` after migrating.

Provider readiness (`src/lib/ai/providers.ts`, presence-only, zero calls): OpenAI → `configured_untested` when `OPENAI_API_KEY` exists, else `not_configured`; TryHolo → **`disabled` unless `TRYHOLO_ENABLED=true`**, then `not_configured`/`configured_untested` by key presence. `connected` is reserved for future real tested providers. Health route reports both. Nothing is sent to Metricool from AI Studio.

## Reporting Engine (Phase 10)

Internal reporting foundation — **PDF export, email delivery, public share links, scheduled workers, provider analytics sync, and AI summaries are all NOT active**. Routes: `/dashboard/reports` (overview: KPIs, templates, drafts, metrics snapshot, schedules, boundary warning) plus `/builder` (visual only — disabled selectors and Generate button), `/templates`, `/schedules` (records only, no worker), `/preview` (internal preview badge, no public link), and `/metrics`.

Models: ReportTemplate, ReportSection, ReportMetric, ReportSchedule, ReportShare (around the existing Phase 4 Report model — not duplicated) — migration `phase10_reporting_foundation` is committed; run `npm run db:migrate && npm run db:seed`. Seed adds 3 active templates, 2 draft reports with 11 internal-preview sections (every summary prefixed "not AI-generated"), 11 honest metrics including `ai_generated_outputs = 0`, `report_export_enabled = No`, `report_delivery_enabled = No`, 1 planned schedule with a "no background worker active" note, and **0 shares**; idempotent per section. Status labels render internal-only states explicitly: `active_internal` → "Active (internal only)", `shared_internal` → "Shared (internal only)". Apply `supabase/sql/005_reporting_rls_policies.sql` after migrating (reports may contain private client business information).

## Local Listings Module (Phase 11)

Internal local visibility tracking — **QMAPS and Google Business are NOT connected**; no citation scans, review imports, listing publishing, photo sync, or provider visibility scores exist. Routes: `/dashboard/local-listings` (overview: KPIs, listing status, citation health, review monitoring, visibility snapshots, QMAPS prep panel, quick actions) plus `/listings`, `/reviews`, `/citations`, `/photos`, and `/visibility`.

Models: LocalListing, ListingCitation, ListingReview, ListingPhoto, LocalVisibilitySnapshot — migration `phase11_local_listings_foundation` is committed; run `npm run db:migrate && npm run db:seed`. Seed adds 2 listings (provider `internal_demo`), 4 citations (null URLs), 2 reviews explicitly prefixed "[Internal demo review — not imported from Google or QMAPS]", 2 photo placeholders (null imageUrl), and 2 `internal_foundation` visibility snapshots with **score null** and honest notes; idempotent per section. Internal states render explicitly: "Active (internal only)", "Found (internal only)", "Consistent (internal only)", "Replied (internal only)". Reviews/listings may contain private business reputation data — apply `supabase/sql/006_local_listings_rls_policies.sql` after migrating.

## Leads Module (Phase 12)

Internal lead tracking — **FLEXS is NOT connected**; no lead capture widgets, imports, CRM sync, email/SMS outreach, ad spend, or automation workers exist. Routes: `/dashboard/leads` (overview: KPIs, pipeline snapshot, inbox preview, campaigns, activities, FLEXS prep panel, quick actions) plus `/inbox`, `/pipeline` (display-only board, every stage column labeled internal only), `/sources`, `/campaigns`, and `/activities`.

Models: LeadSource, LeadCampaign, Lead, LeadPipelineStage, LeadActivity — migration `phase12_leads_foundation` is committed; run `npm run db:migrate && npm run db:seed`. Seed adds 4 sources (the FLEXS source is **planned only**), 2 campaigns with **null budgets**, 5 demo leads (…@example.test emails, "[Internal demo lead …]" prefixes, zero external IDs), 14 pipeline stages, and 5 activities (notes/reminders only — the system sends nothing); idempotent per section. Every stateful status renders with an explicit internal label: "New (internal only)", "Contacted (internal only)", "Qualified (internal only)", "Won (internal only)", "Completed (internal only)", "Active (internal only)". Leads contain private prospect data — apply `supabase/sql/007_leads_rls_policies.sql` after migrating.

## Admin Control Tower (Phase 13)

View-only operations center — **no write actions exist**: no job execution/retry, role changes, invitations, client disabling, webhook replay, provider repair, or notification sending. Routes: `/dashboard/admin` (overview: access banner, 7 KPIs, operation cards, jobs/audit/events snapshots) plus `/clients`, `/users`, `/services`, `/jobs`, `/integration-events`, `/audit-logs`, `/notifications`, `/system-health` (env presence only — no live provider calls), and `/settings` (readiness checklists, no writes). Existing `/dashboard/admin/integrations{,/metricool,/upmind}` unchanged. `/dashboard/leads/contacts` now permanently redirects to `/dashboard/leads/inbox`.

**No new Prisma models or migration** — Phase 13 surfaces existing models (Client, ClientMembership, Profile, ServiceInstance, Job, JobLog, IntegrationEvent, AuditLog, Notification). Deep role enforcement via `requireAdminAccess()` (`src/lib/security/guard.ts`): with auth configured, only roles granting `view_admin` (owner/admin) can load admin pages — others redirect to `/dashboard`, signed-out users to `/login`; without auth configured, pages render in foundation mode with a visible warning banner. Sensitive data stays server-side: audit metadata renders only an explicit note string — raw JSON, webhook payloads, IPs, and user agents are never displayed. Seed adds 3 system-internal audit entries, 2 job logs ("never run"), and 1 notification; idempotent. Users and integration-events pages show honest empty states (no fake users, no fake events).

## QA / Security / Production Readiness (Phase 14)

Hardening, not features. Production runtime without auth env now renders a safe "Setup required" screen instead of exposing the dashboard (explicit `TAKATAK_FOUNDATION_MODE_ENABLED=true` override exists for demos only and is documented as unsafe). Foundation seed is production-guarded behind `ALLOW_FOUNDATION_SEED`. `/api/health` is minimal (`{status, app}`) unless `HEALTH_DETAILS_ENABLED=true` or a non-production runtime. Provider test/status APIs are admin-only (401/403, 503 when blocked). The Upmind webhook is size-bounded (413) and content-type checked (415), never logs bodies, and stays `trusted:false`. Auth callback redirects pass `sanitizeNextPath` (open-redirect fix). Security headers (nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, COOP) apply globally; strict CSP is deferred with a documented plan. Dashboard/login/admin are noindex; `robots.ts` keeps only the landing page indexable. Error/not-found/loading surfaces never expose stacks or secrets.

QA tooling: `npm run qa`, `qa:secrets` (masked scan over tracked files), `qa:readiness` (booleans + blockers, never values), `qa:routes` (discovers routes from src/app). CI: `.github/workflows/ci.yml`. **Tenant isolation is NOT yet enforced** — all module data layers query globally and Prisma bypasses RLS; this is the documented production blocker (`docs/TAKATAK_V1_TENANT_ISOLATION_AUDIT.md`) with the `resolveTenantAccess()` foundation ready for Phase 15 wiring. Full ops docs: readiness, deployment (Vercel+Supabase), environment matrix, rollback, security checklist, production cut-over.

## Tenant Isolation & Membership Enforcement (Phase 15A)

Authorization now flows exclusively through **Supabase session → persistent Profile (`authUserId`) → ClientMembership → explicit Prisma scoping**; `user_metadata` is never trusted and the old owner-default is gone (unresolved users are denied, never owner). The auth callback syncs a least-privileged Profile (viewer, active, zero memberships); the first owner is created only by the audited, idempotent `npm run bootstrap:owner` (refuses second owners, never fabricates auth ids). Every module data layer (dashboard, social, web-hosting, AI, reports, local listings, leads) filters queries via `resolveDataScope`/`clientWhere` (relation-scoped for DNS/SSL and report metrics/preview); admin data requires an owner/admin Profile; configured environments never serve mock data; denied states render safe screens (no client access assigned · account disabled · setup required), multi-membership users pick a client at `/dashboard/select-client` (cookie stores only the id and is re-validated against memberships on every request — tampering yields denial), and owner/admin module views are explicitly labeled "Global platform view".

Verification: `npm run qa:access` (15/15 pure access matrix, runs in CI) and `npm run qa:tenant-isolation` (real database, two tenants with rows in every module: 16/16 checks including the cross-tenant direct-ID probe — which caught and fixed a mock-fallthrough bug in report preview). RLS 001–007 stay applied as secondary defense; server-side scoping is primary (documented in docs/TAKATAK_V1_TENANT_ISOLATION_AUDIT.md).

## What NOT to build yet (current boundary)

- No real integrations connected: Metricool and Upmind have adapter foundations but are NOT connected until a real credentialed test succeeds; TryHolo, QMAPS, FLEXS remain placeholders
- No fake API calls, no fake secrets, no demo credentials
- No integration may be shown as "Connected" until real credentials and a real successful API call exist

## Development rules

Pages display the system; logic lives in `src/lib` modules (`integrations`, `ai`, `jobs`, `security`, `billing`, `reports`). All providers go through adapters. All important actions become trackable jobs. All mock data is clearly labeled as mock. Build phase by phase — see the MVP build order in the architecture doc.
