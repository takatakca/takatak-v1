# GROUPE TAKATAK Billing — Facturations integration foundation

Status: **foundation on branch `claude/takatak-billing-foundation`. Integration disabled by default. Not deployed. Its migration is not yet in the approved staging/production migration trains.**

GROUPE TAKATAK has one invoicing authority for the whole ecosystem: the independent **Facturations** service (`takatakca/Facturations`). TAKATAK V1 is the **billing gateway**:

- Every ecosystem app feeds invoice requests into one central queue in TAKATAK.
- The platform owner reviews them.
- TAKATAK sends each request server-to-server to Facturations.
- Facturations creates a **DRAFT** and nothing else.

Approval, issuance (Wave), PDF, delivery, payments and the client portal stay in the standalone Facturations workspace, behind its own OWNER gates.

This follows the Facturations handoff contract, `docs/takatak-dashboard-integration-handoff-v1.md` and `docs/takatak-integration-v1.openapi.json` (v1, "1.0.0-staged"), and the TAKATAK architecture rule that child products integrate through contracts, never shared databases.

## Architecture

```
Rentauto / AHMV / Ads / 1LV / FoodHub / … (server code)
        │  enqueueInvoiceRequest()            ┌──────────────────────────┐
        ▼                                     │  TAKATAK admin (browser) │
billing_invoice_requests  ◀───── queue / review / "Create draft" ───┘
 (TAKATAK DB, RLS on, no Data API)
        │  submitInvoiceRequest()  — platform OWNER only
        ▼
src/lib/integrations/facturations/client.ts
        │  fresh 60-second HS256 service token (fresh jti), Idempotency-Key
        ▼
Facturations /integration/v1/*  (independent service + dedicated PostgreSQL)
        │
        ▼
Facturations DRAFT  →  standalone OWNER review → approval → issuance → PDF → delivery → payment
```

- The browser never sees the service secret and never calls Facturations directly.
- TAKATAK never connects to the Facturations database.
- Facturations never connects to the TAKATAK database.

## How an ecosystem app feeds the queue

From server code only (route handler, webhook, worker) in the app's own module:

```ts
import { enqueueInvoiceRequest } from "@/lib/billing/invoices/invoice-request-service";

await enqueueInvoiceRequest(
  {
    sourceApp: "rentauto",                       // src/lib/billing/invoices/source-apps.ts
    sourceReference: `booking:${booking.id}`,    // stable, unique inside the app
    clientId: null,                              // TAKATAK Client when the customer is a workspace
    masterIdentityId: identity.id,               // optional: person customer
    draft: {
      currency: "CAD",
      customer: { name, email, address: null },
      invoiceDate: "2026-10-06",
      dueDate: "2026-10-21",
      notes: null,
      lines: [{ description: "Location 3 jours", quantity: 3, unitPriceCents: 4500, discountCents: 0, taxable: true }],
      taxes: [
        { code: "GST", label: "TPS / GST", rateMilliPercent: 5000 },
        { code: "QST", label: "TVQ / QST", rateMilliPercent: 9975 },
      ],
    },
  },
  { profileId: null }, // or the acting TAKATAK profile
);
```

Rules for feeding apps:

- **One business event = one `sourceReference`.** Calling twice with the same draft is a no-op. The existing request is returned.
- **Corrections use a new reference** (e.g. `booking:123:v2`). The same reference with a different draft returns `409 conflict`. Stored drafts are immutable at the database level.
- **Money is integer cents, CAD only.** Tax rates are explicit milli-percent values (`9975` = 9.975 %). No jurisdictional rate is ever assumed: the feeding app or the owner decides the taxes.
- The input is re-validated against the exact Facturations `DraftInput` contract before it is stored, including the 32 KB request-size limit. Anything Facturations would reject is refused at enqueue time.
- **To add a new app**, add its code to `BILLING_SOURCE_APPS`. The database only enforces the format.

## Lifecycle

```
pending ──Create draft──▶ submitting ──ok───────────────▶ submitted   (Facturations DRAFT exists — final)
   ▲                          ├─ timeout / 5xx / 429 ───▶ failed      (send again: safe, never duplicates)
   │                          ├─ config / auth gap ─────▶ pending     (fix setup, then send)
   │                          ├─ invalid data (4xx) ────▶ rejected    (no draft was created)
   │                          └─ 409 key already used ──▶ needs_reconciliation ──OWNER links verified draft──▶ submitted
cancel: only while no draft can exist — pending with 0 attempts, or rejected
```

- `submitted` means a **Facturations draft exists**. It is not issued, sent, paid, revenue or receivable.
- **Idempotency-Key.** Each request's key is derived from its own row id. It is stable for every retry of that request and never shared with another TAKATAK install (production, staging, a restored copy). A retry after a lost response returns the **same** Facturations draft (verified end-to-end).
- **No orphaned drafts.** Once any attempt may have reached Facturations (`failed`, or `pending` after an attempt), the request can no longer be cancelled. It can only end as `submitted`, either through a safe resend or a verified link. A draft can therefore never be orphaned and then duplicated by a re-queued request.
- **Reconciliation (409).** The owner pastes the Facturations draft id. TAKATAK fetches that draft and links it only if the customer email, dates and recalculated total match the stored request exactly. A Facturations draft id can be linked to at most one request (unique index).
- **Concurrency.** Submission uses a compare-and-set claim, so concurrent clicks cannot double-send (verified with 3 simultaneous sends). Every outcome write only applies if that attempt still owns the claim. A claim left in `submitting` for more than 2 minutes (crash) can be taken over.

