# TAKATAK User Official Dashboard V1 — Full Screen Architecture (Master File)

**Status:** Master architecture reference — locked before Phase 1.
**Supersedes:** the build order in `TAKATAK_DASHBOARD_V1_ARCHITECTURE.md` §10 (that doc remains valid for layer rules; this file is the authoritative screen map and phase plan).
**Last updated:** 2026-07-09

---

## 1. Product Vision

TAKATAK User Official Dashboard V1 is a modular SaaS control tower where clients manage all TAKATAK services from one place: social media, web/domain/hosting, AI content creation, local listings, lead generation, reports, billing, files, notifications, support, and admin operations.

The platform must not be built as a random AI dashboard. It is a real SaaS system where AI, automation, and integrations are layers inside the platform.

**Core principle:** TAKATAK is the platform. Integrations power modules. AI supports the workflows.

## 2. Main Platform Layers

**Layer 1 — Core SaaS:** user accounts, client accounts, businesses/brands, teams, roles and permissions, subscriptions, billing status, service orders, files, reports, notifications, admin control.

**Layer 2 — Business Modules:** Dashboard overview, Social Media, Web/Domain/Hosting, Local Listings (QMAPS), Leads (FLEXS), AI Studio, Reports, Billing, Files, Support, Admin.

**Layer 3 — Integration Layer:** Metricool (social), Upmind (web/domain/hosting/billing/provisioning), TryHolo (creative AI), OpenAI (internal AI assistant + content generation), QMAPS (local listings), FLEXS (leads), Stripe (payments), Supabase (auth/database/storage), Email/SMS providers later.

**Layer 4 — AI Layer:** content generator, campaign assistant, report generator, performance suggestions, client AI guide, task classifier, creative brief generator, support reply assistant, business setup assistant.

**Layer 5 — Automation / Jobs Layer.** Every important action becomes a trackable job: create campaign, generate content, approve post, send to Metricool, sync analytics, generate report, send client notification, create invoice, provision hosting, sync domain status, retry failed integration task.

## 3. Recommended Tech Stack

**Frontend:** Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui later, React Server Components where possible, responsive dashboard layout.

**Backend:** Next.js route handlers, Supabase Auth, Supabase Postgres, Prisma ORM, Supabase Storage, Stripe billing later, background job system later.

**Integrations:** adapters for Metricool, Upmind, TryHolo, QMAPS, FLEXS, Stripe, Email/SMS.

**Deployment:** Vercel or similar; Supabase for database/auth/storage; environment variables for all secrets; no hardcoded credentials.

## 4. User Roles

| Role | Scope | Key functions |
|---|---|---|
| Super Admin | Full TAKATAK control | Manage all clients, businesses, services, integrations; view logs; retry jobs; manage billing; system health; manage roles |
| Admin | Internal TAKATAK staff | Manage assigned clients, campaigns, reports, files; handle support tickets; view assigned service jobs |
| Manager | Client-side manager | Manage business profile; approve posts; view reports and billing; upload files; request changes |
| Team Member | Limited staff user | View assigned sections; comment on posts; upload files; view reports if permitted |
| Client User | Basic client access | View dashboard; approve content; view reports; pay invoices; open support tickets; download files |

## 5. Global Sidebar Navigation

1. Dashboard
2. Clients
3. Businesses / Brands
4. Social Media
5. Web & Hosting
6. Local Listings
7. Leads
8. AI Studio
9. Reports
10. Invoices
11. Files
12. Notifications
13. Support
14. Team & Permissions
15. Admin
16. Settings

## 6. Complete Screen Map

### 6.1 Public / Entry

**`/`** — Simple product landing/foundation page for V1. Shows "TAKATAK User Official Dashboard V1", links to dashboard, shows system status. Keep simple until a public marketing site is needed.

**`/api/health`** — System health check. Returns app status; confirms the app is online. (Exists since Phase 0.)

## 7. Dashboard Core

### 7.1 `/dashboard` — Dashboard Overview

Main control tower for the client or admin.

