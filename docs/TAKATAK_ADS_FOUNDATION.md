# TAKATAK ADS — Proprietary Local Advertising Network

Status: **Foundation / pilot implementation**

This module turns GROUPE TAKATAK's owned web properties into a controlled local advertising network. It is intentionally separate from the existing Social `Campaign` model and Social subscription.

## Product model

### TAKATAK ADS Direct

An advertiser buys inventory on a specific TAKATAK publisher/site. Example: a hockey business buys a placement only on AHMV.

Required entitlement: `single_site_campaigns`.

### TAKATAK ADS Local Network

A local advertiser can run across eligible TAKATAK publishers. Context and geography can be supplied by the publisher and, later, enriched by QMAPS.

Required entitlements: `network_campaigns`, with `qmaps_targeting` available to the plan.

### TAKATAK Max Lead Pro

Premium cross-network product. The architecture reserves explicit entitlements for:

- QMAPS local targeting
- FLEXS lead/conversion attribution
- Local Lab creative generation
- multi-site TAKATAK network distribution

The statements “30% less expensive” and “80% more effective” are **not hard-coded marketing claims**. They must only be published after measured TAKATAK data supports them.

## Architecture

```text
QMAPS local/business context
            |
            v
      TAKATAK ADS
  campaign + targeting
      /           \
     v             v
Publisher sites   Local Lab
placements        creatives
     |
     v
impression / click token
     |
     v
TAKATAK ADS event ledger
     |
     +----> FLEXS attribution (next integration)
```

### Publisher inventory

A site is an `AdPublisher`. Every sellable position is an `AdPlacement`.

Example codes:

- publisher: `ahmv`
- placement: `home-hero-01`
- placement: `schedule-inline-01`
- placement: `team-m11-sidebar-01`

Websites never decide which advertiser wins. They request an ad from the central server using publisher + placement codes.

## Public serving API

`POST /api/ads/serve`

Example request:

```json
{
  "publisherCode": "ahmv",
  "placementCode": "schedule-inline-01",
  "context": {
    "country": "Canada",
    "region": "Quebec",
    "city": "Verdun",
    "postalPrefix": "H4G",
    "category": "hockey",
    "locale": "fr",
    "device": "mobile"
  }
}
```

The server verifies:

1. publisher and placement are active;
2. campaign is active and within its date range;
3. campaign budget is not exhausted;
4. advertiser ADS subscription is currently entitled;
5. the plan permits the campaign scope;
6. contextual/local targeting matches;
7. an active creative exists;
8. destination URL uses HTTP/HTTPS.

Single-site campaigns have priority on inventory explicitly purchased for that placement. Network campaigns remain eligible when their targeting matches.

## Event API

`POST /api/ads/events`

Only public `impression` and `click` events are accepted in this foundation.

Every served ad receives a short-lived HMAC-signed token when `ADS_EVENT_SIGNING_SECRET` is configured. The token binds:

- campaign
- creative
- placement
- one-time serve nonce
- expiry

The serve response also exposes the same nonce as an opaque attribution id and supplies a TAKATAK signed click redirect. The redirect records the click server-side before sending the visitor to the advertiser. It appends only `ttclid=<opaque-id>` to the advertiser destination.

The database deduplicates each event type for a serve nonce.

No raw IP address, email address, phone number, or browser fingerprint is stored in `AdEvent`.

FLEXS attribution is implemented server-to-server at `POST /api/integrations/ads/flexs/events`. It requires `ADS_FLEXS_SERVICE_TOKEN`, accepts only opaque event/reference identifiers, and maps verified `lead`, `call`, `form_submit` and `conversion` events back to a previously recorded TAKATAK click through `ttclid`. Those conversion types are never accepted from public browsers.

## Required environment

Generate a strong secret of at least 32 characters and configure:

```bash
ADS_EVENT_SIGNING_SECRET=...
ADS_FLEXS_SERVICE_TOKEN=...
```

Both are server-only values and must be at least 32 characters. If the signing secret is absent or too short, ads can still be selected but signed click tracking is disabled. If the FLEXS token is absent or too short, FLEXS attribution returns a service-unavailable response.

