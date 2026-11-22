# TAKATAK managed domain / website transfer intake — 2026-11-22

Signed GPT-6 @ ChatGPT; **domain transfer workflow only**, explicitly excludes Coolify/server cleanup and DNS work.

## Before
- Existing `/transfert` form sends a `project_request` to the existing `/api/public/website-requests` Lead Inbox, subject to server-configured intake, rate limits, validation, spam/honeypot handling and client/contact checks.
- Existing form asks domain, provider, site/domain/both, identity, contact, notes and consent. It does **not** record customer-declared renewal date or a specific existing-email preservation instruction.
- Owner's latest message specifies **CAD 500 + taxes** for transfer work. Existing prices are different: domain registrar transfer CAD19.99 once (website catalog), VIP transfer service CAD500/year, eligible domain CAD20/year, starter website CAD499 once. **These are not interchangeable products.** Do not launch Stripe checkout or overwrite the existing products.
- The existing renewed-domain notice panel is server gated and OFF by default; historic MochaHost inventory of 42 active customers is not yet reconciled to verified customer workspaces and current renewal data.

## This increment — no live transfer
- Add optional customer-declared renewal date with strict ISO calendar validation; missing date explicitly stays unknown and a declared date is never presented as registrar verified.
- Add explicit `keep_current` email preservation default; optionally request an email-plan review, or declare no existing email. Current mail, MX, DNS and website state never change in this intake.
- Offer wording: **proposed one-time managed transfer service CAD500 plus applicable taxes, subject to a separate written quote and customer approval**. No tax calculation, checkout, card details, charge, subscription or entitlement change.
- Build a pure validated Lead Inbox summary from scope/domain/provider/mail preference/date; reject simple credential/code disclosures and control-char fake fields. Preserve initial-contact-only consent.
- Continue using the existing Lead Inbox API and secure validation. Do not add public provider credentials, migrations, new tables, jobs, emails or new hosting platforms.
- Deterministic QA: `npm run qa:managed-transfer-intake`; CI workflow `Managed transfer intake (read-only quote)`. This validates leap days, missing renewal date, mail retention, distinct price cadence, secret detection, CRM provenance, and no payment or DNS action.

## After: before a public charge, customer notice or transfer
1. Exact-head PR CI + complete TAKATAK CI green, review against latest main and preserve existing `/transfert` working behavior.
2. Confirm the Lead Inbox intake is enabled and can record a real **authorized test request**. Verify fields and customer contact are saved, dedupe/rate limits work, no credential leakage and success gives only a reference. Test server unavailable path and email fallback.
3. Confirm live registrar renewal date, domain holder, historic invoices/credits, domain rights and workspace association; label the date as verified only after authoritative provider evidence.
4. Owner decides the contract separation between one-time managed migration CAD500+tax and VIP CAD500/year, annual domain fee CAD20 and standard domain transfer CAD19.99. Produce an approved written quote and tax handling; **no automatic charge**.
5. Implement a deduplicated reminder delivery ledger (e.g. 60/30/7-day operations), owner-approved website notice injection at 30 days, consents/unsubscribe, and monitoring. Do not claim customer emails or websites have received notice.
6. For `mielaissa.ca`, preserve WordPress/WooCommerce cart, checkout, login and loyalty points; any transfer requires backups and owner-approved recovery/rollback before changing DNS or websites.

No staged or production deployment of customer services is part of this source increment. No Coolify actions.