Sections:
1. **Header** — TAKATAK Dashboard, client/business switcher, search, create button, notifications, user profile.
2. **KPI Cards** — clients, businesses/brands, active services, pending jobs, reports ready.
3. **Service Modules** — Social Media, Web/Domain/Hosting, Local Listings, Leads, AI Studio.
4. **Integration Status** — Metricool, Upmind, TryHolo, QMAPS, FLEXS, Supabase, Stripe.
5. **Job Preview** — pending, failed, completed, retry status.
6. **Activity Feed** — new service orders, report generated, integration pending, content approval needed.
7. **Quick Actions** — add client, add business, create campaign, generate report, connect integration.

Functions: view service health, view next actions, navigate to modules, see integration readiness, see current work status.

## 8. Clients

### 8.1 `/dashboard/clients`
Manage all client accounts. Features: client list, search, filters (status, plan, assigned admin), add client, import later. Client fields: name, email, phone, company, status, plan, assigned admin, created date, last activity. Functions: create/edit/disable client, assign admin, view client profile, view client services.

### 8.2 `/dashboard/clients/[clientId]`
Full client profile. Sections: overview, contact info, businesses/brands, active services, invoices, reports, files, notes, activity, support tickets. Functions: edit client info, add business, add service, upload files, create internal note, view billing, view reports.

## 9. Businesses / Brands

### 9.1 `/dashboard/brands`
Manage business/brand profiles. Features: brand list, status badges, connected services, category, location, assigned client, add brand. Functions: create/edit brand, assign services, view brand dashboard, connect integrations later.

### 9.2 `/dashboard/brands/[brandId]`
Brand-level control center. Sections: brand profile, services, social accounts, website/domain, local listings, leads, reports, files, billing status. Functions: update brand info, upload logo, set brand voice, manage service modules, view brand reports.

## 10. Social Media Module (engine later: Metricool)

### 10.1 `/dashboard/social`
Overview: connected accounts, upcoming posts, campaigns, approval requests, analytics preview, Metricool status, AI suggestions. Functions: view social status, open calendar, create campaign/post, request approval, view analytics.

### 10.2 `/dashboard/social/accounts`
Manage social accounts. Platforms: Facebook, Instagram, TikTok, Google Business, LinkedIn, X, YouTube later. Functions: view connected accounts, connect/reconnect/remove later, view token status, map account to brand. **V1 status: Not connected until real credentials exist.**

### 10.3 `/dashboard/social/calendar`
Content calendar. Views: month, week, list; filters: platform, brand, status. Post statuses: draft, pending approval, approved, scheduled, published, failed. Functions: view scheduled posts, drag/drop later, open post detail, filter, send approved post to Metricool later.

### 10.4 `/dashboard/social/campaigns`
Campaign management. Features: list, goals, date range, platforms, budget placeholder, content status, performance preview. Functions: create/edit campaign, assign posts, generate AI campaign ideas, view report, archive.

### 10.5 `/dashboard/social/posts`
Manage posts. Features: list, caption, media preview, platform, status, scheduled date, approval status. Functions: create/edit/duplicate post, submit for approval, approve/reject, send to Metricool later.

### 10.6 `/dashboard/social/approvals`
Client approval workflow. Features: pending posts, comments, version history, approval timeline, approve / request changes. Functions: approve, reject, request edits, comment, notify internal team.

### 10.7 `/dashboard/social/analytics`
Social performance. Metrics: reach, impressions, engagement, clicks, followers, top posts, platform breakdown. Functions: view analytics, date/platform filters, sync from Metricool later, generate AI insights.

### 10.8 `/dashboard/social/reports`
Social reports: weekly, monthly, campaign; export PDF later; client share link later. Functions: generate, review, send to client, download.

## 11. Web / Domain / Hosting Module (engine later: Upmind)

### 11.1 `/dashboard/web-hosting`
Overview: active hosting services, domain portfolio, SSL status, DNS status, invoices, support tickets, provisioning timeline. Functions: view services, search domain later, order hosting later, upgrade plan later, view invoice, open ticket.

### 11.2 `/dashboard/web-hosting/domains`
Domain management: list, expiry, auto-renew, DNS status, SSL status, registrar/provider. Functions: search new domain via Upmind later, renew, manage DNS, connect existing domain, view details.

### 11.3 `/dashboard/web-hosting/hosting`
Hosting services: plan list, plan name, domain, status, renewal date, usage, upgrade option. Functions: view service, upgrade, cancel, open details, view provisioning status.

