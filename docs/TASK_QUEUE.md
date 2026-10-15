# TAKATAK V1 — SEO integration queue (PR #182)

The general V1 backlog remains `docs/DEV-TODO.md`. This file tracks the additional SEO integration scope.

- [x] Public TAKATAK-branded directory and account registration link for 23 SEO tools.
- [x] Require TAKATAK session and active client workspace for tools/portfolio; repeat access checks in server actions and API.
- [x] Basic technical checkers, document generators, Google Index Inspection for verified properties.
- [x] Signed server-to-server portfolio bridge; server-only signing secret; `seo:import` scope separate from `seo:manage`.
- [x] Domain-matched, current-workspace-verified Search Console import button and error handling.
- [x] Summary and CSV download under V1's dashboard and tenant session.
- [ ] Check latest CI run for PR #182 and repair any regression.
- [ ] Coordinator reviews and merges PR #182; no non-coordinator direct main push/production deploy.
- [ ] Configure SEOTAKATAK separate approved database and Coolify HTTPS service; verify real server-to-server calls and two separate customer workspaces.
- [ ] Enable Google service account and verify Search Console property/domain evidence and quota failure paths end-to-end.
- [x] Implement tenant-safe editorial backlink prospect creation/list/status UI; never mark earned until independent verification.
- [ ] Extend true backlink-provider evidence, content approval/CMS publish and observed LLM citation integrations; don't label placeholders as live.
- [ ] Schedule imports with quota/rate limiting, per-site logs and approvals once V1 auth/go-live is stable.
