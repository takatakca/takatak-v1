# 00 — NEWBUY — TAKATAK ecosystem add-ons

Signed: **NEWBUY** @ ChatGPT Work · 2026-11-02.

## Role and permanent working method

The owner assigned this agent the name **NEWBUY**, specializing in add-ons for the TAKATAK ecosystem. Earlier work in this thread was signed Codex MONITOR; preserve those historical records.

Before working, read current main, AGENTS.md, WORKLOG.md, open pull requests, the coordination board, this 00 file and the relevant project/master instructions. Continue existing work and respect claimed tasks. Do not replace or remove existing services or content to add a product.

Leave signed notes **before coding, during material steps and after verified completion** in the repository's 00/worklog, the project's authorized Google Drive dossier and the authorized coordination channel. The owner authorized routine coordination replies. Use the assigned account and existing daily coordination thread; do not create duplicates. Keep private operational details, client data and credentials outside this public repository.

Each checkpoint states what was read, what changed, how it was verified, what remains blocked and the exact next step. Distinguish implemented code, passing CI, deployed revision and actual service activation. Never claim an external action or live result without evidence.

The owner selected **hourly** NEWBUY follow-up after the available scheduler's one-hour minimum was explained. The originally requested 30-minute interval was not created. The recurring prompt includes these same continuity rules; the private project dossier holds its operational references.

## Current add-on: Website Monitoring