### 11.4 `/dashboard/web-hosting/dns`
DNS management placeholder: records, status, last sync, provider. Functions: view/add/edit/sync later.

### 11.5 `/dashboard/web-hosting/ssl`
SSL monitoring: domain, SSL status, expiry, auto-renew, errors. Functions: view status, request install, renew later.

### 11.6 `/dashboard/web-hosting/provisioning`
Setup tracking. Job steps: order received → payment confirmed → hosting created → domain connected → SSL installed → website live. Functions: view progress, retry failed step later, contact support.

## 12. Local Listings / QMAPS Module (engine later: QMAPS)

### 12.1 `/dashboard/local-listings`
Overview: business listings, citations, reviews, photos, Google Business status, local visibility score placeholder. Functions: view listings, add listing, update business info, track reviews, generate listing report.

### 12.2 `/dashboard/local-listings/listings`
Listing profiles: name, address, phone, website, category, status, platform. Functions: create/edit, sync later, view detail.

### 12.3 `/dashboard/local-listings/reviews`
Review monitoring: list, rating, source, reply status, sentiment placeholder. Functions: view, draft AI reply, mark replied, filter by rating.

### 12.4 `/dashboard/local-listings/citations`
Citations: directory name, NAP consistency, status, last checked. Functions: view status, find inconsistencies, request correction later.

## 13. Leads / FLEXS Module (engine later: FLEXS)

### 13.1 `/dashboard/leads`
Overview: lead pipeline, new leads, campaigns, conversion status, follow-up tasks, revenue potential. Functions: view/add/assign lead, update status, create follow-up.

### 13.2 `/dashboard/leads/pipeline`
Stages: new → contacted → qualified → proposal sent → won / lost. Functions: move stage, assign owner, add note, schedule follow-up.

### 13.3 `/dashboard/leads/campaigns`
Lead campaigns: name, source, budget placeholder, leads generated, conversion rate, status. Functions: create campaign, view campaign leads, generate campaign idea with AI, export later.

### 13.4 `/dashboard/leads/contacts`
Contact database: name, email, phone, company, source, status. Functions: add/edit contact, add note, send to CRM later.

## 14. AI Studio (engines later: TryHolo / OpenAI)

### 14.1 `/dashboard/ai-studio`
Center: content generator, campaign assistant, report assistant, video idea generator, creative brief generator, saved content. Functions: generate captions/posts/campaign ideas/video scripts/hooks/hashtags, save content, send to approval workflow.

### 14.2 `/dashboard/ai-studio/content-generator`
Inputs: brand, platform, goal, tone, offer, language, CTA. Outputs: caption, hashtags, short version, long version, hook, CTA. Functions: generate, regenerate, save, send to social post draft.

### 14.3 `/dashboard/ai-studio/campaign-builder`
Inputs: business type, goal, date range, platforms, offer, audience. Outputs: campaign name, content calendar, post ideas, promotion angles, reporting goals. Functions: create campaign draft, generate post plan, save, send to Social Media module.

### 14.4 `/dashboard/ai-studio/video-ideas`
Functions: generate reels/TikTok ideas, video scripts, shot lists; send brief to TryHolo later.

### 14.5 `/dashboard/ai-studio/saved`
Saved outputs. Functions: view, filter by brand/type, reuse, delete.

## 15. Reports Module

### 15.1 `/dashboard/reports`
Report center. Types: social media, website/hosting, local listing, lead generation, monthly business, client summary. Functions: view, generate, schedule, export PDF later, share with client later.

### 15.2 `/dashboard/reports/builder`
Custom builder: select client, brand, modules, date range; add AI summary; add charts later. Functions: build, preview, save draft, generate final.

### 15.3 `/dashboard/reports/templates`
Templates: weekly social, monthly client, SEO/local, leads, hosting status. Functions: create, edit, duplicate.

## 16. Invoices / Billing (engine later: Stripe / Upmind)

### 16.1 `/dashboard/invoices`
Invoice center: list, amount, due date, status, provider, download PDF. Functions: view, pay later, download, filter by status.

### 16.2 `/dashboard/billing/subscriptions`
Subscriptions: active list, plan, renewal date, billing cycle, status. Functions: view, upgrade/downgrade later, cancel later, sync from Stripe/Upmind later.

