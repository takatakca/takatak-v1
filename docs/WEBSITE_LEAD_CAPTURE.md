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

## Hosting plan requests (TK-062)

- `/checkout` shows the Upmind hosting plan widgets.
- If the Upmind widget script has not registered within 10 seconds (blocked, offline or slow), the plans are replaced by a **hosting request form** that uses the existing EN/FR `fallback.hosting.*` text.
- The visitor picks one of the four Upmind plans (Portfolio, Bronze, Silver, Gold) and leaves an email or phone. Guests must give one; signed-in users are identified by their session.
- The request becomes a lead "Hosting request: <plan>" with a "New hosting request" notification. The server accepts only those four plan names.
- Nothing is charged; TAKATAK confirms the plan and sets it up.

## Reference files on "Post a project" (TK-012)

Before this change, files picked in "Post a project" stayed in the browser and were never sent.

**How it works**

- The visitor picks up to **5 files, 10 MB each, 25 MB per lead**. Accepted types: PDF, PNG, JPEG, WebP, GIF, DOCX, XLSX, PPTX and TXT. The browser rejects other files with a message.
- After the project is received, the response carries a **30-minute upload token**. The token is HMAC-signed and bound to that lead and the TAKATAK workspace.
- The browser sends each file to `POST /api/public/website-requests/attachments`.
- The success screen lists each file as sent or not sent. For any file that failed, it asks the visitor to email it with their reference.

**Server checks** (in order)

1. Feature gate.
2. Same-origin check.
3. Multipart only.
4. Declared size before parsing.
5. Token signature, workspace and expiry.
6. **File type decided from the file's own bytes**, which must match the extension (a PNG renamed `.pdf` is refused).
7. The lead must belong to the workspace.
8. Per-lead file count and total size.

**Storage**

- Files go to a **private** Supabase Storage bucket under `website-leads/<workspace>/<yyyy>/<mm>/<lead>/<id>.<ext>`.
- Each file is recorded in the new table `lead_attachments` (migration `20261008090000_website_lead_attachments`; RLS on; a database CHECK enforces the 10 MB limit), with status `quarantined`.
- If the database write fails, the stored object is removed.

**Staff access**

- Leads now open a **detail page** `/dashboard/leads/<id>` showing:
  - the full request, status, priority, value, contact links and source page
  - attachments
- Downloading goes through `GET /api/leads/attachments/<id>`. It is scoped like the other lead pages, then redirects to a **one-minute signed link** that saves the file under its original (sanitized) name.
- Nothing is public.

**Activation**

1. Create a **private** bucket in Supabase Storage (default name `website-lead-attachments`).
2. Set `WEBSITE_LEADS_UPLOAD_SECRET` (32+ random characters) and, optionally, `WEBSITE_LEADS_UPLOAD_BUCKET`.

Without these the feature stays off: no token is issued and the success screen tells the visitor to email the files.

**Not done:** no antivirus scan. Files stay `quarantined` and are only ever downloaded, never displayed in the page; staff should open them with care.

## Working a lead (TK-066)

The lead page `/dashboard/leads/<id>` has an **Update** panel. It is shown to members of the active workspace with the `edit_content` permission (owner, admin, manager, editor, staff); viewers and the global admin view see the lead read-only.

- **Status**, **priority** and **follow-up date** can be changed, and **notes** added.
- Saving uses `POST /api/leads/<id>` (origin-checked, active workspace only).
- Each change is written in one transaction as:
  - lead history (`LeadActivity`: status change, follow-up planned or cleared, note), with the acting profile
  - one `lead_updated` audit entry
- Unchanged values write nothing.
- The **History** list shows the latest 50 entries.
- Checks: `npm run qa:lead-actions` (5 checks, in CI). Verified on real PostgreSQL:
  - an update from another workspace was refused
  - status, priority, follow-up and note produced four history rows and one audit row

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

- `npm run qa:website-leads` (runs in CI): 24 checks covering:
  - config gate
  - validation and sanitization
  - honeypot
  - the per-address limiter
  - store behaviour: source creation, audit entry, duplicate collapse, flood cap, budget value
  - route protections
  - the removed dead-end links
  - package orders: catalog pricing, forged totals ignored, unknown package/tier/add-on refused, high priority and value
  - hosting requests: only real plans accepted; Upmind failure shows the request form
  - attachments:
    - type detected from the file's bytes; renamed or unknown types refused
    - safe file names
    - token bound to lead, workspace and time (tampering, a different lead or workspace, and expiry all refused)
    - storage path and per-lead limits; cleanup after a database failure
    - routes gated and scoped
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
  - hosting: "Silver Hosting" with phone only was stored with a "New hosting request" notification; "Platinum Hosting" returned 400
  - browser (Playwright, Upmind blocked, phone-sized screen):
    - the form appeared after the timeout
    - an empty submit showed the contact message
    - a Gold Hosting request showed "Hosting request received" with a reference and was stored
    - no page errors
  - attachments over HTTP (uploads enabled, no storage service in the test environment):
    - a project request got an upload token; a domain request did not
    - tampered token 403
    - missing origin 403
    - PNG renamed `.pdf` 415, `.exe` 415
    - JSON instead of multipart 415
    - 11 MB 413
    - a valid PDF reached storage and returned 503 `storage_failed`, as expected without storage
    - signed-out download 403
  - attachments on real Prisma (stand-in storage): row stored `quarantined` under the lead's path; another workspace could not attach to the lead; the database refused a 20 MB row (CHECK constraint)
  - browser: "Post a project" with `brief.pdf` + `tool.exe`:
    - the `.exe` was refused in the form
    - after sending, the success screen showed the reference, "✗ brief.pdf — not sent" (no storage service) and the email instruction
    - no page errors
  - real Prisma: marking another workspace's notification by id updated 0 rows; "mark all" updated only this workspace's rows

## Not done yet

- No SMS alert. No unread badge on the sidebar bell yet.
- Prices on the website are still the static values in `src/lib/website/pricing.ts` and the marketplace catalog.
- Checkout orders are leads, not invoices. Turning an accepted order into a Facturations draft is a later step.
- `promotions.ts` still calls the stub `api-client.ts`; promo codes are not backed by the server yet.
