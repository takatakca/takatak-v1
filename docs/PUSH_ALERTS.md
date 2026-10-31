# Deal alerts on devices (browser push)

Built 2026-10-31 on branch `claude/upbeat-einstein-zqkf58` (PR #233), brief item B. Signed at the bottom.

## What a visitor sees

On every campaign page (`/offres/<code>`) and on the "offer not running" page, the deal-alert card has the email
form and, below it, **"Or get an alert on this device"**. Nothing pops up by itself.

1. Click → our own question with the full consent sentence (who, what, how to stop, not email/SMS consent) and
   two buttons: **Yes, alert me** / **No thanks**.
2. Only after **Yes** does the browser ask for notification permission.
3. On: "Deal alerts are on for this device · Stop". **Stop** removes the device at once.

Hidden when the browser cannot do push (for example iPhone Safari outside an installed web app) or when the
feature is off.

## How it works

- The device subscription is saved as a **Lead** of the source **"takatak.ca push alerts"** (no new table), with the
  consent proof: version, exact text, language, time, page, hashed caller address,
  method `own_prompt_then_browser_permission`.
- Pushes carry **no content**. When one arrives, the service worker (`public/takatak-push-sw.js`) reads the live
  campaign from `/api/public/push/latest` and shows "−N % · ends <date>" with a link to `/offres/<code>`. A
  notification can never show an offer that has ended.
- Sending: `POST /api/admin/push/send` with `{ "code": "<CODE>" }`, **platform admins only**. Refused unless that code
  is a campaign live in the server catalog right now. Devices the push service reports gone (404/410) are stopped
  automatically. Each send is in the audit log (`push_campaign_sent`, counts only).

## To turn it on (owner)

1. Generate a VAPID key pair once (for example `npx web-push generate-vapid-keys` on your computer).
2. In Coolify, takatak.ca app: `PUSH_VAPID_PUBLIC_KEY` and `PUSH_VAPID_PRIVATE_KEY` (with `WEBSITE_LEADS_ENABLED` and
   `WEBSITE_LEADS_CLIENT_ID`, already used by the forms). Never change the pair afterwards.
3. When a campaign is live (one line in `src/lib/promotions/catalog.ts`), a platform admin sends the alert.

Tests: `npm run qa:push`.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-10-31
