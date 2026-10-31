# takatak.ca newsletter (infolettre)

Built 2026-10-31 on branch `claude/upbeat-einstein-zqkf58` (PR #233). Signed at the bottom.

## What a visitor sees

- A block on the homepage (after the FAQ) and a shareable page, `/infolettre`.
- Topic chips (offers, Academy tips, new services), an email field, and **its own checkbox, never pre-checked**,
  with the full consent sentence: who asks (Groupe TAKATAK), the mailing address, a contact, the purpose and the
  right to withdraw. "Subscribe" stays disabled until the box is ticked.
- A line saying the consent covers email only: notifications and texts are asked for separately.
- After sending: "Open the email we just sent you and click Confirm" (double opt-in). Nothing is sent before the
  confirmation.

## Where the data goes

Each subscriber is a **Lead** of the source **"takatak.ca newsletter"** in the TAKATAK agency workspace
(`/dashboard/leads`), priority low. No new table, no migration. One record per address. The lead's metadata holds:

- `newsletter.status`: `pending` → `confirmed` → `unsubscribed` (the lead is archived on unsubscribe);
- `newsletter.consents[]`: **proof of consent**, one entry per sign-up: wording version, the exact sentence shown,
  language, date and time, page, hashed caller address (never the raw IP), method `web_form_checkbox`;
- `confirmedAt`, `unsubscribedAt`, `topics`.

The audit log records `newsletter_consent_recorded`, `newsletter_confirmed`, `newsletter_unsubscribed`.

## Links

- Confirm: `/infolettre/confirmer?t=<token>`; the page posts the token only on a click (mail scanners that open
  links confirm nothing).
- Unsubscribe page: `/infolettre/desabonnement?t=<token>`, effective at once.
- One-click unsubscribe for mail apps (RFC 8058): `POST /api/public/newsletter/unsubscribe?t=<token>`. Put these two
  headers on every newsletter:
  - `List-Unsubscribe: <https://takatak.ca/api/public/newsletter/unsubscribe?t=TOKEN>`
  - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- Tokens are HMAC-signed per purpose and per subscriber (`NEWSLETTER_TOKEN_SECRET`): a confirm link cannot
  unsubscribe, and no one can build a link for another address.

## For the agent who sends the newsletter (TWILO)

1. Send only to leads of the source "takatak.ca newsletter" whose `newsletter.status` is `confirmed`, and only on
   the topics they picked.
2. Every message ends with the footer from `messageFooter()` in `src/lib/newsletter/consent.ts` (sender name,
   mailing address, contact, unsubscribe link) and carries the two `List-Unsubscribe` headers above.
3. The unsubscribe link for a subscriber: `newsletterLinks(id, secret).unsubscribe` in
   `src/lib/newsletter/server.ts`.
4. An unsubscribe is applied at once by the site. Re-check the status right before each send.
5. Offers in a newsletter follow the site rules: real regular prices, real end dates, no invented guarantee.

## To turn it on (owner)

Set in Coolify, takatak.ca app (names only here, values never in the repository):

| Key | What |
| --- | --- |
| `WEBSITE_LEADS_ENABLED`, `WEBSITE_LEADS_CLIENT_ID` | already used by the website forms |
| `NEWSLETTER_TOKEN_SECRET` | 32+ random characters; changing it breaks links already sent |
| `NEWSLETTER_SENDER_ADDRESS` | the public mailing address of Groupe TAKATAK, one line (**owner decision**) |
| `SENDGRID_API_KEY` + `SENDER_EMAIL`, or Gmail SMTP | to send the confirmation email |

Until all of it is set, the form shows "Sign-ups open very soon" and the API answers `not_enabled`.

Tests: `npm run qa:newsletter`.

— signé : Claude (cloud session upbeat-einstein) @ Claude Code cloud · 2026-10-31 14:13 UTC