## Identity and roles

| TAKATAK platform role | Facturations role | Can |
| --- | --- | --- |
| `owner` | `OWNER` | View status, queue requests, create Facturations drafts, link drafts after a 409 |
| `admin` | `STAFF` | View status and draft summaries, queue requests, cancel draft-free requests (cannot create or link drafts) |
| `user` | none | Nothing (admin area is platform-admin only) |

- The token `sub` is `takatak:mi:<MasterIdentity.id>`, or `takatak:profile:<Profile.id>` when no master identity exists. It is never an email or phone number.
- The role is derived server-side from the verified platform role. It is never read from the request.
- `business_id`, issuer and audience come only from server configuration.

## Required environment (server-only, never `NEXT_PUBLIC_`)

| Variable | Meaning |
| --- | --- |
| `FACTURATIONS_INTEGRATION_ENABLED` | `1` to enable; anything else = disabled (default `0`) |
| `FACTURATIONS_ORIGIN` | Exact HTTPS origin of Facturations (loopback HTTP only outside production) |
| `FACTURATIONS_INTEGRATION_HMAC_SECRET` | Shared HS256 secret, ≥ 32 chars. Same value as Facturations' variable of the same name |
| `FACTURATIONS_INTEGRATION_ISSUER` | Must equal Facturations `FACTURATIONS_INTEGRATION_ISSUER` |
| `FACTURATIONS_INTEGRATION_AUDIENCE` | Must equal Facturations `FACTURATIONS_INTEGRATION_AUDIENCE` |
| `FACTURATIONS_BUSINESS_ID` | Must equal Facturations `WAVE_BUSINESS_ID` (the single GROUPE TAKATAK business) |

When disabled or incomplete:

- The admin page shows "Disabled" or "Not configured" with the missing variable **names** (never values).
- Sending keeps requests `pending`.
- No network call is made.

Draft creation also requires `FACTURATIONS_INTEGRATION_WRITES_ENABLED=1` **on the Facturations server**.

## Data model

`BillingInvoiceRequest` → table `billing_invoice_requests` (migration `20261006120000_takatak_billing_invoice_requests`):

