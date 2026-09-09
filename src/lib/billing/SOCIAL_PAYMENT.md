# TAKATAK Social payment — complete details

**Who pays:** the Client (workspace), not a Brand and not a Facebook Page.  
**Social money:** Stripe (Step 6). Cards are charged when keys and Price IDs are set.  
**Domains and hosting:** Upmind. Not this system.  
**CAD prices below:** placeholders in code. Change them before Stripe goes live.

Source of plan numbers: `src/lib/billing/social/plan-catalog.ts`.  
Source of payment steps: this file. Resume log: `src/lib/billing/README.md`.  
**How to look, apply, and confirm each step:** `src/lib/billing/SOCIAL_PAYMENT_CONFIRM.md`.

---

## How many steps?

**Seven steps** to finish Social payment. **All seven are done.**

Money moves in **Step 6** (plans) and **Step 7** (add-ons) when Stripe test/live keys and Price IDs are present.

| Step | Name | Status | What it delivers |
| --- | --- | --- | --- |
| 1 | Plan catalog | **Done** | Free / Starter / Advanced / Custom in code. New workspaces get Free. |
| 2 | Subscription states | **Done** | Active, past due, cancel-at-period-end, Free fallback, locked statuses. |
| 3 | Brand freeze | **Done** | Extra Brands hide, they are not deleted. Posts over quota pause. |
| 4 | Server gates | **Done** | Every paid action checks the plan on the server, not only the UI. |
| 5 | Billing page polish | **Done** | Banner, lock copy, Stripe-ready buttons. |
| 6 | Stripe | **Done** | Checkout, Customer Portal, idempotent webhooks. Success page does not unlock. |
| 7 | Add-ons | **Done** | Pay for X accounts and Advanced Analytics after the main plan. |

When we work, we do **one step at a time**. Social payment coding is complete.

Apply database migrations before relying on new statuses:

```bash
npx prisma migrate deploy
```

---

## Locked rules (every step)

1. The **workspace** owns the Social subscription. A Brand never pays.
2. A person’s **role** (owner, viewer, …) is separate from the paid plan. Paid plan = what the workspace bought. Role = what that person may do.
3. Failed payment **freezes** access. It does not delete Brands, posts, or analytics.
4. The Stripe **success URL does not unlock** the plan. The **webhook** does.
5. A dead Facebook/Instagram/Google token is **not** an unpaid invoice. Show reconnect, not upgrade.
6. Local Connect still works via the trusted non-production bypass. Production never uses that bypass.

---

## What each plan does

Billing unit is **how many Brands stay active**, not seats and not social profiles.

**Networks on Free**  
Facebook, Instagram, Threads, TikTok, Google Business Profile, YouTube, Pinterest, Bluesky, Twitch.

**Not on Free**  
LinkedIn. X / Twitter (even as an add-on).

**Paid networks (Starter and up)**  
Everything on Free, plus LinkedIn. X only with the X add-on (Step 7).

### Free — `social_free`

Permanent plan. Also the fallback when a paid plan ends or all payment retries fail. **$0.**

| Limit | Value |
| --- | --- |
| Active Brands | 1 |
| Posts / month | 20 |
| Analytics history | 30 days |
| Competitors | 5 |
| LinkedIn | No |
| X | No |
| Reports | No |
| Team / roles / approvals | No |
| API | No |
| Add-ons | None |

Who it is for: one business, basic publishing and short analytics.

### Starter — `social_starter_5` and `social_starter_10`

For one person or a small company that needs several Brands, not a full agency team.

| | Starter 5 | Starter 10 |
| --- | --- | --- |
| Plan code | `social_starter_5` | `social_starter_10` |
| Active Brands | 5 | 10 |
| List price / month (placeholder CAD) | 35 | 49 |
| Annual, shown as / month (placeholder CAD) | 28 | 39 |

Same features on both:

- Everything in Free, plus LinkedIn
- Unlimited publications (fair use)
- Analytics without the 30-day cap
- 100 competitors
- Reports
- Eligible for X add-on and Advanced Analytics add-on
- **No** team management, custom roles, approval workflow, or API

