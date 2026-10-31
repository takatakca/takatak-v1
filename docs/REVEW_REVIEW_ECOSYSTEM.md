# TAKATAK V1 review cockpit amplification

2026-10-31 — REVEW, review/reputation specialist

## BEFORE

Read current V1 main 35c62f0, AGENTS/work log/PR titles, public agent board foodhubca#105, knowledgeAI integration standards and ecosystem-map branch, TAKATAKREVIEW issue #2/Yelp reference, existing V1 review/Google/QMAPS/AI/billing code, QMAPS main 6e73f0f, and FLEXS flexsca main. Google Drive is not callable in this session; GitHub-mirrored connector notes were read without pretending access to the referenced Drive files.

## DURING

The implementation enhances `/dashboard/growth/reviews` in the master application. A bounded, tenant-scoped read projection combines existing `ReviewResponse`, `ExternalReview` and `ListingReview` tables without schema changes or a second identity/database/billing system. Related profile/location/listing ownership is checked in the queries. Archived, planned and demo listing rows are excluded. Partial failures and truncation are explicit, not fabricated complete synchronization.

The cockpit adds search, source/status/rating/time filters, loaded-window metrics, CSV exports, source-specific response controls, confirmed QMAPS response status and server-derived AI draft requests using the existing workforce/credit/approval pipeline. Feedback follow-up and lead conversion remain in the existing workflow. Twelve platform capability records distinguish native V1 features, counterpart APIs, provider approvals and social-only surfaces. Instagram comments are not star reviews; recommendations are never converted into invented scores.

Private API: `GET /api/reputation/cockpit`; requires an actual client-scoped session with `view_reputation`. It never accepts a client ID from a query/body/header. JSON/CSV are private and no-store; the CSV is an explicit loaded window of at most 200 records per store, with unavailable/truncated markers, and spreadsheet-formula neutralization. Publication consent and provider display rights are not expanded by this private projection.

QMAPS reply handling now requires a stored workspace-owned QMAPS row and exact source-review ID mapping before the remote call. Remote success requires a positive matching acknowledgement, not HTTP 200 alone; redirects carrying a service credential are refused. Existing source metadata is retained. The QMAPS counterpart still needs its own tenant/scoped API checks as recorded in the handoff.

## Counterpart notes published

- QMAPS: https://github.com/takatakca/qmaps/blob/revew/review-api-handoff/docs/TAKATAK_REVIEW_API_HANDOFF.md
- FLEXS: https://github.com/takatakca/flexsca/blob/revew/review-api-handoff/docs/TAKATAK_REVIEW_API_HANDOFF.md

Both are documentation-only branches with work-log and handoff updates. They request versioned, authenticated business/review APIs; FLEXS additionally receives the owner-requested scoped lead-summary API requirements. Actual keys must be provisioned securely by each service; no keys, customer lead data or private documents belong in the notes. Complete pagination applies to all authorized records in the caller's workspace, never a global cross-tenant export. QMAPS/FLEXS exchange goes through TAKATAK V1; existing child source ownership and contact/unlock consent remain intact.

## Provider evidence and remaining access

Primary documentation links are in `src/lib/reputation/sources.ts`. The current environment blocks provider documentation hosts with HTTP proxy 403. Domain additions were saved in the environment draft without replacing existing allowed domains. Saving has not applied them. Current API products/scopes/licensing and source account access remain to be reverified from the official docs and authorized accounts before implementing or enabling missing vendor adapters. No universal Facebook/Yelp/Tripadvisor/Instagram management API is claimed. Existing source registration is not API approval.

## Notes, email and scheduling status

The owner explicitly requested GitHub and Google Drive notes throughout and a 30-minute email-thread read/write routine using the name REVEW. GitHub branch notes are real. Matching copies are retained at `/workspace/review-reference/drive-ready/`. **Drive NOT UPLOADED; Gmail thread NOT READ; recurring task NOT SCHEDULED**: neither connector nor scheduling tools are exposed, including after the Gmail plugin tag. Do not infer an activated tool from another agent's inventory. No bot email, external customer message, provider reply or payment was sent.

## Release boundary

Feature branch only. V1 coordinator retains merge/deploy authority. No new Prisma migration, production setting, deployment, main push or customer-data movement. See WORKLOG for executed checks and exact blockers. — REVEW

## Local validation checkpoint

15 cockpit checks, 4 existing QMAPS bridge checks and 13 existing QMAPS sync checks passed. Changed review source lint passed. Native V1 foundation screen returns HTTP 200; the private feed returns HTTP 403 without a scoped session. Full client generation and Growth-wide validation are blocked locally by the Prisma engine host returning proxy 403; checksum verification was never disabled. A focused non-deploying GitHub Actions workflow will generate the real client, run checks/typecheck/lint and build on the feature branch. Authenticated live provider/DB acceptance remains distinct. — REVEW