- Source: [PR #243](https://github.com/takatakca/takatak-v1/pull/243), merged into main as `8b75dd05cdedd88622408fef91c71a49f2e14cce`.
- Public page: `/monitoring`; workspace dashboard: `/dashboard/web-hosting/monitoring`; alias: `/dashboard/monitoring`.
- TAKATAK owns signup/sign-in, workspace authorization, add-on checkout and subscription/invoice access. The monitoring worker runs independently.
- Existing pages/services are preserved. The product adds footer/navigation/billing/sitemap entries.
- Signed per-domain authorization and snapshots; workspace-scoped reads/CSV; no schema migration. Paid enrollment remains off by default until operational verification.
- Full source CI [41404809737](https://github.com/takatakca/takatak-v1/actions/runs/41404809737) passed, including real ephemeral database billing/isolation/sync tests. Worker CI [41404809923](https://github.com/takatakca/takatak-v1/actions/runs/41404809923) passed, including 16 worker tests and the Docker build.
- Production deployment and operational activation are **not yet verified** at this checkpoint. Re-read main/Actions for the latest state.

## Resume

Verify the exact main CI and configured release transport; deploy the reviewed revision under the owner's authorization and verify the public page plus deployed SHA. Activate paid enrollment only after the independent worker, support-email delivery, external liveness watchdog and Stripe configuration are proven. Read [ops/monitoring/README.md](ops/monitoring/README.md) for the implementation and setup contract.

Signed: **NEWBUY — TAKATAK ecosystem add-ons**.

## Verified release and operations checkpoint — 2026-11-04 09:17 HNE

### BEFORE — continuity and ownership
- Read current `main` (`b853bb6b5ac2261d284f38cf83fc005ff100330b`), `AGENTS.md`, the current `WORKLOG.md` head, open PR titles, this file, the knowledgeAI master index, PR #243 and the agent board.
- PR #243 is merged as `8b75dd05cdedd88622408fef91c71a49f2e14cce`. Existing open work is preserved; PR #237 also edits `WORKLOG.md`, so this checkpoint deliberately avoids changing that shared file.
- The Drive master, journal and NEWBUY/Add-ons dossier were not accessible in this session. No claim is made that they were read or updated.

### DURING — exact current-main evidence
- Main CI [41806218575](https://github.com/takatakca/takatak-v1/actions/runs/41806218575) completed successfully on the exact main SHA. The Monitoring checkout / tenant-isolation / signed-sync ephemeral-database step passed, as did the build, artifact packaging and clean artifact startup.
- Production artifact validation [41807608725](https://github.com/takatakca/takatak-v1/actions/runs/41807608725) passed and attested the exact current-main CI artifact.
- Staging workflow [41807751160](https://github.com/takatakca/takatak-v1/actions/runs/41807751160) has a successful workflow summary, but the staging build, upload and activation steps were skipped. The job reports missing migration approval and unavailable staging build configuration. This is **not** a staging deployment.
- Production migration workflow [41806218947](https://github.com/takatakca/takatak-v1/actions/runs/41806218947) has a successful workflow summary, but its actual audit/reconcile step was skipped: the `TAKATAK_PRODUCTION_DATABASE_URL` secret was empty/unavailable in that run. No live production schema audit or migration is proven.
- Production deployment [41807608671](https://github.com/takatakca/takatak-v1/actions/runs/41807608671) was skipped. The Coolify production gate remains closed; the runbook requires the owner's first manual production acceptance before automatic deployment is enabled.
- The monitoring runbook confirms an independent worker with no inbound port. The committed worker environment example has blank SMTP credentials and `DASHBOARD_SYNC_ENABLED=false`; the sample target is not an enrolled customer. The worker's own host cannot alert on its own failure, so an independent external watchdog is required.
- The application code keeps sign-in/workspace ownership in TAKATAK and uses the existing shared Stripe customer, webhook and invoice center. Checkout is CAD 5.00/month/site with explicit recurring consent and automatic tax; entitlement requires a provider-confirmed active subscription and paid invoice. These are code-level controls, **not** proof of live Stripe configuration or a completed payment.
- The public reader could not retrieve `/monitoring` or `/api/health/ready`; no HTTP status or deployed SHA is claimed.

### AFTER — verified outcome and next step
- Documentation-only checkpoint; no application code changed. No production/staging deployment, migration, DNS change, payment, customer enrollment or paid activation was performed.
- Keep `MONITORING_BILLING_ENABLED=false`. Do not enable paid enrollment until the independent worker, approved per-domain HMAC keys, SMTP delivery, external watchdog and Stripe test-mode Tax / portal / webhook checks are verified.
- Exact next owner action: configure `TAKATAK_PRODUCTION_DATABASE_URL` in GitHub Actions secrets, then run and review the production migration workflow in **audit-only** mode. This does not authorize applying migrations or deploying.
- Gmail's current daily coordination thread was read through its latest routine update; no new request was directed to NEWBUY, so no duplicate reply was sent.
- Signed: **NEWBUY — TAKATAK ecosystem add-ons** · 2026-11-04 09:17 HNE.

## Verified named-workspace exemption checkpoint — 2026-11-06 07:18 HNE

- **Before:** current `main`, `AGENTS.md`, `WORKLOG.md`, PRs #243/#249/#257, Actions, knowledge master, Drive master/journal/NEWBUY dossier, agent board and daily Gmail thread were read. No overlapping NEWBUY coding claim was found.
- **During / after:** PR #257 is merged as `47a006c2cee22f1236c22ba085e8c60588a5ef47`. The subscription-exemption allowlist accepts labeled `client-name:workspace-uuid`, legacy UUID-only entries and mixed lists. Labels are organizational only; authorization still requires the exact valid workspace UUID.
- Exact main CI [42211845650](https://github.com/takatakca/takatak-v1/actions/runs/42211845650) and production-artifact validation [42213030983](https://github.com/takatakca/takatak-v1/actions/runs/42213030983) passed. Artifact validation explicitly performed no production connection, upload, activation, migration, DNS or provider change.
- Staging migration reconciliation [42213030939](https://github.com/takatakca/takatak-v1/actions/runs/42213030939) passed in audit-only mode with no mutation. Staging workflow [42213180612](https://github.com/takatakca/takatak-v1/actions/runs/42213180612) produced no artifact and activated nothing because approved migration evidence was absent. Coolify production [42213031012](https://github.com/takatakca/takatak-v1/actions/runs/42213031012) was skipped.
- No production environment value, deployment, migration, payment or paid activation was changed by NEWBUY. Exact next step: use an authorized release path to deploy the reviewed code, prove the served SHA, then update the private runtime allowlist and smoke-test one exempt and one ordinary unpaid workspace. Website Monitoring paid enrollment remains closed until its worker, SMTP delivery, independent watchdog and Stripe path are proven.
- Signed: **NEWBUY — TAKATAK ecosystem add-ons**.


## Website Monitoring verification checkpoint — 2026-11-12 02:17 EST

- **Before:** current `main`, `AGENTS.md`, `WORKLOG.md`, PR #243, current Actions, the knowledge master, Drive master/journal/NEWBUY dossier, the coordination board and the 2026-11-12 Gmail thread were read. The release-control gate was respected; no active agent work was duplicated.
- **Verified source:** `main` is `884360af3cfeea0c0a03d29d5f156bdca2a1b941`. Exact-main CI [42972568883](https://github.com/takatakca/takatak-v1/actions/runs/42972568883) passed, including the static Monitoring safeguards, ephemeral-database checkout/tenant-isolation/signed-sync checks, build, artifact audit and clean startup. Immutable artifact validation [42973769093](https://github.com/takatakca/takatak-v1/actions/runs/42973769093) passed.
- **No deployment proof:** migration reconciliation [42973769073](https://github.com/takatakca/takatak-v1/actions/runs/42973769073) remained audit-only because human approval was skipped. Staging [42973887407](https://github.com/takatakca/takatak-v1/actions/runs/42973887407) reported success only for unavailable-configuration reporting; build, upload, transport, activation, health and rollback steps were skipped. Coolify production [42973769110](https://github.com/takatakca/takatak-v1/actions/runs/42973769110) and later release followers were skipped. No rejected Coolify credential was retried.
- **Public evidence:** `/api/health` returned `status=ok` and `alive=true`; `/api/health/ready` returned process/database/Supabase `ok`. `/monitoring` remains public at 5 CAD/month/site with central TAKATAK sign-in, dashboard and billing wording, and still states that paid enrollment opens only after activation. `/release.txt` still returns the TAKATAK 404 page, so the served SHA is not proved.
- **Blocked:** independent worker, SMTP delivery, external watchdog, Stripe operational flow and exact served revision remain unproved. PR #286 owns the current authentication change and was not touched.
- **Action:** no code, environment, payment, migration, activation or deployment was changed. Keep paid enrollment closed. Next: the release coordinator publishes a reliable release marker through the authorized path and proves the exact served SHA plus worker/SMTP/watchdog/Stripe before activation.
- Signed: **NEWBUY — TAKATAK ecosystem add-ons**.


## Post-merge authentication and Monitoring release checkpoint — 2026-11-12 03:23 EST

- **Before:** current `main`, `AGENTS.md`, `WORKLOG.md`, PR #243, PR #286, PR #287, exact-main Actions, the knowledge master, Drive master/journal/NEWBUY folder and document, the agent board and the daily Gmail thread were read. No concurrent add-on task was taken over.
- **During verification:** PR #286 is merged and `main` is now `3dcd5e7e970233eb2c47f379c3fb498c7defe0b0`. Exact-main CI [43174779957](https://github.com/takatakca/takatak-v1/actions/runs/43174779957) passed, including authentication tests, Monitoring static and ephemeral-database safeguards, build, artifact audit and clean startup. Immutable artifact validation [43176161913](https://github.com/takatakca/takatak-v1/actions/runs/43176161913) passed.
- **No deployment proof:** migration reconciliation [43176161900](https://github.com/takatakca/takatak-v1/actions/runs/43176161900) remained audit-only because human staging approval was skipped. Staging [43176289621](https://github.com/takatakca/takatak-v1/actions/runs/43176289621) only reported unavailable build configuration; setup, install, build, upload, transport, activation, health and rollback were skipped. Coolify production [43176161919](https://github.com/takatakca/takatak-v1/actions/runs/43176161919) was skipped; no rejected credential was retried.
- **Public evidence:** `/monitoring` remains public at 5 CAD/month/site with TAKATAK identity, dashboard and billing wording; the page still says paid enrollment opens only after activation. No exact served SHA is proved.
- **Authentication boundary:** the merged email-code/Google flow passed repository CI, but the PR itself states that profile/workspace synchronization and a complete Google round trip still require staging proof and the approved Supabase callback configuration. This checkpoint does not claim either proof.
- **After:** no functional code, environment, secret, payment, migration, activation or deployment was changed. Paid Monitoring enrollment stays closed. PR #287 remains documentation-only and open for the authorized coordinator. Next: prove the served SHA plus worker, SMTP, independent watchdog, Stripe and the complete sign-in/profile flow before activation.
- Signed: **NEWBUY — TAKATAK ecosystem add-ons**.


## Documentation merge and exact-main verification — 2026-11-12 06:13 EST

- **Before:** current `main`, `AGENTS.md`, `WORKLOG.md`, PR #243, PR #287, exact-main Actions, the knowledge master, Drive master/journal/NEWBUY dossier, agent board and daily Gmail thread were read. No concurrent add-on implementation was claimed.
- **Verified merge:** PR #287 was merged by the authorized repository path. `main` is `0d63fe3cba399647c916c578c8fdee8085c3da42`; the two prior NEWBUY verification checkpoints are now present on `main`.
- **Verified CI:** exact-main CI [43202029835](https://github.com/takatakca/takatak-v1/actions/runs/43202029835) passed, including authentication tests, Monitoring safeguards, ephemeral-database checkout/tenant isolation/signed sync, build, artifact audit and clean startup. Immutable artifact validation [43203569637](https://github.com/takatakca/takatak-v1/actions/runs/43203569637) passed.
- **No deployment proof:** migration reconciliation [43203569466](https://github.com/takatakca/takatak-v1/actions/runs/43203569466) remained audit-only because human staging approval was skipped. Staging [43203741148](https://github.com/takatakca/takatak-v1/actions/runs/43203741148) reported unavailable configuration; setup, install, build, artifact upload, transport, activation, health and rollback were skipped. Coolify [43203569463](https://github.com/takatakca/takatak-v1/actions/runs/43203569463) was skipped; no rejected credential was retried.
- **Public gate:** `/monitoring` remains public at 5 CAD/month/site with TAKATAK identity/dashboard/billing wording and still states paid enrollment opens only after activation. Exact served SHA, independent worker, SMTP, external watchdog, Stripe operational flow and the full Google/profile synchronization flow remain unproved.
- **After:** no functional code, secret, environment, payment, migration, activation or deployment was changed by NEWBUY. Keep paid enrollment closed. Next: prove the exact served revision and every operational dependency before activation.
- Signed: **NEWBUY — TAKATAK ecosystem add-ons**.
