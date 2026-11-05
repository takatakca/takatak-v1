# TAKATAKSTUDIO design and agent checkpoint

2026-11-05 — STUDIO-ENGINE — Codex
Status: source review candidate; flags off; no production deployment or provider spend.

## Client experience

A navy/blue creative workspace has three primary views: Create, Productions and Your Agent. Video, Book, Music and Social use one creative brief. Optional character profiles stay customer-specific. The video scene editor saves an optimistic revision, with up to eight scenes and 180 seconds total. Artwork is an interface illustration, not generated footage. Brief JSON import/export remains explicit file exchange.

## Existing systems reused

| Capability | Authority and implementation |
| --- | --- |
| Identity and permissions | V1 workspace access; current membership checked again for each worker task |
| Provider credentials and Ollama | TAK-TAK existing provider store and central routing; no copied keys; trial routing still applies |
| AI costs | Existing write-credit debit/refund ledger; explicit formats × days budget; reject changed unit cost |
| Production storage | Existing SavedAiOutput; scene metadata revisions; no new database schema |
| Scheduled drafts | Existing Job model; deterministic operation/task IDs; one active plan per production |
| Social handoff | Existing connected SocialAccount, SocialPost and Approval; selected account and workspace entitlement |
| KnowledgeAI | Existing private integration drafts remain for consolidation; no confidential retrieval claimed |
| Training | Academy course `takatakstudio`, six practical lessons; no separate customer login or payment |

## Agent contract and operations

POST /api/studio/agent creates bounded daily draft tasks for 1–7 days, at most four formats. Replayed request IDs reuse the same operation; changed parameters with that ID conflict. Plans do not reserve prepaid credits, buy credits or auto-top-up. Each task still requires available central credits. A plan is a maximum task count and per-task price check, not a global account spending lock.

POST /api/cron/studio-agent processes one due step per authenticated tick. Both TAKATAK_STUDIO_ENABLED=true and TAKATAK_STUDIO_AGENT_ENABLED=true are required. CRON_SECRET must be at least 20 characters and sent as an exact Bearer token. Both flags default off. No scheduler has been installed or activated. Queueing is possible before runner setup; the UI says so. Daily due times are 24-hour intervals from creation, not a local time-zone calendar.

The worker atomically claims a queued task and verifies current authorization and approved write price. Each task has maxAttempts=1. Expired running tasks and ambiguous failures are held for reconciliation; never automatically reclaim them or click Generate to repair a link. Inspect central credit events and Saved AI Outputs using the stable request ID first. Successful content normally exists once; recovery text is retained on the job only when the central save returned no saved ID. Resolve held tasks manually after evidence review. No automatic retry or cancellation interface is delivered in this candidate.

POST /api/studio/scenes rejects stale revisions. POST /api/studio/handoff serializes output/account handoff and creates a pending Social post plus approval once. It does not call an external publishing API. The existing connections code did not contain a complete verified native publishing worker. Text-only captions cannot be treated as uploaded Instagram or YouTube media.

## Validation

PASS: 19 focused Node tests for parsing, boundaries, foreign-workspace refusal, central engine/meter propagation, output recovery, request IDs and Social review eligibility. These are pure/service tests with fake dependencies; they do not prove database concurrency or runtime provider delivery.

PASS: Internal browser fixture using the actual bundled Studio component with synthetic records: Create and Productions navigation, editing/saving scenes, agent form with Ollama selection and two queued draft tasks. Secure random-ID fallback corrected HTTP-preview compatibility. No real auth, customer records, billable requests or platform publishing used.

Pending: complete framework typecheck, lint/build and authenticated two-workspace database tests; task-claim and Social replay races; changed authorization, insufficient credits, storage interruption and real worker timing; phone visual QA and accessibility review. Automatic approval review previously rejected dependency installation citing lifecycle scripts/downloads and read-only classification. No alternate installer or remote CI workaround was used. Source-only commits retain [skip ci]. Prior green CI on older commits is not evidence for these changes.

## Next release gates and product work

Review exact source and validate the pending checks. Coordinate the private KnowledgeAI issuer drafts before private retrieval. Choose and verify asset storage/render workers for actual video, audio generation and typeset book output; retain commercial rights/provenance. Finish the native Social publishing adapter/worker, permissions, media validation and publication receipt reconciliation before offering automatic posting. Amazon/KDP delivery is not enabled. Define Studio SKU, tenant grants, retention and usage allowances before public resale.

Source work is additive and preserves existing identity, billing and Social connection authorities. Customer briefs must not be copied into public KnowledgeAI or repository notes.
