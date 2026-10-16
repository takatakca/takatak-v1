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

## SEO portfolio site deletion

A TAKATAK `manage_integrations` client manager may remove a **single SEO product site**, not the TAKATAK master customer. The V1 UI asks for the domain and a separate consent checkbox, and its server action revalidates the current workspace. The backend also demands a signed `seo:manage` token, `confirmDomain` matching its own stored hostname and `confirmDelete:true`; a second tenant's UUID never grants deletion. SQL 0001 already cascades child SEO records. No global ecosystem data erasure is implied. Use only disposable staging records in destructive smoke tests.

### Editorial governance
A draft brief can be approved or rejected exactly once by a client-scoped `manage_integrations` actor. Backend persists decision, authenticated profile and timestamp through a tenant-filtered PATCH constrained to `draft`; rejection requires meaningful explanation. Approval is not article generation, publishing or website mutation. Only a future separately authorized CMS workflow may publish after site ownership and content approval.

### SEO data portability boundary

Only users with an active `client_scoped` TAKATAK workspace plus both `view_dashboard` and `view_reports` may request per-site JSON export. The server-only Next route obtains a new short-lived signed JWT for the SEO service and verifies the requested site belongs to that workspace. The SEO backend itself checks the tenant and emits allowlisted, privacy-minimized columns. The snapshot explicitly says `guaranteedComplete:false` and is capped at 200 rows per collection; do not market it as a complete history, cross-product export, or proof of regulatory access-fulfillment. Download response is private/no-store.

### Whole workspace SEO data portability

Only current client-scoped TAKATAK users with `view_dashboard` and `view_reports` may request paged SEO exports. Data is fetched from `/v1/workspace/export` over the signed V1 server bridge. Four collections are individually navigable and downloads are `private, no-store`. Pagination is fixed at 200 records, ordered by database ID and carries `hasMore`/`nextOffset`. SQL SELECT allowlists omit DNS ownership challenge secrets and reviewer profile IDs. Changes during pagination can alter coverage; this is a user-readable export capability, not an immutable or regulatory-complete backup and not a modification to TAKATAK master identity.

## 2026-10-16 — SEO operational deletion audit within V1

TAKATAK V1 remains the identity/client/permission master. A new independent site-deletion receipt view is restricted by current client workspace and `manage_integrations` on the server. The SEO API separately requires signed `seo:manage`, which cannot be granted by a browser. The receipt list does not expose authenticated reviewer subjects, deleted hostname plaintext, secrets or other clients' records. Backend `seo_delete_site_with_receipt` is a single-transaction SECURITY INVOKER RPC (proposed SQL 0004) that records an operational receipt and FK cascade; PostgreSQL direct RPC access is limited to `service_role`. The UI does not assert regulator-certified erasure or completion of backup retention. A new V1 PR is required and coordinator approval/merge remains mandatory.

### PR #196 review readiness (2026-10-16)

A passing V1 full CI allows the feature PR to be marked ready for designated-coordinator review only. It does not authorize an automatic merge, alteration of TAKATAK V1 production environments or backend SQL migration. PR #196 SHA `90f8fdeef6ea499e99f796c3563cefa4f6c8a6e9` passed CI `38884438610`; production SEO remains blocked by Coolify and database owner approval.
