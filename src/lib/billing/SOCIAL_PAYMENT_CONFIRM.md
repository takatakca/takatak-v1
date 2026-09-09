# How to confirm Social payment steps

Use this when you want to **see** what is live, **apply** the database change, and know what is **not visible yet**.

Plans and prices: `src/lib/billing/SOCIAL_PAYMENT.md`  
This file: how to look, click, and verify.

**Honest rule:** you cannot “pay with Stripe” until Step 6. Today you can confirm the **plan list**, **Brand freeze**, and **server gates**, plus the `verify-social-*.ts` scripts.

---

## 1. Apply once (database)

New statuses (`free`, `incomplete`, `grace_period`, `paused`, `suspended`) live in migrations. Until you apply them, the app may error when it writes `status: free`.

In the project folder:

```bash
npx prisma migrate deploy
```

You should see migrations applied, including:

- `20260829000000_subscription_status_free`
- `20260829050000_subscription_lifecycle_states`

If it says already applied, that is fine. You only need this once per database (local and later production).

Restart `npm run dev` if it was already running.

---

## 2. Where to look in the app

Log into TAKATAK, then open **one** of these:

- [http://localhost:3000/dashboard/social/settings?tab=billing](http://localhost:3000/dashboard/social/settings?tab=billing)
- Dashboard → **Billing & Plans** (it redirects to the same tab)
- Social settings → **Plans and billing**

That screen is `src/components/account/plans-billing-view.tsx`.

What you should see today:

1. **Current plan** — name (usually **Free**), status under it (usually **Free**), max brands, posts.
2. **Add-ons** — Advanced Analytics and X. Buttons stay off on Free; they charge on a Stripe-paid Starter/Advanced plan.
3. **Plan catalog** — Free / Starter / Advanced / Custom and placeholder CAD prices.
4. **Billing information** — company, address, invoice emails (this saves to the database; it is not Stripe).

Upgrade / Add add-on only charge when Stripe Price IDs exist **and** the webhook has confirmed.

---

## 3. Terminal checks (no browser)

From the project folder:

```bash
npx tsx scripts/verify-social-entitlements.ts
npx tsx scripts/verify-social-connection-access-policy.ts
npx tsx scripts/verify-social-subscription-lifecycle.ts
npx tsx scripts/verify-social-brand-allowance.ts
npx tsx scripts/verify-social-entitlement-gates.ts
npx tsx scripts/verify-social-billing-banner.ts
```

All six should print **ALL PASS**. That confirms the catalog, paid / Free / locked rules, Brand freeze, server gates, and billing banner copy without clicking the UI.

---

## 4. Each step — what it does, how it behaves, when you see it

### Step 1 — Plan catalog — **you can confirm now**

**Does:** TAKATAK knows what Free / Starter / Advanced / Custom include. A new workspace gets a Free row if it had none.

**Behaves:** The calculator answers “how many Brands?”, “LinkedIn?”, “20 posts or unlimited?”. Unknown plan codes become Free. Add-ons on Free are ignored.

**See in action:**

- Billing tab → plan cards match the catalog (Starter 5/10, Advanced 15/25/50, Custom).
- Current plan name is **Free** after you sign in (once migrate is applied).
- Terminal: `verify-social-entitlements.ts`.

**You cannot see yet:** a real charge, or switching plan by paying.

---

### Step 2 — Subscription states — **partly visible now**

**Does:** Turns the subscription row into **paid**, **Free**, or **blocked**.

**Behaves:**

| What happens | What you should see |
| --- | --- |
| Normal Free workspace | Status **Free**, plan **Free**, 1 Brand cap |
| Paid and current (later, Stripe) | Status **Active** (or **Trial**), paid plan name |
| Card fails, retries | Status **Payment past due** or **Payment retry**, still the **paid** plan, amber note on the card |
| User cancels, period not over | **Cancels at period end**, still paid until the date |
| Period over / expired | Plan shows **Free** even if the old Advanced code is still in the database |
| Incomplete / paused / suspended | Access **locked**, grey note on the card |

**See in action today:**

- Billing tab → line under the plan title (`Free`, `Active`, …).
- Team settings: an **expired** workspace should not keep Advanced team tools (entitlements fall back to Free).

**You cannot see yet without changing the database by hand:** past due, cancel-at-period-end, suspended. Stripe will write those in Step 6. Do not edit production by hand. Locally, only if we agree to a test update.

**Confirm without Stripe:** `verify-social-subscription-lifecycle.ts` and `verify-social-connection-access-policy.ts`.

---

### Step 3 — Brand freeze — **you can confirm now**

**Does:** Extra Brands freeze instead of delete. Scheduled posts over the plan quota become `blocked_by_plan`. Frozen Brands leave the Social switcher. You cannot create more live Brands than the plan allows.

**Behaves:**

- Free + already 1 Brand → adding another Brand is refused.
- More live Brands than the plan allows → billing tab shows a picker. You choose which stay. The rest freeze.
- Upgrade / spare slots → **Restore frozen brands** (does not auto-publish old scheduled posts).

**See in action:**

1. Apply migrations (`npx prisma migrate deploy`).
2. Billing tab. If you only have one Brand, try **Add brand** — it should fail on Free.
3. If you already have extra Brands, choose which to keep and click **Keep selected brands**. Frozen Brands stay on `/dashboard/brands` with status Frozen.
4. Terminal: `npx tsx scripts/verify-social-brand-allowance.ts`

---

### Step 4 — Server gates — **you can confirm now**

**Does:** The server answers plan questions before Connect, analytics reads, competitor add, team invite, and API.

**Behaves:**

- Free Facebook / Instagram / YouTube / TikTok Connect still works (including local dev bypass).
- LinkedIn and X are refused on Free, even locally. Bypass does not unlock them.
- Facebook **last 90 days** on Free is clipped to 30 days.
- 6th competitor on Free is refused (plan allows 5).
- Team invite / custom roles need Advanced.
- The 21st scheduled post in a month is refused (composer is not live yet; the gate is ready). Reconnecting an expired X token does not use an extra slot.

**See in action:**

1. On Free, Connect Facebook still works.
2. LinkedIn stays locked (coming soon **and** not on Free).
3. Facebook analytics: pick last 90 days — the returned window should start ~30 days ago.
4. Team page: invite should fail on Free with the Advanced-plan message.
5. Terminal: `npx tsx scripts/verify-social-entitlement-gates.ts`

---

### Step 5 — Billing page polish — **you can confirm now**

**Does:** One banner across Social. Billing tab lists what is included vs locked, and names the plan or add-on that unlocks each item. Upgrade / Cancel / Add add-on stay disabled.

**Behaves:**

- Free: banner “You're on Free” on Social pages (hidden on the billing tab itself).
- Billing tab → **What this plan includes** — LinkedIn locked · Starter or Advanced.
- Catalog **Upgrade (not live yet)** and **Cancel subscription** do not charge.
- Reports / teams / approvals say which plan unlocks them. Analytics notes the 30-day Free window.

**See in action:**

1. Open any Social page besides billing — Free banner with **View plans**.
2. Open `/dashboard/social/settings?tab=billing` — current plan, lock list, disabled Upgrade.
3. Terminal: `npx tsx scripts/verify-social-billing-banner.ts`

---

### Step 6 — Stripe — **you can confirm when keys are set**

**Does:** Checkout, customer portal, invoices, webhooks. Success page does **not** unlock the plan; Stripe’s webhook does.

**Behaves:**

- Without `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + at least one `STRIPE_PRICE_SOCIAL_*` value, Upgrade stays **Upgrade (not live yet)**.
- With test keys and a Price ID: Upgrade opens Stripe Checkout. After card `4242…`, the billing tab still shows Free until the webhook runs.
- Then current plan becomes Starter/Advanced, status **Active**.
- Cancel opens the Customer Portal when this workspace already has a Stripe customer.
- Custom stays **Talk to us**. Add-on buttons stay off until Step 7 Price IDs and a paid Stripe plan exist.
- Failed renewal: **Payment past due** during retries, then **Free** after five failed attempts.

**See in action:**

1. Apply `npx prisma migrate deploy` (includes `stripe_webhook_events`).
2. Put **test** keys in `.env` (never live keys on a laptop). Copy Price IDs from the Stripe Dashboard.
3. Forward webhooks: `stripe listen --forward-to localhost:3000/api/billing/stripe/webhook` and paste the CLI `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
4. Open `/dashboard/social/settings?tab=billing` → Upgrade → test card `4242424242424242`.
5. The success URL says Stripe is confirming. Wait, then refresh: plan is Active.
6. Terminal: `npx tsx scripts/verify-social-stripe-webhook.ts`

Do not use live keys locally.

---

### Step 7 — Add-ons — **you can confirm when add-on Price IDs are set**

**Does:** Pay for X slots and Advanced Analytics on an existing Stripe Social plan. Adding charges now. Removing waits until period end. The webhook unlocks the add-on, not the billing page.

**See in action:**

1. Workspace must already be on Starter or Advanced via Stripe (Step 6).
2. Paste add-on Price IDs into `.env` (`STRIPE_PRICE_SOCIAL_ADDON_X_ACCOUNT_*` and `STRIPE_PRICE_SOCIAL_ADDON_ADVANCED_ANALYTICS_*`).
3. Billing tab → **Add 1 slot** or **Add add-on**. After webhook, badge is **Contracted**.
4. X Connect is allowed up to the paid slot count. Reconnect does not consume another slot.
5. **Remove 1 slot at period end** / **Remove at period end** does not delete connected accounts.
6. Terminal: `npx tsx scripts/verify-social-stripe-addons.ts`

Free still shows disabled add-on buttons.

---

## 5. Quick confirm checklist (today)

Do this in order:

1. `npx prisma migrate deploy`
2. `npm run dev`
3. Open `/dashboard/social/settings?tab=billing`
4. Confirm current plan **Free**, catalog prices, add-on buttons disabled
5. Run the seven `verify-social-*.ts` scripts — all PASS
6. On Free, adding a second Brand should fail. Extra Brands (if you already have them) show a keep picker on the billing tab.
7. Connect Facebook still works on Free. LinkedIn / X do not. Team invite on Free should be refused.
8. Social pages show the Free banner. Billing tab lists locked features. Upgrade stays disabled until Stripe Price IDs exist.

If the billing tab errors after login, the migration is usually missing (step 1 of this file).

---

## 6. What “confirm” is **not**

- Clicking Upgrade only charges when Stripe Checkout is live **and** the webhook has not yet been required to unlock the plan. The success URL is not proof.
- Saving billing address is **not** a subscription.
- Hosting / domain invoices are **Upmind**, not this flow.
- A Facebook “reconnect” error is a **token** problem, not an unpaid plan.

---

## 7. When we continue coding

Say if you want a follow-up (invoices on the billing tab, or live Price IDs in Stripe).
