# TAKATAK Social Manager + Studio — current-state gap assessment

2026-11-06 — Claude Fable 5.1 @ Claude Code desktop (owner PC). Evidence is the
source at main `52290cda` plus Studio draft PR #256 (`bb80d0cc`). Labels follow the
owner's scale: VERIFIED LIVE / IMPLEMENTED AND TESTED / PARTIAL / BLOCKED / NOT BUILT.

## 1. What exists and works in TAKATAK Social (main)

| Capability | Evidence | Label |
| --- | --- | --- |
| OAuth connections for Meta (Facebook Pages), Instagram Login, Threads, Google (YouTube, Business Profile), TikTok, Pinterest, X, Bluesky (AT Protocol + DPoP), Twitch, web/blog, Meta Ads, Google Ads, Looker Studio | `src/lib/social/providers/*-oauth.ts`, `src/app/api/social/callback/*`, `SocialProviderConnection` + encrypted `SocialCredential` (AES-GCM, AAD bound to client/connection/provider) | IMPLEMENTED AND TESTED (qa:social-* suites); live status per provider is not recorded in the repo |
| LinkedIn | `providers/registry.ts` `implemented: false, connectable: false` | NOT BUILT |
| Facebook Page selection with capability classification (`canPublish` = `pages_manage_posts` + `CREATE_CONTENT` task + Page token) | `providers/meta-pages.ts`, `connections/social-facebook-page-service.ts` | IMPLEMENTED AND TESTED |
| Facebook Page analytics + content sync with durable Job leases | `sync/facebook-page-sync-job.ts`, cron `/api/cron/social-sync-jobs` | IMPLEMENTED AND TESTED (CI ephemeral DB) |
| TikTok, Twitch, Bluesky, Google Business, Meta Ads analytics reads | `providers/*-analytics.ts`, `/api/social/*/analytics` | IMPLEMENTED (read-only) |
| X cost control (fail-closed guard, idempotency key contract, cost catalog) | `providers/x-cost-control.ts`, `X_COST_CONTROL.md` | IMPLEMENTED AND TESTED; `X_PAID_API_ENABLED` must stay off |
| Posts, approvals, campaigns, calendar pages | `src/app/dashboard/social/*` | PARTIAL: lists only; before this branch no approve/reject or publish action existed anywhere (`grep approval.update` = none) |
| Subscription entitlements, `SOCIAL_CONNECTION_SETUP_CLIENT_IDS` exemption by workspace UUID (`client-name:uuid` accepted since PR #257) | `src/lib/billing/social/*`, `docs/WORKSPACE_BILLING_EXEMPTION_2026-11-05.md` | IMPLEMENTED AND TESTED |
| Review reputation cockpit with Google review-reply publication, leases and receipts | `src/lib/reputation/review-publisher.ts` (merged 2026-11-06) | IMPLEMENTED AND TESTED; live deployment pending per WORKLOG |

**Publishing to any social network: NOT BUILT before this branch.** No provider
publishing adapter and no publishing worker existed under `src/lib/social`.

## 2. What exists and works in Studio (PR #256, flags off)

- Creative briefs, four text formats (video script, book, lyrics, social caption), scene editor with optimistic revisions, server-side Library search, bounded daily draft agent (one-attempt worker, 28-task cap, credit ceiling), Social handoff that creates one `SocialPost` + `Approval` without publishing. 70 focused tests pass; full `npm run typecheck` passes (run on this machine on 2026-11-06, which the previous agent could not do).
- Branch is 4 commits behind main with a WORKLOG-only conflict.
- Known issues from the audit (to fix in a follow-up on that branch): raw Job metadata exposed to members via `GET /api/studio/projects`; cron route is POST-only while schedulers issue GET; a failed `finish()` leaves a job `running` forever and blocks new plans; no per-workspace rate limit on `/api/studio/generate`; UI is English-only with hard-coded strings; cost-policy helpers are not wired to runtime.
- Real media rendering, SONGER automation, YouTube upload and KDP export: NOT BUILT (by design, documented).

## 3. Connectors with genuine publishing capability (after this branch)

| Provider | OAuth | Publish scope requested | Publish code | Label |
| --- | --- | --- | --- | --- |
| Facebook Pages | yes | `pages_manage_posts` (in `META_OAUTH_PAGE_SCOPES`) | **this branch** (feed + photo, verify, reconcile) | IMPLEMENTED AND TESTED → needs one live post to become VERIFIED LIVE |
| Instagram (Login API) | yes | `instagram_business_content_publish` not in `INSTAGRAM_OAUTH_START_SCOPES` (insights only) | none | BLOCKED on incremental scope + container/publish adapter |
| Threads | yes | `threads_content_publish` not requested | none | NOT BUILT |
| YouTube | yes (read-only identity/analytics scopes) | `youtube.upload` not requested | none | BLOCKED on incremental auth + resumable upload |
| TikTok | yes | `video.publish` not requested; app under review (`docs/TIKTOK_PRODUCTION_REVIEW_2026-11-01.md`) | none | BLOCKED on TikTok audit |
| Pinterest | yes | `pins:write` requested | none | NOT BUILT (adapter) |
| X | yes | `tweet.write` deliberately excluded (`x-oauth.ts` comment) | none | BLOCKED by cost policy (owner decision) |
| Bluesky | yes (DPoP) | createRecord needs no extra scope | none | NOT BUILT (good second candidate: free, no review) |
| Google Business Profile | yes (`business.manage`) | local posts possible | none | NOT BUILT |
| LinkedIn, Twitch | no / n-a | — | — | NOT BUILT / unsupported |

## 4. Connected for authentication or read access only

Instagram, Threads, YouTube, TikTok, Twitch, Google Business, Meta Ads, Google Ads,
Looker Studio, web, blog. Their tokens, scopes and expiry are stored on
`SocialProviderConnection` + `SocialCredential`. The per-connection capability
profile (token health, granted/missing scopes, publish/analytics/inbox state and the
action to enable it) now ships on this branch in
`src/lib/social/connections/capability-profile.ts`, is returned with every
connection summary, exposed at `GET /api/social/connections/[id]/capabilities`,
and rendered on the Accounts manager (P0-B first slice; it describes stored
state and does not call providers).

## 5. What must be repaired or authorized to publish professionally

1. Owner: trigger the cron route in production (Coolify scheduled task) and run one live Facebook Page publication.
2. Instagram: add `instagram_business_content_publish` as an incremental scope on the existing Instagram Login flow; adapter with container polling; media must be a public HTTPS URL (asset storage decision).
3. YouTube: incremental `youtube.upload`, resumable upload, quota accounting.
4. TikTok: complete the app audit; until then publishing is private-only.
5. Capability profile per connection surfaced in the Accounts screen (what each account can do, what is missing, how to fix it).

## 6. Files, services and database changes

- New: `src/lib/social/publishing/{publication-model,facebook-page-publisher,publication-jobs,approval-actions}.ts`, `src/app/api/social/posts/[postId]/{decision,publish}/route.ts`, `src/components/social/publication-actions.tsx`, `scripts/verify-social-publishing.ts`, `docs/SOCIAL_PUBLISHING_ENGINE.md`.
- Changed: cron route and ops worker (publication tick), My tasks data/view, Posts list/page, `PostSummary`, `package.json`, `ci.yml`.
- Database: **no migration**. Job type `approve_post` + `metadata.source`, receipt in `SocialPost.metadata.publication`.

## 7. How Studio, Social Manager, TAK-TAK and billing communicate

TAKATAK V1 workspace (`activeClientId`) → `BusinessBrand` → `SocialAccount` (via `SocialProviderConnection`) → Studio draft (`SavedAiOutput`, metered by the central AI credit ledger through `runTakbot`) → `handoff` creates `SocialPost` + `Approval` → reviewer decision (`approve_content`) → `queueSocialPostPublication` (entitlement `assertClientCanScheduleSocialPost`) → `Job` lease → Facebook adapter → receipt with provider post id → Posts/My tasks UI. Identity, permissions and billing stay in V1; Studio and the publishing engine own no credentials and no ledger.
