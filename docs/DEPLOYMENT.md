# SEO integration release — TAKATAK V1

This is a **SEO-scope supplement**. The general release runbooks remain `docs/TAKATAK_PRODUCTION_PROMOTION.md`, `docs/TAKATAK_V1_ENVIRONMENT_MATRIX.md` and `WORKLOG.md`.

1. Review PR #182 after its CI completes. **Do not merge or deploy V1** from another agent: the coordinator owns approval, migration gates and production promotion.
2. Deploy and verify the separate `takatakca/SEOTAKATAK` Node/Coolify service under its own approved database/release gate. Its `/ready` must prove DB connectivity.
3. Configure only in the V1 server runtime `SEOTAKATAK_API_URL` (trusted HTTPS origin) and `SEOTAKATAK_SIGNING_KEY` (same secret as SEO service, >=32 chars). Never put these in `NEXT_PUBLIC_*`, source or browser.
4. Existing Google integration needs `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` and client verified domain-linked Search Console property grants. No new OAuth user authority.
5. Coordinator promotes the validated V1 release. Smoke: unauthenticated tool redirects to TAKATAK login; client A sees only its sites and CSV; client B cannot read A by URL guessing; viewer cannot manage; linked verified GSC import works; unlinked GSC import fails safely; V1 other SEO pages remain functional.
6. Confirm actual V1 and SEO service running SHAs from release records. Until both have been checked, the integration is NOT live.

External requirements (no guessed values): Coolify application/token, approved DB/migration and V1 coordinator authority.

### New domain-ownership schema gate

Backend `sql/0002_domain_verification.sql` must be reviewed and applied in the authorized SEOTAKATAK DB **after** `sql/0001_seo_core.sql`. Test /v1/sites/:id/verification, /start and /check through the V1 workspace. The DNS host is `_seotakatak.<registered-domain>`, the TXT value is `seotakatak-verify=<random-token>`. Pending/incorrect/expired TXT must never appear as verified. The V1 forms must remain visible only to managers and must report unavailability truthfully before schema/runtime readiness. No V1 database migration is introduced by this feature.

### Additional V1 QA before coordinator promotion

Test content briefs for authorized client A (create + list, draft-only). Ensure client B cannot read/write A's site by changing siteId and read-only users cannot submit content briefs. The form must never claim that a draft was published. Recheck latest full V1 CI run after the `4f70342c` lint fix. SEO backend production `/ready` now checks migrations 0001 and 0002; Coolify still requires operator-provided environment settings.

### SEO site deletion smoke (approved staging only)

After backend Coolify and database approval, test the new portfolio's "Remove this SEO site" form on a disposable owned test site. Wrong domain and unchecked consent must fail; manager from another workspace must not see or delete it; authorized deletion must remove that site's SEO opportunities, prospects and briefs while leaving the TAKATAK identity intact. The `SEOTAKATAK` backend has mock/HTTP tests but **no approved production DB migration or deployed proof** yet. V1 PR #182 remains coordinator-only release.

### SEO editorial review release gate

Backend schema now proposes SQL `0003_brief_editorial_review.sql` (after 0001 and 0002). Apply solely to owner-approved existing/non-billable staging database first. Verify `/ready` rejects missing review columns, one draft can be approved/rejected only once, another tenant's manager receives no write access, and reviewed_by profile ID stays server-only. V1 PR #182 remains coordinator-only merge/release. Human approval does not automatically publish content.

### SEO site JSON snapshot smoke

After an approved backend database/HTTPS deployment and coordinator-approved V1 PR merge, sign in as client A with `view_reports`. In `/dashboard/seo/portfolio/{siteId}` download the JSON snapshot. Validate `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, `format:seotakatak-site-snapshot`, `coverage.guaranteedComplete:false`, up-to-200 collection caps, and no `verification_token` or `reviewed_by`. A read-only import token, anonymous browser or client B must not retrieve client A data. The snapshot does not include TAKATAK master account records or all SEO history. No live data was exported during development.

### Paginated workspace SEO JSON export smoke

On an approved staging-only SEO backend with migrations and current client A/B accounts, visit `/dashboard/seo/exports` under client A and `view_reports` permission. Download every page of sites, opportunities, prospects and briefs from `/api/seo/workspace/export/[collection]?offset=N`, following `nextOffset` only while `hasMore=true`; verify private/no-store headers, no reviewer IDs/DNS secrets and no rows belonging to B. A viewer lacking `view_reports` must not access export UI or route; an import-only backend token must be forbidden. When there are more than 200 rows, verify the second page continues correctly and no response exceeds its fixed page limit. No live export, migration or deployment is claimed.

### SEO deletion receipts release gate — PR #196

V1 only supplies the authorized UI/bridge; the SEO API is a separately deployed Docker service. The owner must first approve an existing/non-billable Supabase project and migrations 0001→0002→0003→0004, configure a Coolify HTTPS app and GitHub production vars/secrets, and verify the backend `/ready` on the exact commit. The PR #196 manager dashboard at `/dashboard/seo/deletions` may merge/deploy only via TAKATAK V1's designated coordinator after complete CI. In approved staging: confirm viewer denied, another client B sees no A receipts, fake/invalid offsets rejected, and an authorized manager sees actual receipt counts after deleting a disposable test site. It is an operational log, not an erasure compliance certificate. Do not run SQL against TAKATAK's master identity database or publish a fake receipt.

### Latest release status (2026-10-16)

PR #196 full branch CI passed: SHA `90f8fdeef6ea499e99f796c3563cefa4f6c8a6e9`, run `38884438610`; the PR is open and ready for V1 coordinator review, not merged. The SEOTAKATAK backend main SHA `b41eae7f4981f325668065ce4fc4e7e3a5860710` passed CI `38885243320`, but Coolify deploy `38885295728` failed. Owner-approved SQL 0004 and live /ready plus two-tenant staging deletion audit are still mandatory.
