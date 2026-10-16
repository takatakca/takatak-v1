# CUBAFOOD ↔ TAKATAK master contract — Issue #161

**Status: contract + offline verification only. No live CUBAFOOD API route, token, database migration, identity linking, source registration or production activation.**

Scope: `takatakca/cubafoodca` remains the operational application. `takatakca/takatak-v1` is the centralized identity and authorization authority. This document does not assert approval by any public authority or consent from an applicant.

## Version 1: permitted opaque events

Module: `src/lib/integrations/cubafood/contract.ts`. A valid event is a small JSON object using **only** these eight fields; extra fields are rejected, not stored:

```json
{
  "schema_version": 1,
  "source_application": "cubafood",
  "event_id": "91a26ee4-3d6e-4796-a95d-d8cf46940527",
  "event_type": "participant.registered",
  "aggregate_type": "participant",
  "source_tenant_ref": "project-canada-cuba",
  "aggregate_ref": "participant-opaque-104",
  "occurred_at": "2026-10-15T12:00:00Z"
}
```

Supported mappings:

| Event | Aggregate |
| --- | --- |
| `participant.registered` | `participant` |
| `participant.status_changed` | `participant` |
| `partner.interest_submitted` | `partner` |
| `lead.created` | `lead` |
| `lead.status_changed` | `lead` |

All references must be nonempty, ≤160 characters and opaque (alphanumeric leading character, followed by letters, digits, `._:-`). `event_id` is a UUID. Timestamps are explicit UTC ISO 8601 strings. No payload field for name, email, phone, address, notes, medical data, immigration status, identity credentials, document contents, account passwords, payment details, government status or raw application answers is permitted. CUBAFOOD retains those within its own authorized application and data policy.

**Never treat `source_tenant_ref` as a TAKATAK client ID.** It is an untrusted CUBAFOOD external reference, which a future server route must resolve through a **pre-approved, unique mapping** to an authorized TAKATAK workspace.

## Proposed service authentication (not active)

A dedicated server-to-server credential `TAKATAK_CUBAFOOD_HMAC_SECRET` (at least 32 UTF-8 bytes, not created or supplied in GitHub source) is required for any future receiver. Do not reuse `TAKATAK_1LV_API_KEY` or a global TAKATAK secret.

The future request uses exactly three signed headers:

- `X-Cubafood-Timestamp`: current Unix time in whole seconds
- `X-Cubafood-Nonce`: cryptographically random URL-safe value, 16–128 characters
- `X-Cubafood-Signature`: lowercase hex HMAC-SHA256 of the canonical string below

Canonical string is UTF-8 and uses newline separators:

```text
v1
<unix-timestamp>
<nonce>
<lowercase-hex-sha256-of-exact-raw-request-body>
```

The pure `signCubafoodRequest` and `verifyCubafoodSignature` functions define and test these bytes. A signature is accepted only within ±300 seconds of current server time; an absent/short key fails closed. The function **does not prevent replay**: the eventual receiver **MUST atomically reserve a unique `(source_application, nonce)` pair in persistent storage** before side effects, with retention longer than the timestamp window. Event `event_id` must be unique per source and a retry with identical payload must return the previous result; differing payloads for the same ID must be rejected. The HMAC must authenticate the unchanged raw request bytes, before JSON parsing.

A bounded raw-body reader is also required (suggested maximum 8 KiB), JSON media type only, body hash matching the signed bytes, and generic errors without leaking signatures or user information.

## Authorization and ownership gates before enabling any endpoint

1. Owner confirms CUBAFOOD is a registered first-party source application with the correct target TAKATAK client, approved environment and product entitlement. Each business or program mapping is explicit and unique.
2. CUBAFOOD and TAKATAK each configure a dedicated shared key outside source control. Staging and production use **different** keys, and key rotation has an agreed runbook.
3. On each request, the server enforces: HMAC; timestamp; atomically unique nonce; supported event type; mapped source-tenant; active product entitlement; valid unmodified JSON; idempotent event ID. Never trust source-provided roles, client IDs or payment state.
4. CUBAFOOD identity linking is **separate** from these server events. It must begin with a signed-in TAKATAK Supabase Auth session plus an explicit user-consented, short-lived single-use link grant scoped to the intended CUBAFOOD account and client. A server event alone can never assert that an external participant is an existing TAKATAK person.
5. TAKATAK stores only opaque source/tenant/event/authorized relationship references and minimal audit metadata; CUBAFOOD owns private applications, projects, recruiter notes, documents, operational history and deletion/retention operations.
6. The future CUBAFOOD receiver must have its **own** route and auth; existing `/api/v1/events`, merchant, and identity endpoints remain **strictly 1LV-only**. Never loosen the existing source checks to implement this contract.
7. Mandatory contract tests: valid signed staging request, wrong source secret, missing secret, stale/replayed nonce, cross-tenant ref, missing entitlement, unverified identity-link, invalid payload, duplicate event ID with identical and changed bodies, absent DB, and accepted event with only opaque references.
8. Carry out data-protection, consent, retention, deletion and incident-response reviews before enabling any applicant/participant exchange.

## Current evidence and next task

`npx tsx scripts/cubafood-master-contract-tests.ts` tests the pure event schema and signature proof; it does **not** test a live CUBAFOOD server integration. Once the owner approves the tenant/product mapping, data governance and dedicated credentials, implement the server receiver with a persisted replay ledger and referential authorization, add staging isolation integration tests, and only then allow a CUBAFOOD sender to connect.

No production environment variables, API keys, Supabase tables, or deployments were modified by this contract PR.