### 16.3 `/dashboard/billing/payment-methods`
Functions: view methods, add/remove/set default later.

## 17. Files / Storage

### 17.1 `/dashboard/files`
Client file manager: folders, uploaded files, shared files, permissions, preview, type labels. Functions: upload, download, rename, move, delete, share with client, attach to report or ticket.

## 18. Notifications

### 18.1 `/dashboard/notifications`
Types: approval needed, report ready, invoice due, integration error, job failed, support reply, service renewal. Functions: view, mark read, filter by type, open related item.

## 19. Support / Service Desk

### 19.1 `/dashboard/support`
Ticket center: list, status, priority, department, last reply, attachments. Functions: create, reply, assign, close, escalate, attach files.

### 19.2 `/dashboard/support/[ticketId]`
Ticket detail: conversation, internal notes, attachments, related client, related service, status timeline. Functions: reply, add internal note, change status, assign user, upload attachment.

## 20. Team & Permissions

### 20.1 `/dashboard/team`
Users and staff: member list, role, status, assigned clients, last login. Functions: invite, edit role, disable, assign permissions.

### 20.2 `/dashboard/permissions`
RBAC. Roles: Super Admin, Admin, Manager, Team Member, Client User. Functions: create/edit role, assign permissions, restrict modules.

## 21. Admin Control Tower

### 21.1 `/dashboard/admin`
Internal command center: all clients, all services, all integrations, all jobs, failed jobs, system health, billing overview, recent activity. Functions: view everything, retry jobs, disable service, view logs, manage integration status, review errors, platform-wide search.

### 21.2 `/dashboard/admin/jobs`
Job monitoring: list, status, provider, attempts, error message, created/completed dates. Functions: retry, cancel, view logs, filter failed.

### 21.3 `/dashboard/admin/integrations`
Providers: Metricool, Upmind, TryHolo, QMAPS, FLEXS, Stripe, Supabase, Email/SMS. Functions: view provider status, add credentials later, test connection later, view webhook events, disable provider.

### 21.4 `/dashboard/admin/system-health`
Checks: app, database, auth, storage, job queue, providers, API health. Functions: run health check, view uptime, view errors, alert admin.

## 22. Settings

### 22.1 `/dashboard/settings` — sections: account, business profile, branding, notifications, billing, security, integrations, API keys later.
### 22.2 `/dashboard/settings/branding` — logo, colors, business name, portal name, email branding later. Functions: upload logo, save colors, preview portal.
### 22.3 `/dashboard/settings/integrations` — client-level integration settings: view, connect/disconnect later, test connection later, view status.
### 22.4 `/dashboard/settings/security` — change password later, 2FA later, view/revoke sessions, audit log.

## 23. Core Database Model Plan (future Prisma/Supabase)

User, Client, Team, TeamMember, Role, Permission, BusinessBrand, ServiceInstance, IntegrationAccount, IntegrationEvent, Job, JobLog, SocialAccount, Campaign, SocialPost, Approval, AnalyticsDaily, Report, ReportSection, Invoice, Subscription, FileAsset, Notification, SupportTicket, SupportMessage, Lead, LeadCampaign, LocalListing, Review, AuditLog. (30 models.)

## 24. Core Status Systems

| Domain | Statuses |
|---|---|
| Service | planned, pending_setup, active, paused, failed, cancelled |
| Integration | not_connected, planned, disabled, pending_credentials, connected, error, expired |
| Job | queued, running, completed, failed, cancelled, retrying |
| Post | draft, pending_approval, approved, scheduled, published, failed |
| Invoice | draft, open, paid, overdue, failed, cancelled |

## 25. Integration Rules

**Metricool:** social account connection, calendar, scheduling, publishing, social analytics, white-label reports. Do not mark connected until real credentials exist.

**Upmind:** domain search, hosting plans, billing, invoices, provisioning, product catalogue, client portal, service desk. Do not rebuild Upmind features unnecessarily.

**TryHolo:** creative AI, video ideas, ad creatives, captions, hooks, campaign concepts. Do not make the whole system depend on TryHolo.

**QMAPS:** local listings, business profiles, reviews, citations, local SEO visibility.

**FLEXS:** lead generation, campaigns, lead pipeline, follow-ups, CRM-style tracking.

## 26. Environment Variables

