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
