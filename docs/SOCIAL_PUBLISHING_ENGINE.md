# Social publishing engine — Facebook Pages, Instagram and Bluesky

2026-11-06 — Claude Fable 5.1 @ Claude Code desktop (owner PC) — branch `p0/social-publishing-engine-20261106` (merged, PR #258)
2026-11-14 — Claude Fable 5.1 @ Claude Code desktop (owner PC) — Instagram publishing on the same contract (see "Instagram" below)
2026-11-14 — Claude Fable 5.1 @ Claude Code desktop (owner PC, side session) — Bluesky adapter on the same contract (branch `claude/awesome-poincare-bf9729`, PR #293)


Owner directive (2026-11-06, P0-C): deliver one reliable, verified official-provider
publishing path with scheduling, durable records and safe reconciliation, on top of
the existing `SocialPost` / `Approval` / `Job` models, without a second identity,
billing or connection system.

## What exists now

| Piece | Where | Status |
| --- | --- | --- |
| Reviewer decisions (approve / reject / request changes) | `src/lib/social/publishing/approval-actions.ts`, `POST /api/social/posts/[postId]/decision` | IMPLEMENTED AND TESTED (pure + service rules; real DB run pending) |
| Durable publication queue on the existing `Job` model | `src/lib/social/publishing/publication-jobs.ts` (`queueSocialPostPublication`, `claimSocialPublicationJob`) | IMPLEMENTED AND TESTED (in-memory DB; the raw-SQL lease claim mirrors `facebook-page-sync-job.ts` and runs only on PostgreSQL) |
| Facebook Page adapter (feed post, photo post, verify, reconcile) | `src/lib/social/publishing/facebook-page-publisher.ts` | IMPLEMENTED AND TESTED with a fake transport; **not yet VERIFIED LIVE** |
| Bluesky adapter (text post with link facets, verify, reconcile) | `src/lib/social/publishing/bluesky-publisher.ts`; provider switch in `publication-jobs.ts` | IMPLEMENTED AND TESTED with a fake transport and a fake session; **not yet VERIFIED LIVE** (no app review, no per-call cost) |
| Worker tick | `runSocialPublicationWorkerTick` wired into `GET/POST /api/cron/social-sync-jobs` and `scripts/run-social-sync-worker.ts` | IMPLEMENTED; production trigger is an owner step (below) |
| Publish now / schedule / cancel / receipt | `POST|DELETE|GET /api/social/posts/[postId]/publish` | IMPLEMENTED AND TESTED (route contracts) |
| UI actions on My tasks and Posts | `src/components/social/publication-actions.tsx`, `my-tasks-view.tsx`, `post-list.tsx` | IMPLEMENTED; browser QA pending |
| Per-connection capability profile (token health, granted/missing scopes, what works, what to do) | `src/lib/social/connections/capability-profile.ts`, `GET /api/social/connections/[connectionId]/capabilities`, strip in the Accounts manager | IMPLEMENTED AND TESTED (describes stored state; no provider call) |
| AI Studio handoff chooses the delivery account (defaults to a publish-ready Facebook Page) | `src/lib/ai/handoff.ts` (`chooseHandoffAccount`), Saved outputs card | IMPLEMENTED AND TESTED |
| Instagram adapter (container → status poll → media_publish → permalink, reconcile by caption) | `src/lib/social/publishing/instagram-publisher.ts` | IMPLEMENTED AND TESTED with a fake transport (2026-11-14); **not yet VERIFIED LIVE**; gated on `instagram_business_content_publish` |
| Instagram "Grant publishing" (incremental authorization on the existing connection) | `startInstagramPublishingAuthorization`, `POST /api/social/connections/[connectionId]/instagram/publishing`, button in the Accounts manager | IMPLEMENTED; browser QA pending; Meta app review of the permission is an owner step |
| Other networks (Threads, TikTok, YouTube, Pinterest, X, LinkedIn, Google Business) | — | NOT BUILT for publishing (connectors exist for OAuth, sync and analytics only); the capability profile states the exact missing scope or blocker per provider |


No Prisma schema change. Job type `approve_post` with `metadata.source = "social_publication_v1"`
is the publication delivery job; `PostStatus` keeps its existing values and the finer
delivery state lives in `SocialPost.metadata.publication` (the receipt).

## State machine

Post status (existing enum): `draft → pending_approval → approved → scheduled → published`, with `failed` and `blocked_by_plan`.

Delivery targets (`PUBLICATION_TARGETS` in `publication-model.ts`): `facebook → meta` (Page token) and `instagram → instagram` (Instagram Login user token). The receipt records both `platform` and `provider`; a receipt whose pair does not match is ignored. Adding a network is an additive entry here plus one adapter and one branch in `resolvePublishTarget`.

Receipt state (`metadata.publication.state`): `sending → confirmed | failed | uncertain | needs_reconnect`.

Rules enforced in code (`publication-model.ts`, re-checked under the job lease in `publication-jobs.ts`):

- Only `scheduled` posts on a publishable platform (`facebook`, `instagram`, `bluesky`; `isPublishablePlatform`) with a connected account are dispatched. The receipt records `provider` (`meta` | `instagram` | `bluesky`) and `platform` (`facebook` | `instagram` | `bluesky`); a receipt whose pair does not match is treated as absent.
- If the post has an Approval, its latest status must be `approved`.
- `blocked_by_plan` posts are never dispatched; workspace write access is re-evaluated at dispatch time through the existing billing lifecycle (`evaluateWorkspaceWriteAccess`).
- Facebook: the Page credential must come from the connection's encrypted payload (`readMetaFacebookPageCredential`), match the account's external id, and the connection must hold `pages_manage_posts`; otherwise the receipt is `needs_reconnect` and nothing is sent.
- Instagram: the credential is the Instagram Login user token in the `instagram` connection's encrypted payload; the connection must hold `instagram_business_content_publish`, the account must be the connection's selected `instagram_professional` account, and the post must carry exactly one public `https` media URL (`mediaUrls[0]`; `.mp4/.mov/.m4v` publishes as a Reel, anything else as an image). Instagram accounts linked through a Facebook Page (`meta` connection) are refused with an explicit message: publishing needs the direct Instagram Login connection.
- Bluesky: the account's `externalAccountId` must be a DID, the connection must be `connected` with scopes `atproto` and `transition:generic`, and the DPoP session is restored from the encrypted `BlueskyOAuthStore` (`createBlueskyOAuthClient(...).restore(did, "auto")`, which refreshes when due under the advisory lock). A session that cannot be restored, or an SDK token error (`TokenRefreshError`, `TokenRevokedError`, `TokenInvalidError`), is `needs_reconnect`; nothing is sent. There is no `SocialCredential` row for Bluesky; `social-connection-data.ts` counts the session store as the credential.
- Bluesky text: the request text is `composeBlueskyPostText(caption, link)` (caption, then the link on its own line when the caption does not already contain it), capped at 300 graphemes (`Intl.Segmenter`) and 3,000 UTF-8 bytes; `caption_too_long` blocks dispatch before any call. Links become `app.bsky.richtext.facet#link` facets with byte offsets. Media is not sent to Bluesky yet (blob upload is a follow-up).
- A `sending` receipt is written **before** the network call (optimistic concurrency on the post's metadata); a `sending`/`uncertain` receipt is reconciled **before any retry**: Facebook against the Page feed (same message, since attempt start minus 10 min), Instagram against the account's media list (`GET /{ig-user-id}/media?fields=id,caption,timestamp,permalink`, matching the canonical caption in the same window), Bluesky against `app.bsky.feed.getAuthorFeed` (same composed text, own posts only, reposts skipped, created since the same window). A found post becomes `confirmed`; an unavailable reconciliation stays `uncertain` and retries later; a not-found attempt may be retried with a new attempt id.
- Only a provider post id marks the post `published` (`confirmed` receipt, `publishedAt`): the Facebook post id, the Instagram media id, or the Bluesky record URI `at://did/app.bsky.feed.post/rkey` (verified with `com.atproto.repo.getRecord`; permalink `https://bsky.app/profile/<did>/post/<rkey>`).

- Retryable failures (rate limit, 5xx, network) back off exponentially (30 s → 15 min, max 3 attempts); permission/token/content errors fail immediately with the category in the receipt.
- One active job per post (`queued|running|retrying`), claims use `FOR UPDATE SKIP LOCKED`, finalization is scoped to the lease owner, expired leases are reclaimed by the claim query, exhausted ones are failed.

## Instagram (2026-11-14)

- **API.** Instagram API with Instagram Login on `graph.instagram.com`: `POST /{ig-user-id}/media` (`image_url` + `caption`, or `video_url` + `media_type=REELS`) → `GET /{container-id}?fields=status_code` until `FINISHED` (bounded: 12 polls × 5 s by default, injectable in tests) → `POST /{ig-user-id}/media_publish` (`creation_id`) → `GET /{media-id}?fields=id,permalink,timestamp`. Only `media_publish` can create a visible post, so only a transport failure there is `ambiguous`; container failures are retried without reconciliation. `ERROR`/`EXPIRED` containers fail as `invalid_content`; exhausted polling is a retryable `timeout`.
- **Limits enforced before dispatch.** Caption ≤ 2,200 characters (`INSTAGRAM_CAPTION_LIMIT`), one media URL required (`media_required` block reason), `https` only. The media must be publicly reachable by Meta; TAKATAK does not host or proxy media in this step.
- **Scopes.** New connections keep requesting `instagram_business_basic` + `instagram_business_manage_insights` only. "Grant publishing" (`POST /api/social/connections/[connectionId]/instagram/publishing`, `manage_social_accounts`) starts an incremental authorization with the `instagram_publishing` scope set (`buildInstagramAuthorizationUrl({ scopeSet })`); the callback stores the union of scopes on the connection and keeps the same professional account selected. The default scope set must not change until the owner confirms Meta approved `instagram_business_content_publish` in app review; until then only app testers/developers can grant it.
- **Capability profile.** `instagram.publish`/`schedule` are `available` when the scope is granted and a professional account is selected; `missing_scope` with action `grant_scope` (no reconnect) when the scope is missing; `select_account` when no account is selected.
- **Job.provider.** The `Job.provider` column is the generic `Provider` enum (no `meta`/`instagram` value), so publication jobs now store `internal`, as the Facebook Page sync job does. The previous `"meta"` value would have been rejected by PostgreSQL on the first real-database run.

## Permissions and entitlements

- Decision and publish routes require `approve_content` in the active workspace; reading a receipt requires `view_social`.
- Decisions require the approvals entitlement (`assertClientCanUseApprovals`); publish/schedule requires `assertClientCanScheduleSocialPost` (monthly post allowance, workspace lifecycle). The `SOCIAL_CONNECTION_SETUP_CLIENT_IDS` exemption applies through those existing gates; nothing here bypasses or widens it.
- All writes go through `readJsonBody` (same-origin check, JSON only, byte caps).

## Operations

- **Production trigger.** `docs/COOLIFY_DIRECT_PRODUCTION.md` states the production app runs one web container with no cron. Scheduled publications therefore need an external minute-level trigger of `GET https://takatak.ca/api/cron/social-sync-jobs` with `Authorization: Bearer <CRON_SECRET>` (Coolify scheduled task, or `npm run worker:social-sync` on a host with `DATABASE_URL`). "Publish now" processes its own job inline and does not depend on the trigger.
- **Logs.** `JobLog` rows per job (queued, blocked, published, reconciled, failures) without tokens or captions; structured `social-publish` log lines carry counts only.
- **Secrets.** The Page token and the Instagram user token travel in the POST body or an `Authorization` header, never in a URL, and are never logged. The Bluesky adapter never sees a token: requests carry only the XRPC method, query and JSON body, and the SDK session attaches the DPoP proof and access token (`createBlueskySessionTransport(session.fetchHandler)`). The AT Protocol SDK is imported lazily by the worker, only when a Bluesky post is dispatched.

## Verification labels

- `npm run qa:social-publishing` — checks for the pure model, the Facebook, Instagram and Bluesky adapters with fake transports, the worker with an in-memory DB, capability profile and source guards. In CI after the AI Studio handoff step.
- `npm run typecheck` on the branch — see WORKLOG for the exact result.
- VERIFIED LIVE: **not yet** for any provider. Required owner steps: (Facebook) on an authorized Page connected with publishing access, approve one test post, press Publish now, then confirm the `remotePostId` and `permalinkUrl` in the receipt match the post on the Page; (Instagram) submit `instagram_business_content_publish` for Meta app review (or test with an app tester account), press Grant publishing on the Instagram connection, approve one test post with one public image URL, press Publish now, confirm the media id and permalink in the receipt match the post on the account; (Bluesky) connect an owned Bluesky account (`BLUESKY_OAUTH_PRIVATE_JWK` set, scope `atproto transition:generic`), create a post with `platform = bluesky` on that account, approve it, press Publish now, then confirm the receipt's `remotePostId` (`at://…`) opens at the `permalinkUrl` on bsky.app. Record all in WORKLOG and the Drive dossier.


## Next steps (in order)

1. Live Facebook Page publication on the owner's Page (above) and a real-database run of the lease claim (`qa` step against the ephemeral CI database).
2. Studio → Social: send a Studio draft to the selected Facebook account with the existing handoff, then approve and publish through this engine (P0-D).
3. Instagram: owner app review + first live post (above).
4. Bluesky follow-ups: image posts (`com.atproto.repo.uploadBlob` + `app.bsky.embed.images`), external-link card embed, and letting `chooseHandoffAccount` treat a connected Bluesky account as publish-ready for Studio handoffs.
5. Threads on the same receipt/job contract with a separate adapter.
6. Calendar view with scheduled posts, bulk scheduling, per-network captions.

