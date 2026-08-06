# TAKATAK User Official Dashboard V1 — Architecture Lock

**Status:** Phase 15A complete — tenant isolation and real membership enforcement (Profile-based authorization, per-request access context, explicit Prisma scoping in every module data layer, validated active-client selection, audited owner bootstrap; 15-case access matrix + 16-check two-tenant isolation test passing). Production gated on staging live-Supabase E2E verification. (Phase 0: architecture lock ✅.) Master screen map: [`TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md`](TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md)
**Repo/package name:** `takatak-user-official-dashboard-v1`
**Last updated:** 2026-07-09

---

## 1. Product Vision

TAKATAK is a unified, modular SaaS platform and control tower for digital services delivered to clients (businesses/brands). It is **not** an "AI dashboard with features added around it" — it is a real SaaS platform where AI is one powerful layer inside a clean architecture.

Guiding decisions:

1. TAKATAK is the unified SaaS dashboard and control tower.
2. **Metricool** is the social media operational engine (scheduling, publishing, analytics, calendar, connected accounts, white-label reporting).
3. **TryHolo** is a creative AI provider (content/video ideas, hooks, captions, ad creatives, creative briefs). The architecture must never depend on TryHolo — it is optional and feature-flagged (`TRYHOLO_ENABLED`).
4. **Upmind** is the Web / Domain / Hosting operational engine (domain search, hosting plans, billing, provisioning, invoices, client portal, product catalogue, support desk, API/webhooks, headless).
5. **QMAPS** is the local listings module.
6. **FLEXS** is the lead generation module.
7. AI supports the software; AI never replaces clean SaaS architecture.
8. Every important action eventually becomes a trackable Job.

## 2. Platform Layers

```
TAKATAK Platform
├── Core SaaS          → users/clients/teams, businesses/brands, roles/permissions,
│                        billing status, subscriptions, service orders, files,
│                        reports, notifications, admin control
├── Business Modules   → Social Media, Web/Domain/Hosting, Local Listings (QMAPS),
│                        Leads (FLEXS), Marketplace Services, Future Services
├── Integration Layer  → Metricool, TryHolo, Upmind, QMAPS, FLEXS,
│                        Facebook/Instagram, Google Business, Stripe,
│                        Email/SMS, Future APIs
├── AI Layer           → Content Generator, Campaign Assistant, Report Generator,
│                        Performance Suggestions, Client AI Guide,
│                        Task Classifier, Creative Brief Generator
└── Automation / Jobs  → Sync Analytics, Publish Posts, Generate Reports,
                         Send Alerts, Follow-up Tasks, Integration Error Handling
```

### 2.1 Core SaaS Layer

The backbone. Owns identity, tenancy, permissions, billing state, and administration. Nothing in a business module or integration may bypass it. Auth and tenancy will be implemented with Supabase Auth (cookie-based, server-verified) in a later phase. Every domain record is scoped to a Client (tenant) and usually a Business/Brand.

### 2.2 Business Modules

Vertical product areas the client sees (Social Media, Web/Hosting, Listings, Leads, Marketplace). Modules consume the Core SaaS layer and speak to external systems **only** through the Integration Layer adapters. A module must keep working (degraded, clearly labeled) if its external provider is down or not yet connected.

### 2.3 Integration Layer

One adapter per provider, in `src/lib/integrations/<provider>/`. Rules:

- Each adapter exposes a typed service interface; the rest of the app never imports provider SDKs or calls provider URLs directly.
- Credentials come exclusively from environment variables, read on the server only.
- An adapter reports one of these connection states: `not_configured`, `configured_untested`, `connected`, `error`. The UI may only show "Connected" when a real credentialed API call has succeeded.
- No fake API calls. Until real credentials exist, adapters return explicit `not_configured` results — never invented data.

### 2.4 AI Layer

Lives in `src/lib/ai/`. AI features (content generation, campaign assistance, report generation, suggestions, client guide, task classification, creative briefs) are services invoked by modules and jobs. AI providers (e.g. OpenAI/Anthropic APIs, TryHolo) are swappable behind interfaces. AI output that mutates business state (e.g. a post draft) always passes through the normal approval workflow.

### 2.5 Automation / Jobs Layer