### Advanced — `social_advanced_15`, `_25`, `_50`

For agencies and teams.

| | Advanced 15 | Advanced 25 | Advanced 50 |
| --- | --- | --- | --- |
| Plan code | `social_advanced_15` | `social_advanced_25` | `social_advanced_50` |
| Active Brands | 15 | 25 | 50 |
| List price / month (placeholder CAD) | 75 | 99 | 149 |
| Annual, shown as / month (placeholder CAD) | 59 | 79 | 119 |

Same features on all three:

- Everything in Starter
- Team and client management
- Custom roles
- Content approval
- TAKATAK API
- Same add-on eligibility as Starter

### Custom — `social_custom`

Sales / contract plan. Default brand floor in code is **50**. Can be raised (`customBrandAllowance`, 50 or more). No self-serve list price (`displayMonthlyCad` is 0). Includes Advanced features. White-label and contract extras are not in the catalog yet.

---

## Add-ons (sold in Step 7)

Not part of the main plan price.

### X / Twitter — `x_account`

- One paid slot per connected X account
- Starter and Advanced only (ignored on Free)
- Stored today as `ClientSubscription.xAccountAllowance`
- Checkout live in Step 7 (Starter+ only; webhook unlocks slots)

### Advanced Analytics — `advanced_analytics`

- Whole workspace, not one Brand
- Starter and Advanced only
- Stored today as `ClientSubscription.advancedAnalytics`
- Checkout live in Step 7 (Starter+ only; webhook unlocks)

---

## Subscription statuses (Step 2)

Stored on `ClientSubscription.status`.

| Status | Access | Meaning |
| --- | --- | --- |
| `incomplete` | Blocked | Checkout started, payment not confirmed |
| `trial` | Paid | Trial entitlements |
| `active` | Paid | Paid plan |
| `past_due` | Paid | Charge failed; retries; keep the paid plan |
| `grace_period` | Paid | Extra retry window; keep the paid plan |
| `canceled` | Paid if period not ended, else Free | Cancel requested |
| `expired` | Free | Paid period over; stale Advanced code is ignored |
| `free` | Free | Permanent Free plan |
| `paused` | Blocked | Billing paused on purpose |
| `active` + `cancelAtPeriodEnd` | Paid until `currentPeriodEnd` | Cancels at period end |
| `suspended` | Blocked | Admin / fraud lock |
| Missing row | Blocked | No subscription record |

Retry schedule to use when Stripe is live (Step 6): day 0 fail, retry days 1, 3, 5, 7, then Free.

---

## Step-by-step: what is built and what is left

### Step 1 — Plan catalog — done

TAKATAK can answer “what does this plan include?” without Stripe.

Files:

- `src/lib/billing/social/types.ts`
- `src/lib/billing/social/plan-catalog.ts`
- `src/lib/billing/social/entitlements.ts`
- `src/lib/billing/social/ensure-free-subscription.ts`
- `src/lib/billing/social/index.ts`
- `src/lib/auth/profile-sync.ts` (new workspace → Free row)
- `prisma/migrations/20260829000000_subscription_status_free/migration.sql`
- `scripts/verify-social-entitlements.ts`

### Step 2 — Subscription states — done

TAKATAK knows paid vs Free vs locked, including cancel and past due.

Files:

- `src/lib/billing/social/subscription-lifecycle.ts`
- `src/lib/billing/client-subscription-access-policy.ts`
- `src/lib/billing/client-subscription-access.ts`
- `src/lib/billing/social/billing-page-data.ts`
- `src/components/account/plans-billing-view.tsx` (status on current plan)
- `src/lib/team/team-data.ts`
- `prisma/migrations/20260829050000_subscription_lifecycle_states/migration.sql`
- `scripts/verify-social-subscription-lifecycle.ts`

### Step 3 — Brand freeze — done

When Brands > allowance (downgrade or Free fallback):

