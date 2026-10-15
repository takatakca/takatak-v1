# TAKATAK V1 / SEOTAKATAK integration decisions

For the SEO work tracked in PR #182:

- TAKATAK V1 retains Supabase identity, client membership, selected workspace, permission checks and dashboard. The standalone SEOTAKATAK repo is a tenant-scoped backend only.
- A client signs in at `takatak.ca`; there is no independent SEOTAKATAK signup or cookie.
- `/free-tools` is public for SEO/registration discovery; running free tools is inside `/dashboard/seo/free-tools` and demands an authorized workspace.
- The signed bridge takes the tenant UUID exclusively from `getServerAccessContext()`, never from submitted body or query.
- `view_dashboard` allows free scans, `view_reports` allows scoped reporting/export, `manage_integrations` controls site registration, and both `view_reports` plus `manage_integrations` govern verified GSC ingest.
- Never claim Google indexing or AI search citations without verifiable provider results; the dashboard must show honest connection-required states.
- V1 `main` and production are controlled by its designated coordinator per `WORKLOG.md`; SEO agent work stays on PR #182 until approved.

- Editable backlink prospect states are limited to identified/researching/contacted/declined. The frontend cannot set 'earned': verifying a backlink needs independent publisher/crawler evidence not available in this deployment.

- Registering a site is not equivalent to owning it. The SEO backend issues unique cryptographic DNS TXT challenges, and the domain can only be marked verified after a live TXT match. Only V1 client managers can view/reissue/check challenges, and general site reads redact challenge tokens.

- SEO original content briefs in PR #182 are deliberate draft-only records; a keyword and editorial angle do **not** authorize publishing. The user must verify site ownership, the product must add editorial review/approval and CMS integration, and every release must use server-side workspace permission checks before publishing.
