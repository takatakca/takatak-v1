# R2F phase 2 — TAKATAK opportunity lifecycle contract

Status: **offline contract and deterministic QA only**. Parent issue #160; Phase 1 intake is in open PR #163. This change does not depend on that unmerged branch, activate an endpoint, write to a database, or project opportunities to FLEXS/QMAPS.

TAKATAK is the system of record for lead, project/opportunity state, tenant, assignment, provenance and audit. R2F is the acquisition surface; FLEXS and QMAPS are downstream adapters, never competing masters.

## Internal lifecycle

`new → qualified → internal_candidate | partner_candidate → distributed → contacted → won → completed`

Alternate transitions: `new → cancelled`; `qualified → lost | cancelled`; `internal_candidate → contacted | lost | cancelled`; `partner_candidate → lost | cancelled`; `distributed → lost | cancelled`; `contacted → lost | cancelled`; `won → cancelled`.

The exact transition matrix is in `src/lib/integrations/r2f/opportunity-contract.ts`. `lost`, `completed` and `cancelled` are terminal. Same-state events are idempotent no-ops, not an instruction to republish or charge.

The pure helper **does not authorize any actor**. Before persisting a transition, the eventual TAKATAK service must authenticate the actor, resolve the actual lead and workspace on the server, enforce tenant membership, product entitlements and role permissions, compare expected state/version atomically, audit the change, persist an idempotency key, and publish an outbox event only after commit.

## Safe public projection

Only `{version:1, reference, status, updatedAt}` is returned by the projection builder. Reference must be an opaque 8–64 character alphanumeric/underscore/hyphen identifier; timestamp must be canonical UTC ISO 8601. This is **not** a public lookup endpoint or access grant.

| Internal state | Public status |
| --- | --- |
| `new` | `received` |
| `qualified`, `internal_candidate`, `partner_candidate` | `in_review` |
| `distributed` | `matched` |
| `contacted`, `won` | `in_progress` |
| `completed` | `finished` |
| `lost`, `cancelled` | `closed` |

Never expose internal routing, candidate identity, customer contact, lead/tenant IDs, partner bids, internal notes or event metadata. Even coarse status requires recipient authorization or a separately approved secure token mechanism.

## Implementation gates

1. Coordinator reviews Phase 1 PR #163 independently and resolves its conflicts.
2. Design durable opportunity storage and optimistic versioning; any migration requires owner approval.
3. Implement server-side tenant/role enforcement, durable idempotency, audit and outbox.
4. Build separately approved FLEXS projection and QMAPS discovery adapters; no child-to-child DB access.
5. Verify staging R2F → TAKATAK → adapters with synthetic records, tenant isolation and replay before any production activation.

Deterministic QA: `npm run qa:r2f-opportunity-contract`. No provider, migration or deployment action is included.
