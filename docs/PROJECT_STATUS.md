# TAKATAK V1 — SEO integration status (scoped report)

This document records work on SEOTAKATAK integration only. For all other V1 modules, consult `WORKLOG.md` and `docs/DEV-TODO.md`.

2026-10-15 — PR **#182** open (`feat/seotakatak-free-tools-20261015`). TAKATAK V1 retains exclusive identity / client authority. Public `/free-tools`, private `/dashboard/seo/free-tools`, portfolio, verified Google Search Console import, tenant-scoped site summary and CSV export have been implemented on the PR branch. The original V1 Growth Suite SEO audit and Social UI are unchanged.

**Not deployed**: this PR must be merged by the designated coordinator after CI, then promoted using V1's existing protected release procedure. The SEOTAKATAK API/database/HTTPS Coolify runtime is also not yet confirmed live. Provider-backed LLM citations and competitor/backlink metrics remain gated, not invented.

Update 2026-10-15: the separate SEOTAKATAK API reached green CI at `c1be583a`; its Coolify infrastructure blocker is tracked at `takatakca/SEOTAKATAK#1`. On the V1 PR branch, the signed evidence-summary/CSV integration and SEO-specific access tests were also added. Latest complete V1 build validation remains pending.

The SEO report now displays actual imported keyword rows with click/impression/position figures and a visibly labeled heuristic priority, besides the downloadable CSV. The backend Coolify deploy runner now compares the deployed commit to CI SHA, but no production SEO service is yet running to verify.

2026-10-15 update: editorial backlink prospect CRUD-lite workflow is present within each authorized site's report (create/list/update status). Only identified, researching, contacted and declined statuses are offered; links are not marked earned without provider verification. TypeScript CI found a duplicate permission import at commit `5a392d98`, corrected at `be53990e` and awaiting latest CI confirmation.

### Ownership verification (2026-10-15)

The approved PR branch now includes a manager-only DNS TXT verification card on each SEO site report. The backend issues a random 7-day TXT challenge and only confirms ownership when the exact live DNS record matches. This is a **pending integration**, not live proof: the separate backend needs approved `sql/0001_seo_core.sql` and `sql/0002_domain_verification.sql`, HTTPS Coolify and V1 runtime secrets before the card can work in production. No automatic CMS publishing is enabled.

### 2026-10-15 content briefs and latest CI correction

Client site reports now include an editorial content brief queue with an actual TAKATAK-signed server action that saves drafts into the existing SEOTAKATAK `seo_briefs` table. A brief cannot auto-publish or claim a live article; status is draft-only. The reviewer/approver and CMS publisher remain future deliverables. The first V1 CI pass after this feature hit a JSX unescaped-entity lint error; corrected at `4f70342cb30efd5316a054e93c17cd3c76204b98`. Final full CI must be rechecked. Backend rate limiting and schema-aware readiness pass on backend SHA `c1d7861f` (run `38799814574`); production not deployed.