Lives in `src/lib/jobs/`. Every important action (sync analytics, publish post, generate report, send alert, follow-ups, integration error handling) is a Job record with: type, payload, status (`queued / running / succeeded / failed / retrying / cancelled`), attempts, error log, timestamps, and result data. Jobs give the Admin Control Tower full observability. Execution backend (cron, queue, Supabase functions) is decided in Phase 10; the data model exists earlier.

## 3. Core Data Relationships

```
Client ─ owns → Businesses / Brands
Business/Brand ─ has → Services, Social Accounts, Campaigns, Reports, Files, Billing Status
Campaign ─ has → Posts, AI Jobs, Approvals, Analytics, Reports
Post ─ belongs to Campaign, connects to Social Account
Post.status ∈ { Draft, PendingApproval, Approved, Scheduled, Published, Failed }
Job ─ tracks every important action (status, errors, retries, logs, result data)
```

## 4. Database Model Plan (Prisma + Supabase Postgres — Phase 2+)

Planned models (names indicative, finalized when Prisma is introduced):

| Model | Purpose | Key relations |
|---|---|---|
| `User` | Auth identity (mirrors Supabase auth user) | belongs to Client(s) via membership |
| `Client` | Tenant / paying account | has many Businesses, Memberships |
| `Membership` | User↔Client with role | role: owner / admin / staff / client_viewer |
| `Business` | Brand under a client | has Services, SocialAccounts, Campaigns, Files, Reports |
| `Service` | A purchased/active service instance | typed by module (social, web, listings, leads, marketplace) |
| `ServiceOrder` | Order lifecycle for a service | links Client, Service, billing status |
| `Subscription` | Billing subscription state | Stripe/Upmind reference IDs only |
| `SocialAccount` | Connected social profile | provider ref (via Metricool), Business |
| `Campaign` | Marketing campaign | has Posts, Approvals, Reports |
| `Post` | Content unit with status machine | Campaign, SocialAccount |
| `Approval` | Human sign-off record | Post/Campaign, approver, decision |
| `Report` | Generated report artifact | Business/Campaign, file ref |
| `File` | Stored asset (Supabase Storage ref) | Business, uploader |
| `Notification` | In-app/user notifications | User, read state |
| `Job` | Trackable action | type, status, attempts, error, result JSON |
| `IntegrationConnection` | Per-client provider connection state | provider, status, metadata (no secrets) |
| `AuditLog` | Admin-visible action trail | actor, action, target |

Rules: every tenant-scoped table carries `clientId`; Supabase Row Level Security is enabled when Supabase is introduced; provider secrets are **never** stored in these tables — only opaque references and connection status.

## 5. Folder Structure Rules

```
src/
├── app/                    # Routes only. Pages display the system; no business logic.
│   ├── api/health/         # Health endpoint (exists, Phase 0)
│   └── dashboard/          # Dashboard routes (placeholder, built in Phase 1)
├── components/
│   ├── layout/             # Shell: sidebar, top bar, page frames (Phase 1)
│   ├── dashboard/          # Dashboard-specific composite components (Phase 1)
│   └── ui/                 # Primitive UI components / shadcn-ui home (Phase 1+)
└── lib/
    ├── integrations/       # One adapter folder per provider
    │   ├── metricool/  ├── upmind/  ├── tryholo/  ├── qmaps/  └── flexs/
    ├── ai/                 # AI services
    ├── jobs/               # Job creation, tracking, execution contracts
    ├── security/           # Authz helpers, RLS helpers, input validation
    ├── billing/            # Billing status, subscription logic (Stripe/Upmind facing)
    └── reports/            # Report generation services
```

Hard rules:

1. No business logic inside `src/app` pages/route files beyond calling services.
2. All external providers go through `src/lib/integrations/<provider>` adapters.
3. All credentials come from environment variables, server-side only. `NEXT_PUBLIC_` prefix is reserved for genuinely public values.
4. All mock data is clearly labeled mock (name it `mock*`, tag UI with a "Mock data" indicator).
5. Never claim a provider is "Connected" without a real successful credentialed call.
6. Small, testable changes per phase; do not build ahead of the approved phase.

## 6. Integration Boundaries

