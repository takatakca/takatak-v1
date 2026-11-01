# TAKATAK Review — operator workflow

Signed REVEW · 2026-11-01

## Working paths

Open `/dashboard/growth/reviews` in an authorized workspace. The native TAKATAK shell now provides four focused sections:

- **Inbox:** select a review, filter by source/location/date/status, inspect ratings and source-location performance, request the existing AI workflow, and deliberately publish through an authorized native Google/QMAPS action. Existing generated Google drafts are prefilled; queued requests are not generated output.
- **Requests & activity:** create tracked requests and inspect the latest 50 sending/engagement records. Provider API acceptance does not mean delivery. Email/shared links sent outside TAKATAK have no automatic receipt. First-party ratings are not proof of a public Google/Facebook review.
- **Import reviews:** enter extracted fields from an authorized email notification, add a review manually, or preview a CSV batch. A confirmation is required before saving. Maximum 50 rows/128KB. Create an active real Local Listing first; up to 200 listings are listed. Required CSV headers: `source,externalId,text,reviewedAt`; optional `author,rating,url`. Dates must be real timezone-qualified ISO timestamps. Facebook recommendations are never assigned star ratings.
- **Connections:** existing Google controls, source capabilities and messaging configuration. The source directory is not proof of connected accounts.

## Import integrity

Imports write to existing `ListingReview` storage in one transaction with a count-only audit. Tenant and related brand ownership are rechecked on the server. Stable tenant/listing/source/review IDs make retries idempotent; existing records are skipped, not overwritten. Do not import an API-synced review manually expecting cross-path reconciliation. No automatic URL fetch, inbox access, source publishing or API verification occurs. Imported reviews have explicit provenance, remain excluded from verified-source rating aggregates and cannot invoke provider publishing. Only source-pinned HTTPS evidence links are exposed. Never paste an entire mailbox, customer list or private email into this form.

Source locations use persisted IDs, so identically named branches are not merged. Different providers' listings are not automatically mapped to one physical establishment. Unlinked records remain distinct. Statistics/CSV describe the loaded window; per-store limits and failures remain explicit.

## Verified infrastructure candidates

Research was performed against accessible official GitHub sources. Birdeye/Google/YouTube and several vendor sites remain blocked by environment HTTP policy; no Birdeye dashboard/video was inspected.

| Vendor | Verified contract | Activation limits |
| --- | --- | --- |
| Yext | [Pinned official OpenAPI](https://github.com/yext/openapi/blob/9e55313c1e1144146445ca4d7183affdd8f14474/json/knowledgeapi.json): GET `/v2/accounts/{accountId}/reviews`, API-key header, exact `entityIds`, required version, page token and limit100. Review webhooks documented separately. | Credentials, subscription, publisher coverage and location mapping required. Date integer units need confirmation; fractional stars must not be silently rounded. Comments/202 acceptance do not prove a public owner response. Not activated here. |
| Vendasta | [Official Reputation spec](https://github.com/vendasta/api-gateway-docs/blob/25b6acd5c7e74e3a20a4f8a3b6fd8d3f9e748055/openapi/reputation/reputation.yaml): review lookup and response suggestions. [Customer Voice request guide](https://github.com/vendasta/api-gateway-docs/blob/25b6acd5c7e74e3a20a4f8a3b6fd8d3f9e748055/docs/Guides/CustomerVoice/SendReviewRequest.md): template/customer/location-based email/SMS requests. | Trusted Tester restrictions, OAuth scopes and active product/add-on. Guide/spec disagree on path/filter/author fields; provider contract test required. No general public-response endpoint verified. Not activated here. |
| GatherUp / Podium | Official SDKs establish authenticated business/organization/messaging primitives. | Reviewed SDK evidence alone does not establish current review-read/reply coverage, wholesale rights or pricing. |
| Birdeye / Reputation / Reviewshake / Reviewflowz | Candidates for a full product/wholesale demonstration. | No current account contract, verified visual comparison or runtime integration established in this session. |

One official [Vendasta Customer Voice screenshot](https://github.com/vendasta/api-gateway-docs/blob/25b6acd5c7e74e3a20a4f8a3b6fd8d3f9e748055/docs/Guides/CustomerVoice/images/edit-template.png) was inspected: template management, review-site selection and default/edit actions. This is not evidence of Birdeye parity. No exhaustive list of all Canadian review providers is claimed.

## Validation and release

Run `npm run qa:review-cockpit`, `npm run qa:review-import-model`, `npm run qa:review-import-service`, QMAPS bridge/sync checks and changed-boundary lint. CI generates the real Prisma client, runs full typecheck and production build. No migration added. Local fake-store tests verify scoped writes/failure propagation; they do not prove a production PostgreSQL rollback or live provider delivery. Browser fixtures use synthetic records and stub server actions; native foundation checks do not substitute for an authenticated production acceptance test.

Release coordinator reviews/merges/deploys. Dedicated provider credentials, authorized account setup, real database and configured AI worker are still needed for live operations. This is an operational product increment, not a claim of feature parity with Birdeye.

GitHub note saved with source. Matching Drive-ready copy retained locally, NOT UPLOADED (no Drive connector). No Gmail session or recurring background task is active.
