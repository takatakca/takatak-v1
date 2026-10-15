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