| Provider | Owns | TAKATAK's role |
|---|---|---|
| Metricool | Social scheduling, publishing, analytics, calendar, connected accounts, white-label reports | Orchestrates + displays via adapter; stores references |
| Upmind | Domains, hosting, provisioning, invoices, catalogue, support desk | Orchestrates + displays via adapter; webhook consumer |
| TryHolo | Creative generation (optional, flagged) | Optional creative provider behind `TRYHOLO_ENABLED` |
| QMAPS | Local listings | Module data source via adapter |
| FLEXS | Lead generation | Module data source via adapter |
| Stripe | Card billing (later) | Checkout/webhooks via adapter |
| Facebook/Instagram, Google Business | Native platform data where Metricool doesn't cover | Adapter, later phases |
| Email/SMS | Outbound notifications | Adapter, later phases |

## 7. Environment Variable Plan

All variables are declared in `.env.example` with empty placeholder values. Real values live only in local `.env` files (gitignored) and deployment secrets. Server-only secrets must never be exposed with `NEXT_PUBLIC_`.

Groups: App (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`), Database (`DATABASE_URL`, `DIRECT_URL`), Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`), Stripe, Metricool, TryHolo (+ `TRYHOLO_ENABLED=false` by default), Upmind, QMAPS, FLEXS, OpenAI.

## 8. Mocked vs Real API Rules

- Real API calls require real credentials from env vars. No exceptions.
- Absent credentials → adapter returns `not_configured`; UI shows "Not connected" honestly.
- Mock data is allowed **only** for UI development, must be clearly labeled in code and UI, and must never be persisted as if it were real provider data.
- No fabricated "success" responses, no fake webhooks, no demo secrets committed anywhere.

## 9. Security Rules

- Secrets only via environment variables; `.env*` files gitignored (verified in Phase 0).
- All privileged operations execute server-side; the Supabase service role key never reaches the client.
- Role-based access enforced in `src/lib/security` and via Supabase RLS once introduced.
- Webhooks verified with provider signing secrets before processing.
- Input validation at every API boundary (zod planned).
- Audit log for admin and destructive actions.

## 10. MVP Build Order

> **Note:** The authoritative, expanded build order (Phases 0–14) and the complete screen map now live in [`TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md`](TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md). The table below is the original Phase 0 summary.

> **Note:** The authoritative, expanded build order (Phases 0–14) and full screen map now live in [`TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md`](TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md). The table below is the original Phase 0 summary.

| Phase | Scope |
|---|---|
| 0 | Repo scaffold + architecture lock (this document) — **done** |
| 1 | Core SaaS dashboard shell: sidebar, top bar, overview layout, client/business switcher UI, routing, responsive layout |
| 2 | Users / clients / businesses / brands (Supabase Auth + Prisma models + RLS) |
| 3 | Service instances system |
| 4 | Social media module (UI + domain models) |
| 5 | Metricool integration layer (real adapter) |
| 6 | Web / domain / hosting module |
| 7 | Upmind integration layer |
| 8 | AI content studio |
| 9 | TryHolo creative provider layer (optional, flagged) |
| 10 | Workflow / jobs system (execution backend) |
| 11 | Reports engine |
| 12 | Admin control tower |
| 13 | QA, security hardening, permissions review, deployment |

## 11. Development Rules

1. Inspect before editing; never delete working code without cause.
2. Build only the approved phase; stop and report.
3. Keep changes small and testable; run typecheck/lint/build each phase.
4. Logic lives in `src/lib/*` modules; pages display the system.
5. Every important action becomes a trackable Job (from Phase 10 onward, retrofit earlier actions).
6. Placeholders are explicitly labeled as placeholders.
7. Report exactly what changed at the end of each phase.

## 12. QA Checklist (run each phase)

- [ ] `npm install` clean
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] No secrets committed (`git grep` for key patterns; `.env` gitignored)
- [ ] No unlabeled mock data
- [ ] No integration claimed "Connected" without real credentials
- [ ] New logic lives in `src/lib`, not in pages
- [ ] Phase scope respected (nothing built ahead)

## 13. Future Upgrade Path

- shadcn/ui component system in Phase 1+ for the dashboard UI.
- Prisma + Supabase introduced in Phase 2 with migrations from day one.
- Stripe billing after core tenancy is stable.
- Job execution backend (queue/cron) in Phase 10; job data model earlier.
- Additional providers (Facebook/Instagram direct, Google Business, Email/SMS) slot into `src/lib/integrations` with zero changes to module code, thanks to adapter boundaries.
- V2 candidates: multi-workspace agencies, client-facing white-label portal, marketplace checkout, webhook-driven real-time sync.
