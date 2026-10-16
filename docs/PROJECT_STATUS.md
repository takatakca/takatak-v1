# TAKATAK V1 — Project Status

Last verified against GitHub: **2026-10-14**. This is a factual status snapshot, not a claim that the public site runs this revision.

## Source of truth

- Repository: [takatakca/takatak-v1](https://github.com/takatakca/takatak-v1)
- Default branch: `main`
- Inspected main SHA: `dcd454e42e95f08c407c53ab1af73ee2b36e0e4f` (2026-10-13 UTC)
- Read in order: [AGENTS.md](../AGENTS.md), [WORKLOG.md](../WORKLOG.md), [DEV-TODO.md](DEV-TODO.md), this status and [AGENT_HANDOFF.md](AGENT_HANDOFF.md).
- Architecture: [TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md](TAKATAK_DASHBOARD_V1_FULL_SCREEN_ARCHITECTURE.md).
- These documents **do not supersede** the owner release-control decision in WORKLOG.md.

## Implemented in `main` (repository code, not proof of production activation)

- Modular Next.js/React dashboard, shared client-workspace access, brand/navigation and premium public website.
- Supabase Auth phone-first foundation, client memberships, server-side tenant scoping and guardrails; see issue [#141](https://github.com/takatakca/takatak-v1/issues/141) for remaining live validation.
- Social, Growth Suite, CRM/leads, local listings and QMAPS client linking foundations; many external providers require credentials, approval or runtime verification.
- TAKATAK ADS campaign-management APIs, entitlement logic, serving and signed tracking; publisher seed script and read-only dashboard.
- Billing/Facturations and website lead capture foundations; several database/provider activation gates remain.
- PDF report export, SEO history, website pricing catalog integration and server-side promotions (merged code).
- Staging migration approval/reconciliation, reproducible Linux Node 22 build and immutable-artifact production promotion with rollback.

These are implementation milestones, not an assertion that every integration is connected. In particular, public-facing features requiring secrets, migrations or external APIs stay unverified until evidence is recorded.

## In-flight work (do not duplicate)

| PR | Scope | Last verified CI |
| --- | --- | --- |
| [#176](https://github.com/takatakca/takatak-v1/pull/176) | ADS publisher SDK privacy/viewability fixes and regression QA | [success, run 38608344700](https://github.com/takatakca/takatak-v1/actions/runs/38608344700) |
| [#177](https://github.com/takatakca/takatak-v1/pull/177) | ADS client dashboard draft campaign creator and QA | [success, run 38608979371](https://github.com/takatakca/takatak-v1/actions/runs/38608979371) |

Additional independent PRs: [#179](https://github.com/takatakca/takatak-v1/pull/179) hardens public ADS request-body limits and privacy, and [#180](https://github.com/takatakca/takatak-v1/pull/180) caps concurrent CPC charges. Both are open with CI pending; neither is merged into main.

Both feature PRs #176 and #177 were still open at inspection; green branch CI is **not** proof of merge or deployment. Check current state on every handoff.

Other open PRs at inspection: #175, #173, #166, #163, #156, #155, #149, #137, #136, #135, #128, #104, #27. Respect reserved scopes/owner decisions in WORKLOG.md and DEV-TODO.md.

## Release / live status

- Latest inspected `main` SHA is above; it **does not include** PR #176 or #177.
- No new production release was deployed by this agent. No staging/production SQL was applied or secrets changed.
- The verified production artifact workflow requires a green `main` CI run with the exact SHA and published tarball; see [DEPLOYMENT.md](DEPLOYMENT.md).
- WORKLOG.md reports missing/awaited `production` environment SSH secrets and prerequisite staging/production migration approvals. Re-verify these before any authorized release; never assume they were filled.
- Some automatic staging/reconciliation workflow runs were **skipped**, which is not deployment success.
- No claim of production availability, authentication end-to-end, or provider connectivity without live evidence.

## Completion definition

The project is **not 100% complete**. Completion requires all approved capabilities, tenant isolation, live authorization/provider integration, verified DB migrations, green build/security checks, a confirmed production release SHA, documented rollback and no unresolved critical blockers. See [TASK_QUEUE.md](TASK_QUEUE.md).


## 2026-10-15 verified GitHub update
Main stayed at dcd454e42e95f08c407c53ab1af73ee2b36e0e4f. PRs #176–#183 have successful branch CI but remain unmerged, including Coolify deployment proposal #181, Academy #183 and SEO tools #182.
PR #184 adds bounded streaming input on 1LV master API, targeted CI passed, full CI pending. PR #185 adds a CUBAFOOD *offline* source contract and HMAC proof, full CI pending. Neither PR enables a live connector, deploys code, or modifies database schema.
No verified new production SHA, staging apply or provider activation. Do not equate skipped staging/release workflows with deployed artifacts.

## 2026-10-15 additional security and continuity update

[PR #186](https://github.com/takatakca/takatak-v1/pull/186) hardens the shared authenticated dashboard JSON reader against forged/omitted Content-Length and memory exhaustion; full CI pending. [PR #184](https://github.com/takatakca/takatak-v1/pull/184) achieved successful full CI. No production promotion has been verified. An hourly ChatGPT task to request repository resumption was enabled; this is not a GitHub deployment runner.


## 2026-10-15 15:04 America/Toronto — verified continuation

- Main remained at `dcd454e42e95f08c407c53ab1af73ee2b36e0e4f`. No observed merge of PR #176–#187.
- On current PR heads, GitHub CI passed for #176–#186, including #178 agent continuity, #184 bounded 1LV API, #185 offline CUBAFOOD contract and #186 shared workspace input validation.
- [PR #187](https://github.com/takatakca/takatak-v1/pull/187) now protects authenticated JSON parsing and invited-account password update against untrusted origin and oversized payloads. Its GitHub [CI run 38791407973](https://github.com/takatakca/takatak-v1/actions/runs/38791407973) was in progress at this inspection.
- [PR #181](https://github.com/takatakca/takatak-v1/pull/181) suggests direct Coolify hosting but is **not merged** and not live by virtue of its green CI. Existing release authority and migration decisions remain in WORKLOG.md.
- No stage/production SQL was applied, no provider secret changed, no real phone SMS flow tested, and no successful new runtime SHA observed. Project remains incomplete.

## 2026-10-15 migration verification
Read-only TAKATAK STAGING project status: ACTIVE_HEALTHY. Supabase history includes phone-only profile email migration; exact phone-only/website-attachment names did not appear in the separate Prisma history search, though the latter contains 87 completed migrations. This does not prove whether SQL is applied. Live SMS provider remains unverified; no schema mutations or deployment occurred.

### Confirmed staging schema (2026-10-15)
Read-only `information_schema.columns`: `public.profiles.email` is `text` with `is_nullable=YES`. Read-only `to_regclass` indicates `public.lead_attachments` is absent. Thus the phone-only column change is already present at the schema level, while lead attachment support is not. The migration-ledger discrepancy must be reconciled, not used as a reason to replay SQL. No database changes performed.


## 2026-10-15 late-night verification update

- **Main SHA:** `b59ca994a73c5ed0e19e3d0f8d0540feddeb5e24` — #181 direct Coolify Docker runtime merged by coordinator, but no new live release verified. Automatic Coolify, staging and release GitHub Actions in the most recent main runs show **skipped**, not deployed.
- **Auth security:** #187 initial full CI green; new forwarding-origin CSRF hardening merged latest main into PR head `4f34f264d528cfceb0d4c597487a283f9c72be98`, latest CI pending.
- **Health contract:** #188 fixes ready endpoint false-positive HTTP 200 on missing mandatory services; HEAD `f9c6f3cdcdd584f2cb08af04af1175cac09daa1f`, CI pending.
- Previously completed ADS/security and CUBAFOOD contract PRs remain open unless separately merged by coordinator. No live SMS or production identity and tenant-isolation proof.
- Direct health checks of `takatak.ca` failed due tool/network access restrictions, not necessarily site outage. Do not assert production failure or success from these attempts.



## 2026-10-16 05:44 America/Toronto latest main/PR evidence

Main HEAD `c53ed4529e03b15a0241f5b96e4ed37d3f50f56e`, latest observed [main CI 38858131646](https://github.com/takatakca/takatak-v1/actions/runs/38858131646) succeeded. Coolify production deploy workflow outputs at this SHA were skipped. Runtime SHA on `takatak.ca` could not be read through web health checks.

Owner/coordinator has merged #188 readiness, #185 CUBAFOOD offline contract, #177 ADS draft, #175 R2NETTE signed receiver, #155 AI provider keys, #136 QMAPS integration bridge, and #189 admin/staging approval fix. Green CI is not provider delivery or production promotion. PR #187 Auth CSRF remains open with green CI.

Fresh [PR #193](https://github.com/takatakca/takatak-v1/pull/193) takes over an unmerged existing R2F Phase 2 branch and adds the deterministic contract QA to modern main CI. It does not expose or sell customer leads and adds no schema. CI was in progress at handoff. Handoff/continuity PR #178 has been reconciled with current main and awaits its own exact-head CI and coordinator merge.


## 2026-10-16 afternoon factual status
Main currently `efe4db915d487822441502cc8d036819d31ab51b` after Coolify build improvements #197/#198 and provider-key integration #192. Prior-main full CI `38922550660` succeeded on `c6bdb9d17f00f18a341b6f787d1040444c0508bb`; current-main build and live SHA not confirmed. Latest Coolify auto-deploy was skipped. Public health GET was inaccessible to this execution environment because DNS resolution failed: public site status unknown.

Open PR #199 (passive live readiness) pushes a strict validator and tests; CI run `38942971983` ongoing at handoff. #178/#187/#193 most recent exact-head CI all succeeded, but remain open/unreleased. No evidence of live SMS, customer/tenant E2E or authorized staging migration apply.