## Data model

- `AdPublisher`
- `AdPlacement`
- `AdSubscription`
- `AdCampaign`
- `AdCreative`
- `AdCampaignPlacement`
- `AdEvent`

ADS billing is separate from `ClientSubscription`, which remains the Social subscription.

ADS campaigns are separate from the existing Social `Campaign` model.

## Security contract

- workspace management operations must use `view_ads` / `manage_ads`;
- subscription access is derived server-side;
- no frontend boolean may grant ADS access;
- publisher/event tables use RLS with no direct PostgREST policies in V1;
- public event tracking is signed and deduplicated;
- do not store raw IP/fingerprint data;
- campaign targeting must be contextual/local by default.

## Billing notes

The schema supports CPM, CPC, CPL and fixed campaigns.

In the foundation runtime:

- CPC click cost can increment `spentCents`;
- fixed campaigns are capped by the campaign budget state;
- CPM aggregation and verified CPL billing are intentionally deferred until event aggregation and FLEXS conversion verification are implemented.

Do not pretend those billing modes are complete before those workers exist.

## QMAPS integration prompt

Use this prompt when implementing the QMAPS adapter:

> Build the QMAPS -> TAKATAK ADS targeting adapter. QMAPS is enrichment input, never the authority for authentication or billing. Resolve business category, municipality, region, postal prefix and service radius into normalized AdsTargetingRules. Never copy private contact details into ad targeting. Cache only non-sensitive targeting facts. Fail closed when a requested geographic rule cannot be normalized. Add deterministic QA for Quebec/Canada city, region, postal-prefix and radius edge cases.

## FLEXS integration status

The first FLEXS -> TAKATAK ADS attribution contract is now implemented. The remaining FLEXS work is to call the integration endpoint from the FLEXS runtime whenever an opaque `ttclid` becomes a verified lead, call, form submission or conversion. Browser-submitted conversion values remain untrusted, and CPL/CPA billing stays disabled until verified billing rules and reconciliation are completed.

Reference implementation prompt for the FLEXS-side caller:

> Read the opaque `ttclid` carried into FLEXS from a TAKATAK ADS destination. On a verified lead, call, form submission or conversion, POST only attributionId, an idempotent externalEventId, eventType, optional opaque sourceReference, optional non-negative valueCents/currency and occurredAt to the authenticated TAKATAK ADS FLEXS integration. Never send email, phone, customer name, street address or raw form contents in the attribution payload. Retry safely with the same externalEventId.

## Local Lab creative prompt

> Build Local Lab creative generation for TAKATAK ADS. Input: advertiser brand, offer, approved assets, publisher category, placement dimensions, locale and geographic market. Output only placement-compatible creative variants with headline, body, CTA, destination URL and asset references. Never invent discounts, testimonials, addresses, prices or performance claims. Prefer real advertiser assets. Mark generated variants as draft until approved. Produce French and English variants when required by the campaign.

## Publisher SDK prompt

> Build the TAKATAK ADS web SDK as a tiny dependency-free browser client. It receives publisherCode and placementCode from immutable site configuration, sends only contextual/local fields approved by the publisher, renders a clearly labeled ad, emits one impression after viewability criteria are met, emits one click beacon before navigation, never stores third-party tracking cookies, never sends raw IP/fingerprint information, and collapses cleanly on no-fill or API failure. It must work on Next.js, Vite and plain HTML sites.

## Next implementation sequence

1. Campaign Manager APIs and dashboard.
2. Seed/register AHMV as the first publisher and define real placements.
3. Publisher SDK.
4. QMAPS enrichment adapter.
5. Connect the FLEXS runtime caller to the implemented attribution endpoint.
6. Local Lab creative workflow.
7. Stripe/central Product Catalog checkout for ADS plans.
8. CPM aggregation, verified CPL billing, fraud signals and frequency caps.
9. Reporting: impression -> click -> lead -> call/form -> sale.
10. External publisher/revenue-share support only after owned-network metrics are stable.

Run:

```bash
npm run db:generate
npm run qa:ads
npm run typecheck
npm run lint
npm run build
```
