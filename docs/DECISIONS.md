# TAKATAK V1 / SEOTAKATAK integration decisions

For the SEO work tracked in PR #182:

- TAKATAK V1 retains Supabase identity, client membership, selected workspace, permission checks and dashboard. The standalone SEOTAKATAK repo is a tenant-scoped backend only.
- A client signs in at `takatak.ca`; there is no independent SEOTAKATAK signup or cookie.
- `/free-tools` is public for SEO/registration discovery; running free tools is inside `/dashboard/seo/free-tools` and demands an authorized workspace.
- The signed bridge takes the tenant UUID exclusively from `getServerAccessContext()`, never from submitted body or query.
- `view_dashboard` allows free scans, `view_reports` allows scoped reporting/export, `manage_integrations` controls site registration, and both `view_reports` plus `manage_integrations` govern verified GSC ingest.
- Never claim Google indexing or AI search citations without verifiable provider results; the dashboard must show honest connection-required states.
- V1 `main` and production are controlled by its designated coordinator per `WORKLOG.md`; SEO agent work stays on PR #182 until approved.
