# Studio agent cost controls

2026-11-05 — STUDIO-ENGINE — Codex

The existing V1 provider store, TAK-TAK relay and AI credit ledger remain the
authorities. Studio introduces no account registry, credential store or billing
ledger. No provider generation, account creation, subscription purchase or
publication was performed to validate this source candidate.

## Customer credits and provider expense

The customer's plan quote is in **TAKATAK retail credits**, read from the existing
write action in the central catalogue. A provider's currency expense is separate.
The credit-pack catalogue labels its cash prices as draft; a plan quote does not
establish realized revenue, supplier cost or profit. Do not equate one TAKATAK
credit with one provider credit or report an invented margin.

`src/lib/studio/cost-policy.ts` exports `quoteStudioPlanCost`. Given the selected
formats, days, central per-draft retail price and customer credit ceiling, it
counts one writer task per format/day. It supports at most four collaborators
sharing those outputs, 28 provider tasks and seven days. A collaborator count is
a planning limit, not an implementation of parallel provider agents. Review and
planning roles cannot silently multiply model calls or retail charges. Extra
provider work must appear in a new bounded plan for review.

The queue uses this quote, returns it in `costPlan` and stores the provider task
limit and unknown supplier cost status on its existing Job metadata. It reserves
no credits. The existing worker still rechecks authorization, current retail
price and available central credits for each task. A plan's ceiling is not a
global account spending reservation.

## Configured cost-aware selection

`cheapestStudioRoute` ranks only eligible, available, exact engine/model routes
with audited unit rates in the requested currency. Rates need a version,
official HTTPS source, verification time, expiry and confirmation that the
estimate includes all billable request units. Verification expires after seven
days at the latest. Unknown, stale, incomplete, wrong-currency and over-budget
quotes cannot be selected. A missing quote never means free usage.

The estimator rounds upward using integer currency micros, bounded input/output
tokens and a fixed request allowance. Its caller must account for cache-write
premiums, reasoning tokens, model-specific minima and other charges in audited
rates/bounds. It must enforce the selected model and token limits at execution.
The helper is for bounded text requests, not an invented video/audio price card.
No live routing was changed to use these helpers: configured rate evidence is
not available in this session. Existing TAK-TAK Auto is a preference order, not
proof that the chosen provider is the cheapest.

Routes marked as escalation require a server-verified approval naming the exact
route, rate version and expense ceiling. Approval is evidence supplied by V1,
not a boolean accepted from an imported brief or customer-provided model result.
The cheapest eligible ordinary route remains preferred. This policy never
authorizes tool execution, purchases, publishing or a new account.

## Metering and reconciliation

The companion central relay change retains available provider-reported token
usage (including cached/reasoning units where supplied), the requested model
alias, central retail credits and a stable request ID. The requested model alias
is not proof of the exact returned model version. Missing usage remains unknown,
not zero. Supplier cost stays unreconciled until a valid model-specific rate and
provider billing evidence can be joined. A token counter alone is not an invoice
or margin calculation.

Central debit/refund keys continue to prevent duplicate credit mutations. They
do not make a remote request safe to repeat. An ambiguous billable operation is
held for evidence review; never regenerate to repair a missing output link.

## Scoped artifact reuse

`studioReuseKey` and `reusableStudioArtifact` permit only exact matches of the
server-derived client, project, brief digest, brief version, format and task
revision. The stored artifact must be completed, identified and unarchived.
Changing a character profile, source brief or task must produce a new digest or
revision. The caller must load the artifact through a tenant-filtered query and
recheck current read permission before reuse. These helpers are matching policy,
not a cross-client cache or a grant of ownership/publication rights.

The matching helpers are not connected to automatic artifact retrieval or
reuse in this candidate. There is no automatic reuse billing change. Reused drafts
should be shown as existing outputs with their original provenance; do not
silently pretend a new provider request occurred. Any future charge for another
service must use the existing central catalogue and a transparent customer quote.

## Verified scope

Twelve focused Node tests cover fan-out limits, retail budgets, unknown margins,
upward rounding, stale/unknown costs, cheapest eligible selection, explicit
escalation and cross-client/revision reuse refusal. These are pure policy tests
with synthetic rate fixtures, not evidence of actual supplier pricing, live
provider savings, commercial rights or operational multi-agent orchestration.

— STUDIO-ENGINE — Codex

## Per-workspace limits and recovery (2026-11-14 audit follow-up)

`src/lib/studio/limits.ts` is pure and tested by `scripts/studio-limits-tests.mjs`.

- **Open plans:** a workspace may hold at most two plans whose tasks are still
  queued or running (`openStudioPlanCount` counts distinct operations). A third
  plan is refused with `plan_limit` (429) across all of its productions, so one
  tenant's queue cannot starve the shared FIFO.
- **Balance precheck:** `queueStudioPlan` reads the central credit balance and
  refuses a plan when it is below one task price (`insufficient_credits`, 402)
  or unreadable (`balance_unavailable`, 503). This reserves nothing; the ledger
  still debits each task when the worker dispatches it.
- **Projects per day:** `POST /api/studio/projects` allows 50 briefs per
  workspace per rolling 24 hours (`project_daily_limit`, 429).
- **Generate limiter:** `POST /api/studio/generate` uses an in-memory,
  fixed-window limiter of 6 requests per workspace per minute. It lives in one
  process: every instance counts separately and a restart resets it. It is a
  burst brake on top of the credit balance, not a billing control, and it is
  not shared state the ledger depends on.

### Lease recovery and refusals

The worker (`src/lib/studio/worker.ts`) writes `dispatchedAt` on the running
job before calling TAK-TAK. If `finish()` fails or the function is killed, the
next tick finalizes any running job whose lease expired more than 60 seconds
ago without another provider call: with `dispatchedAt` the job fails as
`lease_expired_after_dispatch` and keeps the production blocked
(`reconciliationRequired`); without it the job fails as
`lease_expired_before_dispatch` and the production is released. Refusals TAK-TAK
returns before any debit (`insufficient_credits`, `no_engine_connected`,
`unknown_engine`, `engine_mode_mismatch`, `unknown_mode`, `mode_not_inline`,
`project_not_found`, `brief_too_large_for_engine`) are retained on the job but
no longer block the production. Post-debit relay failures and replay codes still
require reconciliation because a refund can itself fail.

### Operator path

`POST /api/studio/agent/reconcile` (`manage_jobs` in the active workspace,
body `{jobId, note}`) clears the block on one finished task after the operator
has checked credit activity and saved outputs. The job keeps its status and
error history (`reconciled_<code>`), records who/when/why, and never receives a
second provider attempt. The customer-facing listing never includes the held
recovery text; it reports `hasRecoveryText` so the operator knows to look.
