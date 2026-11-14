# TAKATAKSTUDIO inside TAKATAK V1

2026-11-05 — STUDIO-ENGINE @ ChatGPT Work
Status: review candidate; not merged, deployed or activated.

## Owner direction

Offer Studio as a resellable multi-client SaaS, using TAKATAK V1 accounts, TAK-TAK and KnowledgeAI. Triple M (Macyna, Mariella, Matthys) is the owner's pilot, not a cast automatically shared with customers. Video, books and music are independent tracks of a shared creative brief.

## Verified reusable capabilities

| Responsibility | Existing source | Studio decision |
| --- | --- | --- |
| Customer/workspace authority | `src/lib/security/access-context.ts`, `workspace-api.ts` | Require real `client_scoped` access and `create_content`; derive client UUID server-side |
| AI engine/provider access | `src/lib/takbot/server.ts`, `relay.ts`, `src/lib/ai-providers/store.ts` | Call `runTakbot` server-side; do not export provider keys or create another provider store |
| Metering and refunds | `src/lib/ai-credits/ledger.ts` | Use existing write-mode action and ledger; scope operation key by production + track + caller request ID |
| Creative project storage | Prisma `SavedAiOutput` | Manual creative-brief record with versioned Studio metadata; no production migration |
| Generated draft persistence | Existing TAK-TAK output save + tenant-checked update | Link only the authenticated client's generated output to its production; preserve a successful result on link failure |
| Social approvals | `src/lib/ai/handoff.ts` | Existing mechanism remains; Studio text drafts are not automatically converted into videos or sent to arbitrary connected accounts |
| KnowledgeAI private context | Existing draft PRs #194/#195 | Preserve both for coordinator consolidation; do not invent a third issuer or claim private retrieval |
| External engine exchange | Studio request pack v1 | Import/export creative input; never import tenancy, billing, job completion, approvals or upload receipts |

## Implemented routes and workflow

- `/dashboard/studio`: account-scoped production workspace, new briefs/characters, JSON import/export, independently requested video scripts, book outlines and lyrics.
- `GET /api/studio/projects?offset=0`: 20 projects/page with pagination; latest 30 linked outputs across the workspace. Agent jobs are returned through the whitelist in `src/lib/studio/agent-jobs.ts` (id, status, scheduledFor, errorMessage, projectId, track, day, reconciliationRequired, hasRecoveryText): never operation, fingerprint, actorId, lease tokens or recovery text.
- `POST /api/studio/projects`: create an immutable creative brief under the authenticated workspace; manual provenance. At most 50 briefs per workspace per rolling 24 h (`project_daily_limit`, 429).
- `POST /api/studio/generate`: load owned non-archived Studio project, build a bounded prompt, call TAK-TAK in write mode, link resulting saved text draft. Existing credit charge/refund logic applies. An in-memory per-workspace limiter allows 6 requests per minute per process instance (`rate_limited`, 429 with `Retry-After`); see `docs/studio/COST_CONTROLS.md`.
- `POST /api/studio/agent`: queue a bounded plan. Per workspace: at most 2 open plans (`plan_limit`, 429) and a credit balance of at least one task price at queue time (`insufficient_credits`, 402; `balance_unavailable`, 503). The ledger still debits per task.
- `POST /api/studio/agent/reconcile` (`manage_jobs`): operator path that clears `reconciliationRequired` or a blocking failure code on one finished task after reviewing credit activity and saved outputs. It records operator, time and note on the job and never grants a second provider attempt.
- `GET|POST /api/cron/studio-agent` (exact `Authorization: Bearer <CRON_SECRET>`): one worker tick. Expired running leases (lease + 60 s grace) are finalized first without a provider call: `lease_expired_after_dispatch` blocks the production, `lease_expired_before_dispatch` releases it. Failures log only a category.
- The Studio UI is FR/EN (`src/lib/studio/i18n.ts`, language from `@/lib/website/i18n`); server codes are mapped to sentences and never shown raw; downloads carry only title, text, format and date.
- `/api/studio` and `/dashboard/studio` are registered as high-risk authentication paths to avoid authorizing with cached local sessions.
- All APIs use the existing no-store response, write-origin check and permission resolver.

`TAKATAK_STUDIO_ENABLED=true` is a deployment rollout flag, OFF by default. This is not a new product entitlement or billing plan. Before public resale, define the SKU/plan, allowances, per-workspace product grant, cost reservations/limits, asset retention/export and private KnowledgeAI access. The present guarded drafting workflow uses existing AI credits and create-content authorization only. It does not establish a Studio subscription.

## Shared exchange contract

`{studio:"TAKATAKSTUDIO",version:1,kind:"production_request_pack",project:{title,brief,language,audience},characters:[{name,profile}]}`

V1 accepts title ≤120 characters, brief ≤1000, audience ≤150, language en/fr, up to 3 distinct names ≤60 and profiles ≤250. Longer local packs are rejected for editing rather than silently truncated. The generated engine prompt must fit TAK-TAK's 4000-character bound before debit. Import is an explicit copy into the authenticated workspace, not a signed service grant, automatic synchronization or transfer of authority. A file can contain sensitive creative data; store/share it only as the customer authorizes.

## What remains separate

No private KnowledgeAI search, real video rendering, synthesized music, book layout/PDF proof, YouTube upload, KDP publication, unattended scheduler, service-to-service authentication or Studio product checkout is enabled here. No new credentials or paid resources were provisioned. No production schema was changed.

The owner asked both systems to collaborate. This first vertical slice connects the V1 customer flow to TAK-TAK and establishes tested two-way file exchange with TAKATAKSTUDIO. Continuous server-to-server job exchange remains the next phase, using the canonical V1 identity and a reviewed service-specific credential, not shared database credentials.

## Validation and review

- PASS: 11 direct Node contract/service tests (mock relay, no external requests or spend).
- PASS: pure Studio module strict TypeScript semantic checks using an already installed compiler.
- PASS: TS/TSX transpilation syntax checks for new UI/API modules; `git diff --check`.
- NOT RUN: complete V1 typecheck/build/lint, browser UI and real authenticated DB/provider E2E.
- Automatic approval review rejected `npm ci --ignore-scripts=false`, citing untrusted lifecycle scripts/dependency downloads and its read-only classification of the request. No alternate installation or remote CI workaround was used. Source commits carry `[skip ci]`; explicit user authorization for installation/full checks is needed before that blocked action is retried.
- Existing GitHub CI has a proposed additional focused test step, but no CI conclusion is claimed for this candidate.

## Release and next work

Review this isolated draft PR. After dependency checks are authorized, run full typecheck, lint, identity/access suites, Studio tests and production build on the exact candidate. Use synthetic two-client DB tests, verify output recovery and replay handling, and test mobile UI. Keep the rollout flag off until the exact revision and runtime configuration are verified. Coordinate the separate private KnowledgeAI PRs before adding confidential retrieval. Next build durable job leases, approved asset storage and render workers around this V1 control plane.


## Superseding design/agent checkpoint

The next source slice adds the redesigned interface, versioned manual scenes, Social caption track, bounded draft-agent queue/worker and selected-account Social approval handoff. Read [DESIGN_AGENT_CHECKPOINT.md](DESIGN_AGENT_CHECKPOINT.md) for current behavior, 19 passing focused tests, synthetic browser evidence and unresolved release gates. Earlier statements about missing browser testing and unattended scheduling describe the first slice; a worker route now exists but no scheduler is activated. External publication and private retrieval remain unavailable.
