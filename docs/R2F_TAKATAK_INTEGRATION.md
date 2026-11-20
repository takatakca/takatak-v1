# R2F RAPIDE2FIX -> TAKATAK V1 lead intake

Status: **code path under review; disabled by default; not production verified**.

Parent work: GitHub issue #160.

## Boundary

R2F (`takatakca/r2fca`) is the customer-facing property-services acquisition product.
TAKATAK V1 is the central operations brain and the master commercial lead record.

R2F never receives direct database credentials for TAKATAK, QMAPS or FLEXS.

## Endpoint

`POST /api/v1/integrations/r2f/leads`

JSON only. Maximum body size: 24,000 bytes.

The endpoint is fail-closed unless all of these server variables are valid:

- `R2F_INTAKE_ENABLED=true`
- `R2F_INTEGRATION_ID`
- `R2F_INTAKE_WEBHOOK_SECRET` (minimum 32 characters)
- `R2F_LEADS_CLIENT_ID` (TAKATAK workspace UUID)

## Authentication

R2F signs the **exact raw JSON body** server-side.

Required headers:

```text
X-Integration-Id: <R2F_INTEGRATION_ID>
X-Event-Id: <same value as body.requestId>
X-Timestamp: <unix seconds>
X-Signature: sha256=<hex HMAC-SHA256>
```

Canonical signed value:

```text
<timestamp>.<eventId>.<rawBody>
```

Requests outside a five-minute window are refused.

Never expose the HMAC secret to browser JavaScript.

## Version 1 request

```json
{
  "version": 1,
  "requestId": "stable-r2f-request-id",
  "contact": {
    "firstName": "Marie",
    "lastName": "Tremblay",
    "email": "marie@example.test",
    "phone": "514 555 0101",
    "preferredLanguage": "fr"
  },
  "project": {
    "needType": "emergency",
    "serviceCategory": "Plomberie",
    "serviceSubcategory": "Fuite d'eau",
    "problemType": "water_leak",
    "market": "residential",
    "propertyType": "house",
    "urgency": "urgent",
    "city": "Montréal",
    "postalCode": "H1H 1H1",
    "description": "Une conduite fuit sous l'évier.",
    "budgetCents": 50000
  },
  "attribution": {
    "sourcePage": "/plombier/montreal",
    "referrer": "https://www.google.com/",
    "channel": "seo",
    "campaign": null,
    "utmSource": "google",
    "utmMedium": "organic",
    "utmCampaign": null,
    "utmTerm": null,
    "utmContent": null,
    "gclid": null,
    "fbclid": null,
    "ttclid": null
  },
  "consent": {
    "contact": true,
    "marketing": false,
    "capturedAt": "2026-10-10T08:00:00.000Z"
  }
}
```

Email or phone is required. Contact consent is mandatory. Marketing consent is independent and defaults to false unless explicitly true.

## TAKATAK persistence

A successful new request creates:

- a `Lead` in the configured TAKATAK workspace;
- a distinct `LeadSource` named **R2F RAPIDE2FIX** when missing;
- an `AuditLog` entry `r2f_lead_received`;
- an in-app workspace notification containing no customer contact details;
- a `SourceSynchronizationEvent` containing the payload hash and response reference for idempotency.

No MasterIdentity is created or merged from unverified R2F contact fields.

Detailed R2F project and attribution data stays under the Lead metadata with `origin: "r2f"`.

## Idempotency and duplicates

The synchronization event key is namespaced as `r2f:<requestId>`.

- Same request ID + same raw payload: returns the existing reference as a duplicate.
- Same request ID + different payload: HTTP 409.
- A new event with the same contact and same service/city within 15 minutes collapses to the existing lead.
- R2F source flood cap: 100 leads / 10 minutes per configured workspace/source.

## Responses

Success:

```json
{ "accepted": true, "reference": "ABC12345", "duplicate": false }
```

Security/validation failures are non-retryable.
Temporary service failures return `Retry-After`.

## Downstream products

This endpoint only establishes the TAKATAK master lead.

QMAPS matching and FLEXS opportunity projection remain later, separately tested adapters. R2F does not call their databases directly.

## QA

```sh
npm run qa:r2f-intake
```

CI also runs this safeguard.

Production activation requires staging verification and explicit configuration of the server-only R2F credentials. Code presence alone is not an operational connection.
