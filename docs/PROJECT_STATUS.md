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

## Latest SEO data-lifecycle update — 2026-10-15

PR #182 now provides a functional, server-validated "Remove this SEO site" action in the portfolio. It requires the manager permission, an active tenant, the exact hostname typed by the operator and a separate checkbox, then calls the signed SEOTAKATAK API DELETE route. The SEO API enforces tenant ownership and cascade-deletes its own keywords, backlink prospects and content drafts through migration 0001's foreign-key rules. TAKATAK master client/company records are **not** deleted. Backend code commit `6308c81f` passed CI `38841219269`. The V1 PR's initial CI discovered a JSX punctuation lint error, repaired in `417edac2`; final updated CI outcome must be verified separately. Nothing is deployed in production yet.

### Human editorial decision workflow (2026-10-15)

V1 PR #182 now displays real SEO brief review forms in each client-owned site portfolio, with manager-only action and backend `PATCH /v1/sites/:siteId/briefs/:briefId/review`. Managers may approve for further editorial planning or reject with a meaningful review note. The API records authenticated actor and timestamp but not in public list JSON. No approved brief is a published article. SQL 0003 must be approved/applied after 0001 and 0002 before production readiness passes; this is **not deployed**. V1 code SHA `3c891263` and CI need verification.

## SEO customer data portability (2026-10-15)

PR #182 now offers `Export site SEO data (JSON)` in an authenticated client's site report. A server-only TAKATAK bridge checks active client membership, `view_dashboard` and `view_reports`, verifies the site belongs to the current workspace, then obtains a signed, tenant-scoped SEO API snapshot. The Next route `/api/seo/sites/[siteId]/snapshot.json` sends a private/no-store attachment without exposing the signed backend JWT or secret. The backend allowlists fields to exclude DNS challenge tokens, reviewer internal actor IDs and future unrecognized columns. Explicit 200-row-per-category caps mean this is a **bounded snapshot**, not a complete workspace or regulatory data export. Backend feature SHA `24b2c1b4` CI `38843705978` passed. Newest V1 CI still requires final verification, and nothing has been deployed.

## Paged workspace SEO export — 2026-10-15

PR #182 now includes `/dashboard/seo/exports` and `/api/seo/workspace/export/[collection]`. An authenticated user with active TAKATAK `client_scoped` workspace and `view_reports` can select sites, Search Console opportunities, editorial backlink prospects or content briefs, then download successive private JSON pages of up to 200 records. Backend returns `hasMore` and `nextOffset`, validates collection and offset, filters tenant based on the signed server JWT, and requests an allowlist of safe database fields. The browser never receives the signing secret. Users must collect all pages; changes between pages can cause inconsistent coverage and **this is not a transactionally consistent account backup or a full TAKATAK cross-product export**. Backend SHA `fd0ff79f` CI `38844277527` passed; newest V1 CI status needs final confirmation. No production data exported during development.

## 2026-10-16 — SEO deletion receipt dashboard (PR #196, not merged)

A separate feature branch `feat/seotakatak-deletion-receipts-20261016`, [PR #196](https://github.com/takatakca/takatak-v1/pull/196) **draft**, extends the already merged SEO portfolio with a manager-only `/dashboard/seo/deletions` page. The server-only `getSeoDeletionReceipts` bridge accepts only a validated API path and a TAKATAK `client_scoped` workspace with `view_dashboard` plus `manage_integrations`. Requests are signed for the active tenant and return only receipt UUID, deleted site UUID, timestamp and deleted SEO child-row counts; the backend restricts `actor_subject` to its database. The page expressly says these operational receipts are not certified full erasure across TAKATAK products. No production SEO service is online: backend new SQL `0004_site_deletion_receipts.sql` has only been tested on disposable PostgreSQL, and Coolify secrets/approved database remain missing. **Do not merge/deploy without designated V1 coordinator authorization and green full CI.**

### PR #196 complete CI milestone (2026-10-16)

The deletion receipts V1 branch `90f8fdeef6ea499e99f796c3563cefa4f6c8a6e9` passed full GitHub CI run `38884438610`, including SEO contract tests, typecheck, lint, webpack and project validations. PR #196 was explicitly marked **ready for review** but remains open/unmerged; only the V1 coordinator may merge and deploy. The independent backend SEO source `b41eae7f` passed CI `38885243320`, but its Coolify production job failed and migration 0004 is not applied live. No production SEO receipts were verified.