- `sourceApp` and `sourceReference` (unique pair), `idempotencyKey` derived from the row id (unique), `draft` (validated DraftInput JSON), `draftHash` (domain-separated SHA-256).
- `facturationsDraftId` is unique, so one Facturations draft is never linked to two requests.
- `estimatedTotalCents` (local estimate, BigInt) and `facturationsTotalCents` (Facturations' recalculated total). A mismatch is highlighted in the admin page.
- `status`, `facturationsDraftId`, `submitAttempts`, `lastErrorCode`, timestamps, and actor profile ids.
- Optional links: `clientId` and `masterIdentityId`. Both use `ON DELETE SET NULL`, so deleting a tenant never breaks billing history.

Database guarantees:

- CHECK constraints cover formats, CAD only, total ranges, and `submitted ⇔ facturationsDraftId`.
- A trigger blocks rewriting the fed draft, reopening `submitted`/`cancelled` rows, and any delete.
- RLS is enabled, there are no policies, and anon/authenticated grants are revoked. The table is in the RLS advisor's `SECRET_TABLES`.

## Security contract

- Every billing API route requires `requirePlatformAdminApiAccess()`. Every write verifies the request origin.
- Draft creation requires the Facturations OWNER role. This is checked in both the route and the service.
- Each call mints a fresh token: 60 s lifetime, fresh `jti` for the Facturations replay guard, `redirect: "error"`, `no-store`, a 10 s timeout and a 256 KB response cap.
- Responses are re-validated:
  - wrong `version` or `businessId` → refused
  - a created draft must be `DRAFT` with `waveSynced=false` and `emailed=false`
  - dashboard values are labelled **DRAFTS ONLY**
- Response bodies are streamed with a hard size cap. A stalled or reset body is treated as an unknown outcome, which means a safe retry.
- The client only calls the read endpoints and `POST /integration/v1/drafts`. It never calls approval, issuance, delivery, publication or payment endpoints. A QA script asserts this.
- Audit log entries (`billing.invoice_request.*`) for create, submit, failure and cancel. They contain no customer PII.
- Raw Facturations errors are never shown. Only allow-listed error codes are surfaced.

## Verification

| Check | How |
| --- | --- |
| Pure + static safeguards (CI) | `npm run qa:billing`: contract validation, estimate parity, token claims, idempotency, lifecycle, env gating, route guards, RLS/migration |
| Calculation parity | Estimate matches Facturations `previewDraft` on fixed vectors plus 2,000 randomized drafts |
| Token compatibility | TAKATAK-minted tokens verified by Facturations' own `verifyIntegrationBearer` (wrong business rejected) |
| Migration | All migrations, including this one, apply on a fresh database (`prisma migrate deploy`) |
| End-to-end (CI + local) | `scripts/billing-facturations-local-e2e.ts` against the real Facturations service. CI runs it at a pinned SHA through `scripts/ci-billing-facturations-contract.sh`. Covers: OWNER/STAFF identities, idempotent enqueue, draft creation with matching totals, 3 simultaneous sends → one draft, lost-response retry returning the same draft, outage → retry (not cancellable), 409 → reconciliation with verified link only, wrong secret → pending, wrong business refused, DB guards, audit trail |

## Client invoice center: paying a Facturations invoice ("Payer")

`/dashboard/invoices` (permission `manage_settings`) lists the workspace's Stripe subscription invoices and the Facturations invoices issued from its own billing requests. An owed Facturations invoice gets a **Payer** button:

1. `POST /api/billing/client-invoices/[requestId]/checkout`. The route checks the workspace permission and the write origin, and ignores the request body.
2. `startFacturationsInvoiceCheckout()` loads the request **of the active workspace only** (`submitted`, with a draft id), asks Facturations (`/integration/v1/drafts/:id/issuance`, OWNER reader) for the issued invoice, and charges its **balance**. The browser never supplies an amount or an invoice id.
3. It creates a one-time CAD Stripe Checkout session with this metadata on the session and the PaymentIntent:
   - `facturations_business_id` (= `FACTURATIONS_BUSINESS_ID`);
   - `facturations_issued_invoice_id`;
   - `takatak_client_id`;
   - `takatak_invoice_request_id`.

   The Stripe idempotency key is derived from workspace + invoice + balance, so a double click reuses one session. An already-completed session is refused, and an expired one is replaced.
4. Stripe sends `checkout.session.completed` to **Facturations** (`POST /webhooks/stripe/payments`). Facturations verifies the signature and records `VERIFIED_PROVIDER_WEBHOOK` evidence. TAKATAK never marks the invoice paid: the client center shows **Payée** only when Facturations reports `proofScope = VERIFIED_PROVIDER_PRESENT`. Stripe refunds (`refund.*`) are recorded the same way, so a refunded invoice shows **Remboursée**, never **Payée**.

TAKATAK's own Stripe webhooks (Social, AHMV) ignore these sessions because they are `mode=payment` and carry no Social or AHMV metadata.

Setup (Stripe test mode first):
- add a webhook endpoint `https://<facturations>/webhooks/stripe/payments` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `refund.created` and `refund.updated` on the **same Stripe account** as `STRIPE_SECRET_KEY`;
- put its `whsec_` secret only in Facturations' `FACTURATIONS_STRIPE_WEBHOOK_SECRET`.

Tests:
- `npm run qa:client-invoices`: pure logic and static checks;
- `npm run qa:client-invoices-db`: real database, fake Stripe and fake Facturations. Covers metadata, idempotency, cross-workspace refusal, partial balance, paid/not-issued refusal, complete and expired sessions.

## Deliberately not in this foundation

- No issuance, approval, delivery or publication actions from TAKATAK. Facturations keeps these capabilities `false` in v1. The only payment action is the client's Stripe Checkout above; the payment proof itself is recorded by Facturations, never by TAKATAK.
- No automatic worker. A human OWNER clicks "Create draft". A worker can later call `submitInvoiceRequest()` once the flow is proven on staging.
- No feeding app is wired yet. Rentauto, AHMV, Ads and others call `enqueueInvoiceRequest()` in follow-up changes.
- No external (cross-repo) feed endpoint yet. Apps in other repos (FoodHub, FESTI-ICE, …) will need a signed machine-to-machine route modelled on the existing master-API pattern.
- No real Facturations environment has been called. Activation waits for isolated Facturations staging (HTTPS, dedicated PostgreSQL, least-privilege role, backup/restore proof).

## Before merging to `main`

1. Review this branch and run CI.
2. The migration `20261006120000_takatak_billing_invoice_requests` is **not** in `APPROVED_DEPLOY_MIGRATIONS` (`scripts/reconcile-staging-migrations.mjs` and `scripts/reconcile-production-migrations.mjs`). Adding it there is an explicit owner decision: staging and production apply only listed migrations.
3. Keep `FACTURATIONS_INTEGRATION_ENABLED=0` until Facturations staging passes its activation gate.

## Next implementation sequence

1. Facturations staging online. Configure the matching issuer/audience/secret/business id, then smoke-test the admin page against staging.
2. Wire the first feeding app, for example Rentauto completed bookings or AHMV memberships, into `enqueueInvoiceRequest()`.
3. Signed machine endpoint for apps outside this repo.
4. Read-only views of Facturations approvals and workflow per request (endpoints already exist).
5. Optional submission worker with backoff once staging proves the flow.

## Run

```bash
npm run db:generate
npm run qa:billing
npm run typecheck
npm run lint
npm run build
```
