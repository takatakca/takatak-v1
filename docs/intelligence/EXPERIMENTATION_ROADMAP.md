# TAKATAK Intelligence OS — experimentation foundation
Date: 2026-11-18. Source tracking: [issue #334](https://github.com/takatakca/takatak-v1/issues/334).
Signed: GPT-6 @ ChatGPT.

## Owner intent and scope
Extend **existing TAKATAK-V1** with agent-assisted website experimentation and continuous improvement, inspired by Optimizely's product direction. Do not clone proprietary code, replace TAKATAK AUTH, create a parallel client database or duplicate hosting. Delivery target is the existing real production deployment; **do not set up a staging environment**. Production safety gates (exact reviewed CI, operator backup, permissions, migration review where relevant, reversible rollout, served-SHA proof) remain in force.

## P0 implemented in this draft PR (source only)
- `src/lib/intelligence/experiment-allocation.ts` implements a pure server-only allocation policy and no outward effects.
- Feature enabled must be supplied explicitly as `true`; tenant identity is provided by authenticated server context; a foreign or absent client is denied.
- Experiment must be `running`, explicitly human-approved, first-party site ownership verified, visitor analytics consent present, subject ID a non-PII opaque UUID and a server-held HMAC secret present.
- Config validates client/experiment UUIDs, revision, 0–10000-bps rollout, 2–5 unique variants and exact 10000-bps weight total.
- Deterministic visitor allocation using HMAC-SHA256 over client+experiment+revision+anonymous visitor. Output has no subject or secret.
- No audit write, no visitor cookie, no event storage, no UI, no site mutation, no flag toggles, no provider spend, no billing and no database migration. Importing this module alone does not activate an experiment.
- Synthetic unit tests: `node --experimental-strip-types --test scripts/intelligence-experiment-allocation.test.mjs`. Enforced in `.github/workflows/ci.yml`.

## Existing systems to reuse
| Capability | Owner in the current codebase | Integration rule |
| --- | --- | --- |
| Active account and permissions | `src/lib/security/access-context.ts` | Derive active client on server; no client ID supplied by browser |
| Website ownership and provider connections | Existing website/SEO integration | Verify actual owned site before allocating or publishing |
| AI reasoning and generation | `src/lib/takbot/server.ts`, `src/lib/ai-providers/store.ts` | Reuse current provider router; AI proposes changes, not unauthorized actions |
| Billing/credits | `src/lib/ai-credits/ledger.ts` | Reuse approved debit/refund policy; no experiment billing until product entitlement is approved |
| Studio and File Organizer | Studio source + existing audited approvals | Apply compatible, separate approval UI and evidence history; never conflate file approval with site approval |
| Creative Intelligence / Social / SEO | Existing authorized client reporting | Read-only, tenant-scoped evidence; never claim cross-customer benchmark parity |
| KnowledgeAI | Pending connector/issuer work | Private retrieval only once its real authorization and deployment are independently verified |

## P1 — approved manual experiments
1. Data model `Experiment`, `ExperimentVariant`, `ExperimentApproval`, `ExperimentAssignment`, `ExperimentEvent` and `ExperimentAudit`, with workspace/site FK integrity, ownership checks and reviewed RLS. Do not apply real DB migrations before a verified protected production backup + review.
2. Server-only manager CRUD and lifecycle, explicit site/surface allowlist, separate author and approving actor, 409 revision checks; no arbitrary script injection or hidden paid third-party tags.
3. FR/EN, mobile-ready `/dashboard/intelligence/experiments`: drafts, approvals, controlled launch/pause/kill switch; no claimed live status without real deployment evidence.
4. First adapter only for a TAKATAK-managed, domain-verified page or CTA; prohibit other sites and external advertisers until reviewed integration exists.

## P2 — reliable results
- Generate/remember a pseudonymous, consent-aware assignment ID only in the verified host site; do not use emails, IPs or personally identifiable source keys.
- Persist sticky assignments with revision transition semantics defined before live traffic, especially after changing rollout weights.
- Validate exposure and goal events on the server, allowlisted goal IDs, dedupe, tamper controls, retention limits, traffic/budget caps, measurement window, exclusion bot rules, and consent withdrawal.
- Declare one primary metric before starting, report raw counts and credible confidence/uncertainty; add sample-ratio mismatch and overlapping-experiment checks. No misleading automatic winner based on tiny samples.
- Where attribution or conversions are unavailable, show `insufficient_data`, never invented percentages or revenue.

## P3 — AI growth agent and controlled optimization
- TAKBOT proposes draft variants from owner-approved website copy, existing SEO findings and Creative Intelligence reports, with source provenance and per-provider cost estimate.
- Existing credit ledger, quotas, tenant isolation, secure prompt/context boundaries, idempotency and ambiguous-retry safeguards remain mandatory.
- Human review before page edits, social publication, advertising spend, billing, domain/DNS or external provider changes.
- Continuous optimization = *monitor, suggest, obtain approval, test, measure, recommend*; self-execution limited to separately approved narrowly scoped low-risk actions.
- Roll back immediately on error; stop all experiments via server kill switch. Keep default OFF for every account not expressly opted in.

## Proof and release gate
P0 is a **non-executing source foundation**; do not label it deployed/live. P1+ requires exact-head full CI; real server-side tenant A/B checks, domain ownership, consent/permissions; reviewed backup+SQL gates; live authorized site events; correct conversion counts; Coolify deployed SHA proof; and rollback. No staging infrastructure requested by owner. Avoid any production action before its own gates are actually met.

Next development step: implement the tenant-owned schema and reviewer-approved lifecycle in a fresh incremental PR against current main, after independently reconciling #334 and active source changes. Do not expand P0 policy into user-facing behavior until approved assignment persistence and event tracking exist.
