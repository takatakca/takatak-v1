# Social publishing engine — Facebook Pages first

2026-11-06 — Claude Fable 5.1 @ Claude Code desktop (owner PC) — branch `p0/social-publishing-engine-20261106`

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
| Worker tick | `runSocialPublicationWorkerTick` wired into `GET/POST /api/cron/social-sync-jobs` and `scripts/run-social-sync-worker.ts` | IMPLEMENTED; production trigger is an owner step (below) |
| Publish now / schedule / cancel / receipt | `POST|DELETE|GET /api/social/posts/[postId]/publish` | IMPLEMENTED AND TESTED (route contracts) |
| UI actions on My tasks and Posts | `src/components/social/publication-actions.tsx`, `my-tasks-view.tsx`, `post-list.tsx` | IMPLEMENTED; browser QA pending |
| Per-connection capability profile (token health, granted/missing scopes, what works, what to do) | `src/lib/social/connections/capability-profile.ts`, `GET /api/social/connections/[connectionId]/capabilities`, strip in the Accounts manager | IMPLEMENTED AND TESTED (describes stored state; no provider call) |
| AI Studio handoff chooses the delivery account (defaults to a publish-ready Facebook Page) | `src/lib/ai/handoff.ts` (`chooseHandoffAccount`), Saved outputs card | IMPLEMENTED AND TESTED |
| Other networks (Instagram, Threads, TikTok, YouTube, Pinterest, X, Bluesky, LinkedIn, Google Business) | — | NOT BUILT for publishing (connectors exist for OAuth, sync and analytics only); the capability profile states the exact missing scope or blocker per provider |

No Prisma schema change. Job type `approve_post` with `metadata.source = "social_publication_v1"`
is the publication delivery job; `PostStatus` keeps its existing values and the finer
delivery state lives in `SocialPost.metadata.publication` (the receipt).

## State machine

Post status (existing enum): `draft → pending_approval → approved → scheduled → published`, with `failed` and `blocked_by_plan`.

Receipt state (`metadata.publication.state`): `sending → confirmed | failed | uncertain | needs_reconnect`.

Rules enforced in code (`publication-model.ts`, re-checked under the job lease in `publication-jobs.ts`):

- Only `scheduled` Facebook posts with a connected, selected Page are dispatched.
- If the post has an Approval, its latest status must be `approved`.
- `blocked_by_plan` posts are never dispatched; workspace write access is re-evaluated at dispatch time through the existing billing lifecycle (`evaluateWorkspaceWriteAccess`).
- The Page credential must come from the connection's encrypted payload (`readMetaFacebookPageCredential`), match the account's external id, and the connection must hold `pages_manage_posts`; otherwise the receipt is `needs_reconnect` and nothing is sent.
- A `sending` receipt is written **before** the network call (optimistic concurrency on the post's metadata); a `sending`/`uncertain` receipt is reconciled against the Page feed (same message, since attempt start minus 10 min) **before any retry**. A found post becomes `confirmed`; an unavailable reconciliation stays `uncertain` and retries later; a not-found attempt may be retried with a new attempt id.
- Only a provider post id marks the post `published` (`confirmed` receipt, `publishedAt`).
- Retryable failures (rate limit, 5xx, network) back off exponentially (30 s → 15 min, max 3 attempts); permission/token/content errors fail immediately with the category in the receipt.
- One active job per post (`queued|running|retrying`), claims use `FOR UPDATE SKIP LOCKED`, finalization is scoped to the lease owner, expired leases are reclaimed by the claim query, exhausted ones are failed.

## Permissions and entitlements

- Decision and publish routes require `approve_content` in the active workspace; reading a receipt requires `view_social`.
- Decisions require the approvals entitlement (`assertClientCanUseApprovals`); publish/schedule requires `assertClientCanScheduleSocialPost` (monthly post allowance, workspace lifecycle). The `SOCIAL_CONNECTION_SETUP_CLIENT_IDS` exemption applies through those existing gates; nothing here bypasses or widens it.
- All writes go through `readJsonBody` (same-origin check, JSON only, byte caps).

## Operations

- **Production trigger.** `docs/COOLIFY_DIRECT_PRODUCTION.md` states the production app runs one web container with no cron. Scheduled publications therefore need an external minute-level trigger of `GET https://takatak.ca/api/cron/social-sync-jobs` with `Authorization: Bearer <CRON_SECRET>` (Coolify scheduled task, or `npm run worker:social-sync` on a host with `DATABASE_URL`). "Publish now" processes its own job inline and does not depend on the trigger.
- **Logs.** `JobLog` rows per job (queued, blocked, published, reconciled, failures) without tokens or captions; structured `social-publish` log lines carry counts only.
- **Secrets.** The Page token travels in the POST body or an `Authorization` header, never in a URL, and is never logged.

## Verification labels

- `npm run qa:social-publishing` — 20 checks (pure model, adapter with fake transport, worker with in-memory DB, source guards). Added to CI after the AI Studio handoff step.
- `npm run typecheck` on the branch — see WORKLOG for the exact result.
- VERIFIED LIVE: **not yet**. Required owner step: on an authorized Facebook Page connected with publishing access, approve one test post, press Publish now, then confirm the `remotePostId` and `permalinkUrl` in the receipt match the post on the Page. Record the result in WORKLOG and the Drive dossier.

## Next steps (in order)

1. Live Facebook Page publication on the owner's Page (above) and a real-database run of the lease claim (`qa` step against the ephemeral CI database).
2. Studio → Social: send a Studio draft to the selected Facebook account with the existing handoff, then approve and publish through this engine (P0-D).
3. Instagram professional accounts (container → publish, public media URL), then Threads, using the same receipt/job contract and separate adapters.
4. Calendar view with scheduled posts, bulk scheduling, per-network captions.
