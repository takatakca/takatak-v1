# Billing

Full Social payment write-up (steps, plans, Stripe vs Upmind):

**[SOCIAL_PAYMENT.md](./SOCIAL_PAYMENT.md)**  
**[SOCIAL_PAYMENT_CONFIRM.md](./SOCIAL_PAYMENT_CONFIRM.md)** — how to apply migrations, where to click, what you can see today.

Social subscription lives on the **Client** (workspace). Domains and hosting
stay on Upmind. **Social payment is Stripe** (Steps 6–7).

## Resume here (Steps 1–7 done)

Social plan checkout, portal, webhooks, and add-ons are wired.
Do not use live Stripe keys locally.

Apply pending Social billing migrations:

```bash
npx prisma migrate deploy
```

That includes `free` plus `incomplete`, `grace_period`, `paused`, `suspended`.

### Files from Step 1

New:

- `src/lib/billing/social/types.ts` — plan codes, networks, add-ons, entitlement shape
- `src/lib/billing/social/plan-catalog.ts` — Free / Starter / Advanced / Custom (CAD placeholders, not charged)
- `src/lib/billing/social/entitlements.ts` — `plan + add-ons → entitlements`
- `src/lib/billing/social/ensure-free-subscription.ts` — insert Free row if the Client has none
- `src/lib/billing/social/index.ts` — re-exports
- `scripts/verify-social-entitlements.ts` — catalog tests
- `prisma/migrations/20260829000000_subscription_status_free/migration.sql` — adds `free` status

### Files from Step 2

New:

- `src/lib/billing/social/subscription-lifecycle.ts` — status → paid / Free / blocked
- `scripts/verify-social-subscription-lifecycle.ts` — lifecycle tests
- `prisma/migrations/20260829050000_subscription_lifecycle_states/migration.sql` — new statuses

Changed:

- `prisma/schema.prisma` — `incomplete`, `grace_period`, `paused`, `suspended`
- `src/lib/billing/client-subscription-access-policy.ts` — OAuth uses lifecycle (Free and expired can connect; suspended cannot)
- `src/lib/billing/client-subscription-access.ts` — reads period end + cancel flag
- `src/lib/billing/social/billing-page-data.ts` — effective entitlements + status label
- `src/components/account/plans-billing-view.tsx` — shows status on the current-plan card
- `src/lib/team/team-data.ts` — expired workspaces lose team-management entitlements
- `scripts/verify-social-connection-access-policy.ts`
- `scripts/step-3-start-oauth-tests.ts`
- `scripts/step-4-facebook-callback-tests.ts`
- `package.json` — `qa:social-lifecycle`

### Files from Step 3

New:

- `src/lib/brands/live-brand-where.ts` — live vs frozen Brands
- `src/lib/billing/social/brand-allowance-policy.ts` — freeze / restore / blocked posts (pure)
- `src/lib/billing/social/brand-allowance.ts` — apply freeze and restore
- `src/app/api/billing/brands/keep/route.ts` — keep / restore API
- `prisma/migrations/20260829060000_brand_freeze_blocked_posts/migration.sql`
- `scripts/verify-social-brand-allowance.ts`

Changed: schema (`frozen`, `blocked_by_plan`), brand create/update, billing page picker, Social switcher hides frozen Brands.

What Step 2 does: past due keeps the paid plan during retries. Cancel stays paid until the period ends, then Free. Expired becomes Free (stale Advanced `planCode` is ignored). Incomplete / paused / suspended stay locked.

Verify:

```bash
npx tsx scripts/verify-social-entitlements.ts
npx tsx scripts/verify-social-connection-access-policy.ts
npx tsx scripts/verify-social-subscription-lifecycle.ts
npx tsx scripts/verify-social-brand-allowance.ts
npx tsx scripts/verify-social-entitlement-gates.ts
npx tsx scripts/verify-social-billing-banner.ts
npx tsx scripts/verify-social-stripe-webhook.ts
npx tsx scripts/verify-social-stripe-addons.ts
```

### Files from Step 5

New:

- `src/lib/billing/social/billing-banner-policy.ts` — banner + lock-copy rules (pure)
- `src/lib/billing/social/billing-banner.ts` — shell billing load
- `src/components/social/billing/social-billing-banner.tsx`
- `scripts/verify-social-billing-banner.ts`

Changed: Social shell banner, billing tab lock list, disabled Upgrade/Cancel, reports/analytics/team/approvals copy, Manage connections hides LinkedIn/X on Free.

### Files from Step 4

New:

- `src/lib/billing/social/entitlement-gates-policy.ts` — network / posts / analytics / team / API (pure)
- `src/lib/billing/social/entitlement-gates.ts` — server asserts
- `scripts/verify-social-entitlement-gates.ts`

Changed: OAuth start/continue/callback checks the network; Facebook analytics/content clip to 30 days on Free; competitor add uses the plan cap; team invite/role/custom permissions require Advanced; provider list hides LinkedIn/X on Free.

### Files from Step 6

New:

- `src/lib/billing/social/stripe-checkout-policy.ts` — checkout validation, upgrade vs downgrade
- `src/lib/billing/social/stripe-webhook-policy.ts` — Stripe status → TAKATAK plan (pure)
- `src/lib/billing/social/stripe-env.ts` / `stripe-client.ts` / `stripe-service.ts` / `stripe-webhook-apply.ts`
- `src/app/api/billing/stripe/checkout/route.ts`
- `src/app/api/billing/stripe/portal/route.ts`
- `src/app/api/billing/stripe/webhook/route.ts`
- `prisma/migrations/20260829070000_stripe_webhook_events/migration.sql`
- `scripts/verify-social-stripe-webhook.ts`

Changed: billing page `checkoutLive`, Upgrade/Cancel, success-URL waiting copy, `package.json` Stripe dependency.

Webhook URL: `POST /api/billing/stripe/webhook` (no origin/CSRF check; signature only).

### Files from Step 7

New:

- `src/lib/billing/social/addon-catalog.ts` — placeholder CAD + Price env names
- `src/lib/billing/social/stripe-addon-policy.ts` — add now / remove at period end
- `src/app/api/billing/stripe/addons/route.ts`
- `scripts/verify-social-stripe-addons.ts`

Changed: webhook writes `xAccountAllowance` / `advancedAnalytics` from Stripe items; plan changes keep add-on items; billing tab Add 1 slot / Remove at period end.

## Social connection authorization

- `src/lib/billing/client-subscription-access-policy.ts` — pure policy (testable)
- `src/lib/billing/client-subscription-access.ts` — server assert used by OAuth start

Allowed when:

1. Lifecycle is **paid** (active, trial, past_due, grace, or canceled with time left) or **Free** (including expired fallback), or
2. A **trusted server-side** development bypass is enabled **and** the runtime
   is not production (`NODE_ENV !== "production"` and `VERCEL_ENV !== "production"`).

Missing, incomplete, paused, and suspended are denied. Extra Brands freeze in Step 3. LinkedIn, X slots, post cap, analytics window, invites, and API are gated in Step 4. Dev bypass does not skip those network gates.

Trusted bypass sources (never from the browser):

- Non-production application runtime (default for local/manual Meta OAuth testing)
- `ClientSubscription.developmentBypass` in the database
- Process env `SOCIAL_CONNECTION_DEV_BYPASS=true`

Force real subscription checks even outside production:

- `SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION=true`
