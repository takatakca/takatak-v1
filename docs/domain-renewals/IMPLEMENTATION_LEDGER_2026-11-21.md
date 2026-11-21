# Domain renewals — safe rollout ledger (2026-11-21)

**Owner request:** start the existing TAKATAK + MochaHost domain-transfer implementation, no new hosting stack and no staging. Signed: GPT-6 @ ChatGPT (2026-11-21).

## Before — checked
- Source repo `takatakca/takatak-v1`, main baseline `595c32f7e7f45fec008c610ffef2c8ce615b0d48`; read AGENTS, coordination #105, WORKLOG, decisions, task queue, current PRs, domain manager and Upmind sync.
- Existing `/dashboard/web-hosting/domains` is scoped to the signed-in customer and calls `syncUpmindDomainsForSession`; `getDomainAssetsData` reports whether database or mock fallback was used. Demo entries are already hidden.
- Previous `isExpiringSoon` labels a domain as expiring; no verified MochaHost renewal import, automated website banner, notification delivery, registrar API, checkout product reconciliation, or live transfer job is proven.
- Read-only 2026-11-03 MochaHost inventory in private Drive records 42 active domains. `locactif.ca` has recorded 2026-12-14 renewal and `mielaissa.ca` 2027-08-01. These are historical snapshot dates, **not** refreshed registrar observations. No 42-domain import or tenant mapping is attempted.

## During — this scoped implementation
- Pure `getDomainRenewalNotices` utility: database source only; active/tracked domains only; valid ISO calendar date and domain required; inclusive 0..30 UTC-day range; rejects missing providers, demo, cancelled, expired, planned, unknown and duplicate domain names rather than guessing.
- Server-only `TAKATAK_DOMAIN_RENEWAL_NOTICES_ENABLED=true` gate (default OFF) on existing domain page. Render a read-only, tenant-scoped warning panel and existing `/transfert` support link; do not inject any code into legacy/customer sites.
- Copy explicitly states that expiry dates are **recorded**, not live provider verification. Auto-renew is shown as recorded, not guaranteed. No payment, notification, DNS, mail, hosting change, transfer or external call.
- New deterministic QA `npm run qa:domain-renewals` covers expiry boundaries, calendar dates, duplicate records, data source isolation and no-write UI contract. Dedicated CI runs on proposed PR.

## After — gates for activation
1. Verify PR's exact-head checks and review against current main. Do not activate, merge into production or mutate real sites from a red CI.
2. Compare the customer account's live registrar renewal date, `clientId`, actual domain owner and Upmind link. Investigate duplicates and prior MochaHost charges. No broad import from a spreadsheet into customer workspaces until proof.
3. Once merged, a Coolify operator can set `TAKATAK_DOMAIN_RENEWAL_NOTICES_ENABLED=true` for the existing production TAKATAK app, **only after** read-only A/B tenant checks. Compare actual served release SHA, /api/health/ready and /dashboard/web-hosting/domains in authorized accounts. Remove flag to hide the panel.
4. Acceptance on signed-in authorized test accounts: 31 days gives no notice; 30, 7, 0 show recorded warning; expired or cancelled hidden; no incorrect cross-tenant domain. Test auto-renew wording, mobile layout and /transfert click. No notice if Upmind/DB is unavailable.
5. Separate future work: secure MochaHost inventory sync and 42 customer mappings, deduplicated 60/30/7 notification ledger with opt-outs and consent, site-specific opt-in notice placement, and *explicitly reconciled* pricing: owner's latest one-time CAD 500+tax transfer service versus existing CAD 500/year VIP, CAD 20/year eligible domain, CAD 100 legacy page, CAD 19.99 domain catalog, and CAD 499 starter website. No payment activation or auto-renew.
6. `mielaissa.ca`: preserve its live commerce and loyalty routes. Any site-specific notice must be independently authorized and tested without intercepting POST, login, cart or checkout. No Node migration/cutover is part of this increment.

**Never report deployment as complete from a green PR alone.**
