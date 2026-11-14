# TAKATAK V1 — Executable Task Queue

## Safe work cycle
Review current main, AGENTS, WORKLOG, active PRs and foodhubca#105 before changing files. Respect active Social/Studio ownership. Reconcile reviewed changes on a separate branch, preserve newer source and all agent notes, run focused and complete CI, merge only the reviewed tested revision, then verify the actual runtime SHA and readiness. Leave signed before/during/after GitHub and Drive notes.

## Current next actions

Guardian, 2026-11-07: keep the public smoke on its branch until CI is green. The owner, not an agent, attaches `www.takatak.ca` in Coolify and replaces the Traefik default certificate. Do not change the release-workflow concurrency groups in this audit; the release coordinator still owns that cancellation behavior. No test account was available, so sign-in, dashboard contents, and payments remain unverified.

Finish integration checks, publish the review branch and observe Node22 CI. Reconcile any concurrent main changes before release. Let Coolify finish its existing serial queue; verify the resulting production SHA instead of starting a competing deployment. Drafts and integration/migration dependencies remain explicit separate work; no paid activation, social publication, DNS or live migration is implied.

Current release checkpoint — 2026-11-07T08:31:19.480459+00:00. Signed: Codex @ ChatGPT Work. This current checkpoint supersedes dated release-status assertions below; all prior main notes are preserved. Tracking: https://github.com/takatakca/takatak-v1/issues/259

---

## Earlier notes preserved

# REVEW review API follow-up — 2026-10-31

- Focused CI passed on 8c3cfb8 (https://github.com/takatakca/takatak-v1/actions/runs/41190779123); coordinator review/merge only.
- QMAPS agent: accept its signed [API handoff](https://github.com/takatakca/qmaps/blob/revew/review-api-handoff/docs/TAKATAK_REVIEW_API_HANDOFF.md), including scoped review/business reads and counterpart reply ownership checks.
- FLEXS agent: accept its signed [API handoff](https://github.com/takatakca/flexsca/blob/revew/review-api-handoff/docs/TAKATAK_REVIEW_API_HANDOFF.md), complete authorized business/lead/review feeds and dedicated credentials.
- Reverify blocked official API documentation, production approval, scopes and source content rights before unlocking Facebook/Yelp/Tripadvisor/other adapters.
- Gmail/Drive/30-minute email task: tools unavailable; not read/uploaded/scheduled. Copies are Drive-ready only.

— REVEW

# TAKATAK V1 — SEO integration queue (PR #182)

The general V1 backlog remains `docs/DEV-TODO.md`. This file tracks the additional SEO integration scope.

- [x] Public TAKATAK-branded directory and account registration link for 23 SEO tools.
- [x] Require TAKATAK session and active client workspace for tools/portfolio; repeat access checks in server actions and API.
- [x] Basic technical checkers, document generators, Google Index Inspection for verified properties.
- [x] Signed server-to-server portfolio bridge; server-only signing secret; `seo:import` scope separate from `seo:manage`.
- [x] Domain-matched, current-workspace-verified Search Console import button and error handling.
- [x] Summary and CSV download under V1's dashboard and tenant session.
- [x] Add actual client-scoped content brief creation and draft-only listing in site report.
- [ ] Add content editorial review / approval and approved CMS publishing only after verified ownership, product rights, audit trail and owner approval.
- [x] Build manager-scoped domain ownership UI with real challenge issuance, TXT display and DNS verification action; add CI contract coverage.
- [ ] Verify live DNS ownership after owner-approved SEO backend migration 0002 and production configuration.
- [ ] Check latest CI run for PR #182 and repair any regression.
- [ ] Coordinator reviews and merges PR #182; no non-coordinator direct main push/production deploy.
- [ ] Configure SEOTAKATAK separate approved database and Coolify HTTPS service; verify real server-to-server calls and two separate customer workspaces.
- [ ] Enable Google service account and verify Search Console property/domain evidence and quota failure paths end-to-end.
- [x] Implement tenant-safe editorial backlink prospect creation/list/status UI; never mark earned until independent verification.
- [x] Add signed manager-only brief approval/rejection with review reason and explicit not-published state.
- [ ] Obtain database approval for migration 0003 after 0001+0002 and test real draft-review transitions.
- [ ] Extend true backlink-provider evidence, original CMS publishing with verified ownership/consent and observed LLM citation integrations; don't label placeholders as live.
- [ ] Schedule imports with quota/rate limiting, per-site logs and approvals once V1 auth/go-live is stable.


- [x] Add a separate PR #196 with signed, tenant-scoped deletion receipt viewer for managers; preserve existing SEO portfolio and TAKATAK Auth.
- [x] Verify PR #196 code/docs full CI 38884438610 and mark ready for designated V1 coordinator review.
- [ ] Designated V1 coordinator reviews/merges PR #196, deploys approved V1 release and validates SEO staging/production receipts; not delegated to this development agent.
- [ ] Owner approves existing/non-billable SEO PostgreSQL and `sql/0004_site_deletion_receipts.sql` after 0001→0003; run manager/viewer/client B negative tests and disposable staging site deletion.
- [ ] Agree a written retention policy for SEO deletion receipts, backup purge/subject access and cross-product erasure boundaries before regulated use.
