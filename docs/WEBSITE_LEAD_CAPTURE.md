# Website lead capture (takatak.ca → TAKATAK dashboard)

## Problem fixed

Before this change, public takatak.ca requests never reached TAKATAK:

- **Domain request form** (Upmind fallback): saved only in the visitor's browser (`localStorage`).
- **Post a project** (`/marketplace/post-project`):
  - Saved only in the visitor's browser.
  - Then sent signed-in users to `/dashboard/marketplace`, which does not exist.
  - Guests were sent to `/register`, and their draft was never restored.
- **Marketplace checkout** (`/checkout`): "Continue in dashboard" went to `/dashboard/marketplace` (no such page) and the order was never recorded. The footer and the services list linked to the same missing page.

## What happens now

- Both forms send the request to `POST /api/public/website-requests` on the same origin.
- The request is stored as a **Lead** in the TAKATAK agency workspace under the source **"takatak.ca website"**, so it appears in `/dashboard/leads`. An `AuditLog` entry (`website_request_received`) is written in the same transaction.
- The visitor sees a confirmation with a short **reference** (first 8 characters of the lead id).
- Guests posting a project now enter a name, email and phone. At least an email or a phone number is required.
- Signed-in users are identified from their session.
- Project drafts are kept until TAKATAK confirms reception, and are restored when the visitor returns.
- **Checkout** sends the order with "Send order to TAKATAK" (`kind: "package_order"`):
  - The browser sends identifiers only: package id, tier name, add-on labels and promo code.
  - The server prices the order from the catalog (`src/lib/website-leads/package-pricing.ts`). Any total sent by the browser is ignored.
  - Unknown packages, tiers or add-ons are refused (400). Only `FIRST10` is honoured, mirroring the checkout UI.
  - The order becomes a **high-priority** lead whose value is the quoted total. The message lists tier, delivery, add-ons, promo and "Total quoted (catalog price, not charged)".
  - The visitor sees "Order received" with the reference and quoted total. **No payment is taken**: TAKATAK confirms scope and invoices separately.
- Footer "Manage projects" and the marketplace service entry now point to `/dashboard` instead of the missing `/dashboard/marketplace`.

## Team alerts (TK-017)

- **In-app, always on.** Every new lead (not a collapsed duplicate) creates a workspace `Notification` in the same transaction: "New website order", "New domain request" or "New project request".
  - The message is the subject, reference and quoted value or budget.
  - It contains **no name, email or phone**.
- **`/dashboard/notifications`** is now a real page (it was a placeholder):
  - Lists the active workspace's notifications, plus personal notifications that belong to no workspace.
  - Shows an unread count and an "Open" link (a lead opens `/dashboard/leads/inbox`).
  - Offers "Mark read" and "Mark all as read" (`POST /api/notifications/read`, permission `view_dashboard`, origin-checked). Updates are limited to the active workspace.
- **Email, opt-in.** When `WEBSITE_LEADS_NOTIFY_EMAIL` is set to an internal TAKATAK address, a short alert is sent:
  - Subject: `[takatak.ca] New website order · REF`.
  - Body: summary plus a link to the leads inbox, with no contact details.
  - Sent after the response (`after()`), so visitors never wait.
  - Uses the existing SendGrid / SMTP configuration. It is never sent to the visitor.

## Protections

| Protection | Behaviour |
| --- | --- |
| Origin check | Existing `readJsonBody` same-origin check (403 for foreign origins; Origin header required in production) |
| Body | JSON only (415), 16 KB max (413) |
| Validation | Whitelisted, trimmed, length-bounded fields; email, phone, domain and budget formats checked (400 with `fieldErrors`) |
| Bot trap | Hidden `website` field: bots get a normal-looking 200 and nothing is stored |
| Per-address limit | 5 requests per 10 minutes per hashed address (process-local, soft) → 429. Raw IPs are never stored |
| Workspace flood cap | 40 website leads per 10 minutes, enforced in the database transaction → 429 |
| Duplicates | Same contact and same subject within 15 minutes returns the existing reference instead of a new lead |
| Errors | Raw errors are never returned; logs are redacted |

## Activation (server only)

```
WEBSITE_LEADS_ENABLED=true
WEBSITE_LEADS_CLIENT_ID=<UUID of the TAKATAK agency Client/workspace>
# optional, internal address for lead alerts
WEBSITE_LEADS_NOTIFY_EMAIL=<team address>
```

While disabled:

- The domain form keeps its previous local-only behaviour.
- Post a project shows an honest "couldn't send" message and keeps the draft on the device.

**Enable it on the same deploy as this change.**

## Verification

- `npm run qa:website-leads` (runs in CI): 18 checks covering:
  - config gate
  - validation and sanitization
  - honeypot
  - the per-address limiter
  - store behaviour: source creation, audit entry, duplicate collapse, flood cap, budget value
  - route protections
  - the removed dead-end links
  - package orders: catalog pricing, forged totals ignored, unknown package/tier/add-on refused, high priority and value
  - notifications: one per new lead with no contact details; email opt-in and validated; mark-read limited to the workspace
- Manual, against a throwaway local PostgreSQL 16 with the full Prisma schema and `next start` in production mode:
  - a valid domain request was stored as a lead
  - a double submit returned the same reference
  - a guest project with phone only was stored with a $250 value
  - a foreign origin returned 403, a missing contact 400, invalid fields 400, non-JSON 415 and an oversized body 413
  - the honeypot returned 200 and stored nothing
  - the 6th request in a burst from one address returned 429, and the workspace flood cap returned 429
  - a checkout order for "logo-design" Standard + "Business card design" + `first10`, sent with a forged `totalCents: 1`, was stored as a high-priority lead valued at $178.20 (catalog $149 + $49 − 10%); an unknown package or add-on returned 400
  - with `WEBSITE_LEADS_NOTIFY_EMAIL` set, an order submitted twice gave one lead, one notification ("New website order · Ref … · $79.00 CAD quoted", no contact details) and one email attempt after the response (logged `not_configured` because no email provider is set locally)
  - signed out: `/dashboard/notifications` redirects to login and the mark-read API returns 401
  - real Prisma: marking another workspace's notification by id updated 0 rows; "mark all" updated only this workspace's rows

## Not done yet

- No SMS alert. No unread badge on the sidebar bell yet.
- Prices on the website are still the static values in `src/lib/website/pricing.ts` and the marketplace catalog.
- Checkout orders are leads, not invoices. Turning an accepted order into a Facturations draft is a later step.
- `promotions.ts` still calls the stub `api-client.ts`; promo codes are not backed by the server yet.