- Owner picks which Brands stay active
- Extra Brands freeze (not delete)
- Restore on upgrade
- Over-quota scheduled posts sit in `blocked_by_plan`
- Do not auto-publish a backlog after resubscribe
- Free workspaces cannot create a second live Brand

### Step 4 — Server gates — done

Every protected action asks the server:

- Can this workspace add another Brand? (Step 3)
- Can this Brand connect LinkedIn or X?
- Can we schedule another post this month?
- Can we see analytics older than 30 days?
- Can we invite, approve, export, or use the API?

UI hide is only a hint. Dev bypass still lets local Facebook/Instagram connect on Free; it does **not** unlock LinkedIn or X.  
`reauthorization_required` on a connection is not a billing error (reconnect does not consume an extra X slot).

### Step 5 — Billing page polish — done

The billing tab already listed plans. This step added:

- One Social billing banner (Free nudge, past due, freeze, or locked)
- “What this plan includes” with lock copy naming the plan or add-on
- Upgrade / Cancel call Stripe when `checkoutLive` is true (secret + webhook secret + at least one Price ID)
- Reports, analytics, teams, and approvals say which plan unlocks them

### Step 6 — Stripe — done

This is when a card is charged. The **success URL only shows a waiting message**. The **webhook** writes `planCode` / `active`.

- New paid plan from Free: Stripe Checkout. Local status stays Free until `customer.subscription.*` / paid invoice webhook.
- Do **not** set `incomplete` when the user clicks Upgrade (that status blocks Social).
- Existing paid plan, higher rank: `subscriptions.update` with prorations. Still wait for the webhook.
- Existing paid plan, lower rank: Subscription Schedule at period end. If Stripe cannot schedule it, the API returns an error instead of applying now.
- Cancel / card / invoices: Customer Portal.
- Custom: still Talk to us. No Checkout.
- Failed renewal: keep paid through retries (`past_due`). After 5 failed attempts (day 0, then 1 / 3 / 5 / 7), local plan becomes Free and Stripe is canceled.
- Webhooks are idempotent via `stripe_webhook_events.stripeEventId`.
- Upgrade restore of frozen Brands is attempted without auto-freezing extras. If still over the cap, the billing picker stays.

Webhook URL: `POST /api/billing/stripe/webhook`  
Checkout: `POST /api/billing/stripe/checkout`  
Portal: `POST /api/billing/stripe/portal`

Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_SOCIAL_*_MONTHLY` / `_ANNUAL`. Use test keys locally.

### Step 7 — Add-on payment — done

- Buy X slots one at a time on an existing Stripe Social subscription (prorated now).
- Remove an X slot at period end. Connected X accounts are not deleted.
- Buy Advanced Analytics for the whole workspace (prorated now). Remove at period end.
- Free cannot buy add-ons. Custom / non-Stripe paid plans stay Talk to us.
- Success / billing page does **not** unlock add-ons. The webhook writes `xAccountAllowance` and `advancedAnalytics` from Stripe subscription items.
- Plan upgrades keep existing add-on items.

Env: `STRIPE_PRICE_SOCIAL_ADDON_X_ACCOUNT_*` and `STRIPE_PRICE_SOCIAL_ADDON_ADVANCED_ANALYTICS_*` (same cycle as the plan).

Route: `POST /api/billing/stripe/addons`

---

## Two permission layers (do not mix)

1. **Subscription entitlement** — did this workspace pay for reports / extra Brands / LinkedIn?
2. **Member role** — is this person allowed to use it?

Example: Advanced includes reports, but a Viewer still cannot generate them.

A collaborator with a Free personal account can still use paid tools **inside a shared paid Brand**, if the owner’s plan and that person’s role allow it. Premium does not copy onto Brands the collaborator owns.

---

## Verify what is already built

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

---

## Short answers

**How many steps to finish payment?** Seven. Plan charging is Step 6. Add-on charging is Step 7. Both are built.

**Where are we?** Steps 1–7 done. Social payment coding is complete.
