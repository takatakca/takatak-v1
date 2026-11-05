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
