# 00 — Legacy host transition notice → TAKATAK transfer request

**Owner correction, 2026-11-05 · Agent GPT-6**
**Status:** Code proposed in PR; **not deployed**. No DNS, MochaHost, registrar, email, Stripe or Coolify settings were changed.

## What the owner actually requested

The legacy website/entrypoint on MochaHost should **not** lock customers into a MochaHost account, clone a hosting login, or move customer websites unilaterally. It should show:

> Bonjour, notre serveur a déménagé !
> Nos services et abonnements se poursuivent sur TAKATAK.CA.
> Demander mon transfert.

The button opens **https://takatak.ca/transfert**, a public TAKATAK intake form. Users can request **website only, domain only, or both**, name the existing registrar/host, and leave contact info. The request is **not** itself consent to make DNS changes, registrar EPP transfer, copy data, or take payment. Existing client subscriptions/credits must be reconciled before quoting/invoicing.

## Files

- `deploy/legacy-mochahost/index.html` — standalone responsive HTML notice for a **specific approved legacy landing host**. No auth, no provider redirect. Not automatically published.
- `src/app/(website)/transfert/page.tsx` — public page on TAKATAK, not behind dashboard login.
- `src/components/website/transfer/LegacyTransferRequestForm.tsx` — simple intake. Reuses `submitWebsiteRequest` and `POST /api/public/website-requests`.
- `docs/00-LEGACY-HOST-TRANSFER-TRANSITION.md` — these operating instructions.

## Request handling

The public form creates a **project_request Lead** with category `legacy-migration`, source `/transfert`, requested scope, domain, self-reported provider, and contact details. It uses existing origin checking, limits, honeypot, workspace routing and audit log. Success shows a real request reference. Failures do not claim successful submission. No passwords, EPP transfer codes, or financial data should be collected.

**Production prerequisites (do not assume they are already met):**
- Existing `WEBSITE_LEADS_ENABLED=true`, `WEBSITE_LEADS_CLIENT_ID` set to the authorised TAKATAK agency Client id, database/lead intake healthy.
- Owner/operator approval of exact old domain/subdomain to receive the notice.
- Live `/transfert` URL smoke test including a controlled test lead visible to staff at `/dashboard/leads/inbox`.
- Verify the user's legacy account/payment reconciliation and human-led migration workflow separately.

## Safe legacy-host rollout — human-controlled

1. **Identify the intended legacy entrypoint** (e.g. a retired provider landing / subscription portal, **never** a customer's independently operating storefront). Inventory its active paths and forms.
2. Back up its current website files and any old configuration; preserve rollback.
3. Upload the HTML from `deploy/legacy-mochahost/index.html` to a **staging directory**, for example `/transition/index.html`. Test with a browser before replacing the entrypoint. Do not overwrite existing WordPress `index.php` or other production files blindly.
4. Verify `https://takatak.ca/transfert` receives a real test request; confirm the lead reference and receipt in the authorised TAKATAK inbox. Test mobile, invalid domain, missing contact, errors and no duplicate charge.
5. Only after written approval, make the notice the legacy landing page while preserving authorised cPanel/domain/email access and non-entrypoint routes. Monitor and be ready to restore the prior landing backup immediately.
6. **Do not** change nameservers, A/AAAA/CNAME/MX, SPF, DKIM, DMARC, DNSSEC, or existing site destinations to accomplish this landing-page step. Registrar transfer and hosting migration are different.
7. Preserve the old host while any customer site/email/domain depends on it. Remove only after verified inventory, backups and explicit cutover approvals.

## What NOT to ship from earlier draft

PR #229, `feat/vip-transfer-ai-foundation-20261029`, currently emphasises an authenticated **MochaHost provider login** from `/dashboard/web-hosting/domain-portal`. That handoff may remain as optional support for customers who truly need direct provider account access, but **it must not be the primary migration CTA or mandatory first step**. Do not merge or activate the legacy redirection concept as a customer lock-in. Public notice → TAKATAK intake → verified support → separate price/Stripe step → authorized transfer.

## Financial state

This page **does not activate payments**. VIP CAD 500/year and eligible domain CAD 20/year are proposals tracked in issue #228; confirm eligibility, taxes, legacy balances/credits and Stripe product/renewal integration before issuing a checkout link. Never charge legacy customers automatically or imply payment completed.

## Verification / evidence

- New public route does not require MochaHost credentials or dashboard login.
- Legacy HTML CTA targets only `https://takatak.ca/transfert`.
- Form includes scope/site/domain, verified origin backend, consent, no sensitive credential fields.
- Test with a healthy enabled lead API **before** live legacy notice; report success reference without leaking contact data.
- Run existing CI/typecheck/build/QA before merge; without a live connection no test submission can be honestly claimed.
- Main site `/`, existing dashboard, DNS, and billing remain unchanged by this branch.

**Handoff / signed:** GPT-6 · 2026-11-05 · Proposed implementation, no deployment.
