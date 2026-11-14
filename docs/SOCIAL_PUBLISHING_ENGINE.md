# Social publishing engine — Facebook Pages and Bluesky

2026-11-06 — Claude Fable 5.1 @ Claude Code desktop (owner PC) — branch `p0/social-publishing-engine-20261106` (merged, PR #258)
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
| Other networks (Instagram, Threads, TikTok, YouTube, Pinterest, X, LinkedIn, Google Business) | — | NOT BUILT for publishing (connectors exist for OAuth, sync and analytics only); the capability profile states the exact missing scope or blocker per provider |

No Prisma schema change. Job type `approve_post` with `metadata.source = "social_publication_v1"`
is the publication delivery job; `PostStatus` keeps its existing values and the finer
delivery state lives in `SocialPost.metadata.publication` (the receipt).

## State machine

Post status (existing enum): `draft → pending_approval → approved → scheduled → published`, with `failed` and `blocked_by_plan`.

Receipt state (`metadata.publication.state`): `sending → confirmed | failed | uncertain | needs_reconnect`.

Rules enforced in code (`publication-model.ts`, re-checked under the job lease in `publication-jobs.ts`):

- Only `scheduled` posts on a publishable platform (`facebook`, `bluesky`; `isPublishablePlatform`) with a connected account are dispatched. The receipt records `provider` (`meta` | `bluesky`) and `platform` (`facebook` | `bluesky`); a receipt whose pair does not match is treated as absent.
- If the post has an Approval, its latest status must be `approved`.
- `blocked_by_plan` posts are never dispatched; workspace write access is re-evaluated at dispatch time through the existing billing lifecycle (`evaluateWorkspaceWriteAccess`).
- Facebook: the Page credential must come from the connection's encrypted payload (`readMetaFacebookPageCredential`), match the account's external id, and the connection must hold `pages_manage_posts`; otherwise the receipt is `needs_reconnect` and nothing is sent.
- Bluesky: the account's `externalAccountId` must be a DID, the connection must be `connected` with scopes `atproto` and `transition:generic`, and the DPoP session is restored from the encrypted `BlueskyOAuthStore` (`createBlueskyOAuthClient(...).restore(did, "auto")`, which refreshes when due under the advisory lock). A session that cannot be restored, or an SDK token error (`TokenRefreshError`, `TokenRevokedError`, `TokenInvalidError`), is `needs_reconnect`; nothing is sent. There is no `SocialCredential` row for Bluesky; `social-connection-data.ts` counts the session store as the credential.
- Bluesky text: the request text is `composeBlueskyPostText(caption, link)` (caption, then the link on its own line when the caption does not already contain it), capped at 300 graphemes (`Intl.Segmenter`) and 3,000 UTF-8 bytes; `caption_too_long` blocks dispatch before any call. Links become `app.bsky.richtext.facet#link` facets with byte offsets. Media is not sent to Bluesky yet (blob upload is a follow-up).
- A `sending` receipt is written **before** the network call (optimistic concurrency on the post's metadata); a `sending`/`uncertain` receipt is reconciled **before any retry**: Facebook against the Page feed (same message, since attempt start minus 10 min), Bluesky against `app.bsky.feed.getAuthorFeed` (same composed text, own posts only, reposts skipped, created since the same window). A found post becomes `confirmed`; an unavailable reconciliation stays `uncertain` and retries later; a not-found attempt may be retried with a new attempt id.
- Only a provider post id marks the post `published` (`confirmed` receipt, `publishedAt`): the Facebook post id, or the Bluesky record URI `at://did/app.bsky.feed.post/rkey` (verified with `com.atproto.repo.getRecord`; permalink `https://bsky.app/profile/<did>/post/<rkey>`).
- Retryable failures (rate limit, 5xx, network) back off exponentially (30 s → 15 min, max 3 attempts); permission/token/content errors fail immediately with the category in the receipt.
- One active job per post (`queued|running|retrying`), claims use `FOR UPDATE SKIP LOCKED`, finalization is scoped to the lease owner, expired leases are reclaimed by the claim query, exhausted ones are failed.

## Permissions and entitlements

- Decision and publish routes require `approve_content` in the active workspace; reading a receipt requires `view_social`.
- Decisions require the approvals entitlement (`assertClientCanUseApprovals`); publish/schedule requires `assertClientCanScheduleSocialPost` (monthly post allowance, workspace lifecycle). The `SOCIAL_CONNECTION_SETUP_CLIENT_IDS` exemption applies through those existing gates; nothing here bypasses or widens it.
- All writes go through `readJsonBody` (same-origin check, JSON only, byte caps).

## Operations

- **Production trigger.** `docs/COOLIFY_DIRECT_PRODUCTION.md` states the production app runs one web container with no cron. Scheduled publications therefore need an external minute-level trigger of `GET https://takatak.ca/api/cron/social-sync-jobs` with `Authorization: Bearer <CRON_SECRET>` (Coolify scheduled task, or `npm run worker:social-sync` on a host with `DATABASE_URL`). "Publish now" processes its own job inline and does not depend on the trigger.
- **Logs.** `JobLog` rows per job (queued, blocked, published, reconciled, failures) without tokens or captions; structured `social-publish` log lines carry counts only.
- **Secrets.** The Page token travels in the POST body or an `Authorization` header, never in a URL, and is never logged. The Bluesky adapter never sees a token: requests carry only the XRPC method, query and JSON body, and the SDK session attaches the DPoP proof and access token (`createBlueskySessionTransport(session.fetchHandler)`). The AT Protocol SDK is imported lazily by the worker, only when a Bluesky post is dispatched.

## Verification labels

- `npm run qa:social-publishing` — 37 checks (pure model, Facebook and Bluesky adapters with fake transports, the session transport with a fake `fetchHandler`, worker with in-memory DB for both providers including timeout → reconcile, capability profile, source guards). In CI after the AI Studio handoff step.
- `npm run typecheck` on the branch — see WORKLOG for the exact result.
- VERIFIED LIVE: **not yet** for either provider. Required owner steps: (Facebook) on an authorized Page connected with publishing access, approve one test post, press Publish now, then confirm the `remotePostId` and `permalinkUrl` in the receipt match the post on the Page; (Bluesky) connect an owned Bluesky account (`BLUESKY_OAUTH_PRIVATE_JWK` set, scope `atproto transition:generic`), create a post with `platform = bluesky` on that account, approve it, press Publish now, then confirm the receipt's `remotePostId` (`at://…`) opens at the `permalinkUrl` on bsky.app. Record both in WORKLOG and the Drive dossier.

## Next steps (in order)

1. Live Facebook Page publication on the owner's Page (above) and a real-database run of the lease claim (`qa` step against the ephemeral CI database).
2. Studio → Social: send a Studio draft to the selected Facebook account with the existing handoff, then approve and publish through this engine (P0-D).
3. Bluesky follow-ups: image posts (`com.atproto.repo.uploadBlob` + `app.bsky.embed.images`), external-link card embed, and letting `chooseHandoffAccount` treat a connected Bluesky account as publish-ready for Studio handoffs.
4. Instagram professional accounts (container → publish, public media URL), then Threads, using the same receipt/job contract and separate adapters.
5. Calendar view with scheduled posts, bulk scheduling, per-network captions.
