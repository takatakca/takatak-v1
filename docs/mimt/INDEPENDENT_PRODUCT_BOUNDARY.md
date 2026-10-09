# MIMT.ca — Independent telecom product managed by TAKATAK (v1 integration contract)

**Status:** Integration design and activation checklist. No phone calls, subscriptions, customer numbers, new production routes or provider credentials are activated by this change.

## Boundaries — final decision, 2026-10-08

- **TAKATAK** is the ecosystem and managed operating agency.
- **`takatak-v1`** is the main TAKATAK account/business platform and stays deployable on its own.
- **MIMT.ca** is an independent telecom application, with its own repository, app/database, provider credentials, services, hosting configuration, and transferable build artifacts.
- The TAKATAK managed-services contract connects MIMT to identity, central business administration, invoicing and workflows while the agreement is in force.
- Upon contractually completed payoff, the MIMT deliverable must be deployable without licensed proprietary TAKATAK services. Exact source, data rights, support, leads, usage records, telecom numbers and third-party assignments follow applicable law and the written agreement; do not implement a hidden kill switch.

## Existing TAKATAK facts (inspected in main)

1. `src/lib/billing/invoices/source-apps.ts` **already lists `mimt`** as an invoice-feed source. Do not add a duplicate.
2. `src/lib/billing/invoices/feed-signature.ts` implements a signed invoice feed with per-app secret `BILLING_FEED_SECRET_MIMT`, headers:
   - `X-Takatak-Billing-App: mimt`
   - `X-Takatak-Billing-Timestamp: <seconds>`
   - `X-Takatak-Billing-Signature: v1=<hex-HMAC-SHA256>`
   - Canonical string: `v1.<app>.<timestamp>.<METHOD>.<path+query>.<raw body>`; tolerance 300 seconds.
   - Keep the raw request identical for signature calculation; use existing invoice-source reference idempotency/collision behavior.
3. `src/app/api/v1/events/route.ts` and `src/lib/integrations/master-api/events.ts` currently accept source `1lv` specifically. **Do not post `mimt.*` events there without an authorized MIMT-specific extension and tests.**
4. `takatak-v1` has its own Supabase authentication integration and legacy Twilio Verify helpers; MIMT must not replace production TAKATAK authentication or share caller JWT secrets.
5. Current TakaTak public `src/lib/website/pricing.ts` contains agency VoIP service prices **CAD 19.99/49.99/99 per month**, distinct from earlier MIMT Works end-user draft pricing (CAD 4/10). Do not silently reuse one catalogue for the other.

## Responsibilities

| System | Owns | Does not own |
|---|---|---|
| TAKATAK | Master user identity, verified business/workspace memberships, service activation, agency roles, signed handoff, consolidated invoice requests, licensing agreements, multi-product customer portal | Twilio call control, raw SMS bodies, recordings, provider secrets, MIMT database |
| MIMT | Client-side call app, MIMT Works receptionist/IVR, local user identities, numbers, subaccounts, Voice SDK JWT issuer, inbound/outbound TwiML, SMS/MMS, voicemail, CDR, telecom charges, consent, 911, operating status | TAKATAK master identities/agency CRM, centralized proprietary TakaTak engine |

MIMT stores local identity + mapped `takatak_master_identity_id` where a user authorizes account linking. Identity by itself does **not** grant a business role. Every user action requires MIMT-local tenant and entitlement validation. Separate secrets and encryption keys for each customer. Never put complete customer records, provider tokens or passwords in a redirect.

## Proposed new machine event envelopes (NOT currently live endpoints)

```json
{
  "event_id": "UUID-v4",
  "event_type": "mimt.service.activated",
  "source_application": "mimt",
  "source_tenant_id": "opaque-MIMT-tenant-id",
  "takatak_business_id": "authorized-business-id",
  "occurred_at": "RFC3339",
  "payload": { "service_id": "opaque", "plan_code": "works_starter" }
}
```

Also plan `mimt.account.linked`, `mimt.usage.summary`, `mimt.service.suspended` and explicit signed `mimt.contract.handoff.requested`. Use an MIMT-specific route/adapter only after scope validation. Protect events with HMAC/JWT, expiry, unique event ID, authorization, outbox+retry, redaction, tenant scoping, replay prevention and audit. Avoid publishing raw call metadata into an agency CRM without consent and necessity.

## First real call demo sequence (provider-side configuration needed)

1. Fund an appropriate Twilio account; finish Trust Hub verification; create `SK...` API Key, `AP...` TwiML App, and at least one suitable Canadian local voice+SMS number.
2. Build independent MIMT backend and publish behind `https://voice.mimt.ca`. The Twilio TwiML App outgoing Voice webhook is POST `/webhooks/twilio/voice/outbound`. The leased number incoming Voice webhook is POST `/webhooks/twilio/voice/inbound`; incoming SMS is POST `/webhooks/twilio/messaging/inbound`. Match HTTPS URL exactly for signature verification.
3. Use Twilio Voice JS SDK for browser Works dialer and Voice React Native SDK 1.8 for Expo native dev builds. Android FCM and iOS APNs/PushKit/CallKit require real device setup before reliable incoming mobile calls.
4. Demo numbers and destinations must be allowlisted; outbound calling/SMS off by default. For public service, implement per-tenant subscriptions, rate control and fraud budgets.
5. Complete Canadian CRTC local VoIP reseller registration, 911/emergency address, express user consent, published service limitations, required numbering and messaging compliance before public customer sale.
6. Test and record **actual** inbound and outbound external calls, SMS delivery, business IVR, background mobile push, emergency test via authorized provider procedure, billing idempotency and downgrade.
7. Keep MIMT calling functional when TAKATAK billing dashboard is temporarily unavailable; queue *commercial* event sync and reconcile later, subject to already-approved paid entitlements.

## Test gates before merge/deployment

- No migration or production route changes in this PR. Static architecture contract only.
- Demonstrate signed MIMT billing feed and authentication/authorization in staging without real customer data.
- Verify multi-tenant isolation, replay idempotency, missing-secret fail-closed, number porting/911 readiness, subaccount isolation and legal disclosures.
- Do not claim a provider is connected without live credentialed calls and a verified success result.