`.env.example` only, placeholders only (already in repo since Phase 0): app (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`), database (`DATABASE_URL`, `DIRECT_URL`), Supabase, Stripe, Metricool, TryHolo (`TRYHOLO_ENABLED=false`), Upmind, QMAPS, FLEXS, `OPENAI_API_KEY`.

## 27. MVP Build Order (authoritative)

| Phase | Scope | Status |
|---|---|---|
| 0 | Architecture lock: Next.js scaffold, architecture doc, env example, placeholder modules, health route | ✅ Complete |
| 1 | Core Dashboard Shell: sidebar, topbar, dashboard route, placeholder module pages, KPI cards, service cards, integration status panel, activity feed | ✅ Complete |
| 2 | Core SaaS Data Foundation: clients, businesses/brands, service instances, roles plan, static typed mock data first, clean components/config | ✅ Complete |
| 3 | Auth + Role Access Foundation: Supabase setup, login/logout, sessions, protected dashboard routes, basic profile, role plan activation | ✅ Complete |
| 4 | Database Schema + Persistent SaaS Models: Prisma schema (12 core models), migrations, seed data, RLS foundation | ✅ Complete |
| 5 | Social Media Module Foundation: campaigns, posts, calendar, approvals, analytics placeholders | ✅ Complete |
| 6 | Metricool Integration Foundation: adapter, credentials check, test connection (real publishing/sync remain post-verification work) | ✅ Complete |
| 7 | Web / Hosting Module Foundation (Upmind engine later): hosting dashboard, domain dashboard, service details, provisioning timeline | ✅ Complete |
| 8 | Upmind Integration Foundation: adapter, credentials check, test connection, webhook skeleton (real sync/provisioning remain post-verification work) | ✅ Complete |
| 9 | AI Studio Foundation: content generator, campaign assistant, saved outputs, brand voice, provider readiness | ✅ Complete |
| 10 | Reporting Engine Foundation: templates, sections, metrics, schedules, internal preview (export/delivery future) | ✅ Complete |
| 11 | Jobs System: job model, job logs, retry system, admin job monitor | |
| 12 | Reports Engine: report builder, templates, AI summaries, export later | |
| 13 | Admin Control Tower: overview, clients, users, services, jobs monitor, events, audit logs, notifications, system health, settings (view-only) | ✅ Complete |
| 14 | QA / Security / Production Readiness: runtime hardening, seed guard, API gating, headers, CI, ops docs | ✅ Complete |
| 15A | Tenant Isolation & Membership Enforcement: profile-based auth, scoped data layers, owner bootstrap, isolation tests | ✅ Complete |
| 15B | Membership Administration & Persistent CRUD: invite/assign flows, client CRUD, role management | Next |

## 28. Rules for Development (every phase)

1. Inspect before editing.
2. Do not delete working code.
3. Do not fake integrations.
4. Do not add fake secrets.
5. Do not claim something is connected unless real credentials and real API calls exist.
6. Keep changes small and testable.
7. Build reusable components.
8. Business logic lives in `src/lib`, not directly in pages.
9. Keep UI honest with labels: "Not connected", "Planned", "Coming soon", "Mock data", "Foundation".
10. Run `npm run typecheck`, `npm run lint`, `npm run build`.
11. Report: files changed, routes added, commands run, passed/failed checks, known limitations, recommended next phase.

## 29. V1 Success Definition

V1 is successful when: a client can log in; a client can see their business/brand; a client can see active TAKATAK services; the dashboard shows clear module status; Social Media, Web Hosting, Local Listings, Leads, AI Studio, Reports, Billing, Files, and Support exist as structured modules; admin can manage clients, brands, services, integrations, jobs, and reports; integrations are clearly separated by adapters; no fake connected states exist; the system can grow without rebuilding the foundation.

## 30. Final Product Direction

One dashboard for all business services. The client should not feel like they are using Metricool, Upmind, TryHolo, QMAPS, FLEXS, Stripe, or Supabase separately. The client should feel: **"Everything is managed inside TAKATAK."**

Behind the scenes: Metricool powers social media; Upmind powers web/domain/hosting; TryHolo/OpenAI power creative AI; QMAPS powers local listings; FLEXS powers leads; Stripe powers payments; Supabase powers auth/database/storage; **TAKATAK controls the user experience.**
