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
