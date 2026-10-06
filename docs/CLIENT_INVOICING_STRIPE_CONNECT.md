# Client invoicing — clients bill their own customers (Stripe Connect)

Status: foundation (account connection). Off by default (`CLIENT_INVOICING_ENABLED`).

## Decision (2026-10-06)

GROUPE TAKATAK bills its clients two ways:
- **Stripe** for subscriptions;
- **Facturations** for custom invoices.

Both are visible to the client on `/dashboard/invoices`.

**Clients billing *their own* customers** is a different problem: each client is its own legal issuer, with its own tax numbers, invoice numbering, bank account and liability. It is built on **Stripe Connect**, with the client's **own** Stripe account, not on Facturations:

| | Facturations (multi-tenant) | Stripe Connect (chosen) |
| --- | --- | --- |
| Legal issuer, tax numbers, numbering | Would need a per-client issuer profile, Wave token and numbering inside GROUPE TAKATAK's own ledger | The client's own Stripe account and settings |
| Money | Would need payouts or money handling by TAKATAK | Paid directly to the client's bank; TAKATAK never holds funds |
| Identity checks (KYC), disputes, losses | TAKATAK's problem | Stripe's (`requirement_collection: stripe`, `losses.payments: stripe`) |
| Stripe fees | — | Paid by the client's account (`fees.payer: account`) |
| Audit and security surface | Mixes client financial records into the group's invoicing authority | Isolated per client account |

Facturations stays the invoicing authority **for GROUPE TAKATAK itself**.

## What this foundation does

- **`client_stripe_connect_accounts`** stores one row per workspace, holding the Stripe account id and the onboarding flags only.
  - CHECK constraints on the formats.
  - The workspace ↔ account link is immutable and cannot be deleted (trigger).
  - RLS is enabled, with no Data API grants. The table is listed in the RLS advisor's `SECRET_TABLES`.
- **`POST /api/billing/client-invoicing/connect`** (`manage_settings`, write-origin check, request body ignored):
  - creates the account once per workspace;
  - the Stripe idempotency key is derived from the workspace; a simultaneous click gets a "retry" answer, never a second account;
  - returns a Stripe-hosted onboarding link (`connect.stripe.com` only).
- **`/dashboard/client-billing`** ("Facturer mes clients") shows one of four states:
  - not connected;
  - onboarding to finish;
  - information requested;
  - active.

  Coming back from Stripe triggers a server-side re-read of the account.
- **`POST /api/billing/client-invoicing/webhook`** handles Connect `account.updated` events:
  - signature verified with `STRIPE_CONNECT_WEBHOOK_SECRET`;
  - only accounts TAKATAK linked are updated, and the event's object must be the event's own account.

TAKATAK never creates charges, transfers or payouts on a client account.

## Setup (Stripe test mode first)

1. In the platform Stripe account (same `STRIPE_SECRET_KEY`), enable **Connect**.
2. Add a webhook endpoint `https://<takatak>/api/billing/client-invoicing/webhook`. Choose "Events on Connected accounts" and the `account.updated` event, then put its secret in `STRIPE_CONNECT_WEBHOOK_SECRET`.
3. Set `CLIENT_INVOICING_ENABLED=1` on staging only.
4. Before merging: migration `20261006140000_client_stripe_connect_accounts` is **not** in `APPROVED_DEPLOY_MIGRATIONS`. Adding it stays an owner decision.

## Next steps

1. **Invoices.** Create and send invoices on the client's account (`stripeAccount` header): customers, invoice items, explicit tax rates chosen by the client (no jurisdiction assumed), `send_invoice` with a due date. Use Stripe-hosted pay pages and PDFs.
2. **Invoice list** on `/dashboard/client-billing`, reusing `mapStripeInvoice`, plus Connect `invoice.*` events.
3. **Feeding.** TAKATAK apps (Rentauto hosts, FoodHub merchants, …) create invoices on their merchant's account through the same service.
4. **Optional platform fee** (`application_fee_amount`), only after an explicit business decision.

## Tests

- `npm run qa:client-invoicing` (CI): account params, onboarding link, idempotency key, flag reading, state machine, URL allowlist, and static guards on routes, webhook, page, role and migration.
- `npm run qa:client-invoicing-db` (CI ephemeral database), real Postgres with a fake Stripe:
  - feature off creates nothing;
  - simultaneous clicks produce one account;
  - resuming onboarding reuses the stored account;
  - return sync and the webhook move the workspace to active;
  - unknown or mismatched webhook events are ignored;
  - the database refuses to change or delete the link and refuses malformed ids.
