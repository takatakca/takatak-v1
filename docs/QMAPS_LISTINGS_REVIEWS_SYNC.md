# QMAPS → TAKATAK listings and reviews sync (contract v1)

QMAPS is a TAKATAK child application and the **source of truth** for its businesses and reviews.

- It pushes signed events to TAKATAK V1. V1 never calls QMAPS.
- V1 shows the data in the linked client's `/dashboard/local-listings` and **Reviews** dashboard.
- Pattern: child app → TAKATAK V1 only, never sibling-to-sibling (see knowledgeAI `docs/10-ECOSYSTEM-INTEGRATION-MAP.md`).

## Endpoint

`POST https://takatak.ca/api/integrations/qmaps/events`

| Header | Value |
| --- | --- |
| `Content-Type` | `application/json` |
| `x-integration-id` | must equal V1 `QMAPS_SYNC_CLIENT_ID` |
| `x-event-id` | the body `eventId` |
| `x-timestamp` | Unix seconds; must be within 5 minutes of V1 time |
| `x-signature` | `sha256=` + hex HMAC-SHA256 of `{x-timestamp}.{eventId}.{rawBody}` with `QMAPS_SYNC_WEBHOOK_SECRET` (32+ chars, QMAPS-only) |

The body is limited to 64 KB.

## Events

Common envelope:

```json
{
  "eventId": "<uuid, unique per event>",
  "eventType": "BUSINESS_UPSERTED | REVIEW_UPSERTED | REVIEW_DELETED",
  "sourceApplication": "QMAPS",
  "schemaVersion": 1,
  "occurredAt": "<ISO-8601>"
}
```

`BUSINESS_UPSERTED` adds `business`:

```json
{ "id": "<qmaps businesses.id>", "name": "…", "category": "…|null",
  "phone": "…|null", "website": "…|null", "address": "…|null", "city": "…|null",
  "region": "…|null", "postalCode": "…|null", "country": "CA|null",
  "avgRating": 4.6, "reviewsCount": 27, "isActive": true, "isClaimed": true }
```

`REVIEW_UPSERTED` adds `review`:

```json
{ "id": "<qmaps reviews.id>", "businessId": "<qmaps businesses.id>", "rating": 1-5,
  "body": "…|null", "reviewerDisplayName": "First name + initial|null",
  "createdAt": "<ISO-8601>" }
```

`REVIEW_DELETED` adds `review: { "id", "businessId" }`.

**Never send:**

- reviewer account ids, emails or phones (`user_id`, `reviewerEmail`, …)
- owner user ids
- tokens or secrets

Payloads that contain them are rejected with 400.

## Responses

| Status | Meaning | QMAPS action |
| --- | --- | --- |
| 200 `status: PROCESSED` | Applied to the linked workspace | mark delivered |
| 200 `status: UNLINKED` | Business not linked to any TAKATAK workspace yet; logged, nothing changed | mark delivered |
| 200 `duplicate: true` | Same event already processed | mark delivered |
| 400 | Invalid payload | dead-letter, fix sender |
| 401 | Signature, credential, timestamp or event-id mismatch | dead-letter, check secrets/clock |
| 409 | Event id reused with a different payload | dead-letter |
| 413 / 415 | Too large / not JSON | dead-letter |
| 503 (`Retry-After`) | V1 disabled or temporarily unavailable | retry with backoff |

## Tenant linking

A QMAPS business affects TAKATAK data only after a TAKATAK administrator links it to a client workspace:

```
npm run qmaps:link -- --client <takatak-client-uuid> --business <qmaps-business-uuid> --name "Business name"
```

- Linking is idempotent and audited (`qmaps_business_linked`).
- A business already linked to another workspace is refused.
- Reviews always land in the workspace of the linked listing, and a review id can never move between workspaces.

## V1 configuration

```
QMAPS_SYNC_ENABLED=true
QMAPS_SYNC_CLIENT_ID=<shared integration id>
QMAPS_SYNC_WEBHOOK_SECRET=<32+ char secret, also set on the QMAPS sender>
```

The database migration `20261006120000_qmaps_listing_review_external_ids` adds nullable `externalId` columns, unique per provider. It is additive only.

## Verification

- `npm run qa:qmaps-sync` (runs in CI): 12 checks covering:
  - signatures (valid, disabled, forged, stale, tampered)
  - the parser, including identity-leak rejection
  - sentiment
  - unlinked isolation
  - listing refresh
  - review upsert and delete
  - cross-business isolation
  - replay and conflict
  - log minimization
- Manual, on a throwaway PostgreSQL 16:
  - the migration applied on top of the current `main` schema, re-ran safely, and `prisma migrate diff` reported no difference from the new schema
  - With `next start` in production mode, these were exercised over HTTP:
    - a linked business update
    - 2-star and 5-star reviews (sentiment negative/positive, correct workspace)
    - replay (`duplicate: true`)
    - an unlinked business (`UNLINKED`, nothing written)
    - a wrong secret, tampered body, wrong app credential and event-id mismatch (401)
    - a reviewer `user_id` leak (400)
    - a review deletion (archived)

## Still to build

- **QMAPS side:** outbox table + database triggers on `businesses` / `reviews` + a drain function that signs and sends these events, with retry (same pattern as Rentauto's `takatak-sync-outbox`).
- **Admin UI** for linking (today: the CLI script above).
- **Review replies** from TAKATAK back to QMAPS (requires a QMAPS-side API).
