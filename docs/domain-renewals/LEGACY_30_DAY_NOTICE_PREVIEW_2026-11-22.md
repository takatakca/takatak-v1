# Legacy domain renewal notice — 30-day verified preview (2026-11-22)

**Domain-transfer work, NOT Coolify work.** Signed GPT-6 @ ChatGPT (2026-11-22).

## Purpose
Prepare the owner's request to show the **domain renewal / TAKATAK transfer** message one month before expiration. This phase is **operator preview only** and does not alter MochaHost, DNS, email, payments, registrar, customer websites or TAKATAK production flags.

Existing public transfer URL: https://takatak.ca/transfert . PR #386 merged into main at 0a2199f7 (date + email-preservation preference + CAD500 one-time quoted service), and existing UI posts intake to the agency Lead Inbox. This is not evidence of a successful public lead until an authorized test is performed.

## Before
- MochaHost's 42 active domain inventory in Drive was last read directly 2026-11-03, and expiry dates have not been refreshed during this phase. **Never** treat that old snapshot or a customer-entered field as verified registrar evidence.
- Current dashboard renewal policy (`src/lib/web-hosting/domain-renewal-notices.ts`) is gated OFF and uses workspace domain records, not arbitrary old hosts.
- The existing `deploy/legacy-mochahost/index.html` is a full-page transition **template**; it is **not** automatically injected into customer sites. A store/WordPress front page must not be replaced by this notice.
- The user explicitly requested no staging. Any review artifacts can be rendered locally and reviewed in GitHub; no staging site or new hosting environment is required.

## Code added, no publication
`src/lib/web-migration/legacy-domain-renewal-preview.ts` exports a deterministic policy and accessible preview HTML renderer.

It denies the preview unless:
1. Domain and exact legacy landing hostname match and have valid domain syntax.
2. Expiry and registrar checked-at dates are ISO calendar days.
3. Registrar date is marked verified by an authorized operator from actual provider evidence, **checked no more than seven UTC calendar days ago**.
4. Domain holder and TAKATAK customer workspace have each been independently verified; no cross-customer guessing.
5. Owner has approved the notice and explicitly approved this *specific* legacy landing page.
6. The landing hostname has no active website/store/checkout to replace and existing email will stay unchanged.
7. Renewal is between **0 and 30 UTC days away, inclusive**; expired or >30-days-away records are ineligible.

Even when every flag is true, **the renderer generates only a `noindex,nofollow`, prominently watermarked `APERÇU OPÉRATEUR — NON PUBLIÉ` HTML review string**. This boolean policy is *not* proof the registrar was checked: the operator must retain real provider evidence outside GitHub and issue written approval for any eventual per-site publication. No secrets or private owner records in public GitHub. One-site-at-a-time review with rollback required.

Preview displays the date, remaining days, and a link to `https://takatak.ca/transfert`. It cannot pay, automatically renew, redirect on load, modify DNS, collect credentials or override an existing WordPress index.

## QA / boundaries
`npm run qa:legacy-renewal-preview`, dedicated PR workflow. Tests 31, 30, 22, zero and expired day cases, invalid/leap dates, old/future registrar checks, domain mismatch, owner/workspace gates, no email/site changes, no network/checkout functions.

## Real-world follow-up gates
- Verify PR exact-head focused and full Node22 CI.
- Confirm **the exact public served SHA** and `/transfert` form via authorized production test; inspect agency Lead Inbox to establish actual receipt. No fake submission or live customer notification.
- Obtain fresh MochaHost/registrar expiry, domain owner, scope/tenant mapping for each **individually authorized** domain from the historical 42 list. Do not import, send reminders or publish from unverified spreadsheet rows.
- Before any customer notice goes live: verify the specific legacy entrypoint isn't an operating site; obtain written approval, backup + restore plan, preserve email/MX, and test customer flow. No automatic DNS migration.
- Separate pricing review: managed-transfer quote **CAD500 one-time + applicable taxes**, not VIP CAD500/year or registrar transfer CAD19.99. Never auto charge.
