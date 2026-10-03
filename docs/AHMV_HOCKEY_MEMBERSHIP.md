# AHMV Hockey Membership — GROUPE TAKATAK

## Authority

GROUPE TAKATAK is the billing and identity authority for the paid AHMV family experience.

AHM Verdun remains the public hockey portal. It must never decide premium status from browser storage, URL parameters, a checkout success redirect, or an AHMV-only database flag.

Premium access is derived server-side from:

`Supabase session -> Profile -> MasterIdentity -> HockeyMembership -> plan/status entitlements`

## Plans

### AHMV Member — CAD 10/week

Self-serve pilot plan code:

`hockey_member_weekly_10`

Entitlements:

- ad-free AHMV member experience
- premium AHMV assistant
- game reminders
- calendar sync
- team community
- parent messaging
- parent rideshare

Individual features may remain visually unavailable until their product module is actually shipped. The billing catalog is the maximum entitlement envelope; it is not permission to claim unfinished capabilities are live.

### AHMV VIP — CAD 30/week

Plan code:

`hockey_vip_weekly_30`

Status: planned, not self-serve, not for sale.

It reserves future entitlement concepts such as tournament/travel coordination and richer family live coordination. Do not add a Stripe Price or checkout path until those capabilities are actually delivered and reviewed.

## Stripe activation

Hockey billing shares the TAKATAK Stripe account secret but uses a dedicated webhook endpoint and webhook secret.

Required server variables:

```text
HOCKEY_MEMBERSHIP_SELF_SERVE_ENABLED=true
STRIPE_HOCKEY_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10=price_...
```

The configured Stripe Price is verified by the backend before Checkout:

- currency = CAD
- amount = 1000 cents
- recurring interval = week
- interval_count = 1
- Price is active

A wrong Price ID fails closed.

Webhook endpoint:

`POST /api/billing/hockey/webhook`

Configure only the event types used by the membership handler:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

Do not reuse the Social webhook secret.

## Access lifecycle

Checkout success does not unlock premium access.

Stripe webhook state is authoritative:

- `active` -> paid
- `past_due` -> paid during retry window
- `grace_period` -> paid
- `canceled` -> blocked
- `expired` -> blocked
- `paused` -> blocked
- `suspended` -> blocked
- `incomplete` -> blocked

`trialing` is not treated as a free hockey trial.

## APIs

Authenticated TAKATAK endpoints:

- `POST /api/billing/hockey/checkout`
- `GET /api/billing/hockey/membership`
- `POST /api/billing/hockey/portal`

Stripe endpoint:

- `POST /api/billing/hockey/webhook`

The dashboard surface is:

- `/dashboard/hockey`

## Database security

Tables:

- `hockey_memberships`
- `hockey_stripe_webhook_events`

Both have RLS enabled with zero browser Data API policies. Billing data is backend-only.

No raw Stripe webhook payload is stored in the idempotency ledger.

## AHMV bridge rule

When AHMV begins gating premium features, it must verify a short-lived server-side TAKATAK entitlement assertion or another reviewed server-to-server mechanism.

Never implement premium access using:

- localStorage
- a frontend-only boolean
- a query parameter
- a Stripe checkout return URL
- a user-editable profile field

AHMV feature gates map to these entitlements:

- AdSense suppression -> `ad_free`
- full assistant -> `ai_assistant`
- game notifications -> `game_reminders`
- calendar integrations -> `calendar_sync`
- private team community -> `team_community`
- parent-to-parent communication -> `parent_messaging`
- rideshare -> `parent_rideshare`

## Verification before enabling self-serve

1. PR and full TAKATAK CI are green.
2. Prisma migration is applied in the intended environment.
3. Stripe Product/Price exists with exactly CAD 10/week recurring.
4. Dedicated hockey webhook endpoint is configured with its own signing secret.
5. Invalid webhook signatures are rejected.
6. Checkout creates an incomplete local membership but does not unlock access.
7. Paid webhook changes access to paid.
8. Cancellation blocks access.
9. Customer Portal can manage the subscription.
10. AHMV cross-domain entitlement bridge is tested before enabling any paywall.
