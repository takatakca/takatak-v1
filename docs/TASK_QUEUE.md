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
