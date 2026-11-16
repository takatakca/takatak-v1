# TAKATAK Local Citation — Phase 2: stored provider evidence

Date: 2026-11-15. GitHub epic: https://github.com/takatakca/takatak-v1/issues/302.
This is an incremental enhancement to the Phase 1 CSV audit, not a claim of complete BrightLocal/Yext parity.

## Design and ownership
- Under existing `/dashboard/local-listings/citations/audit`, reuse current TAKATAK login and active `client_scoped` workspace. No new account, billing service or standalone repository.
- Existing `LocalListing` is available as reference NAP. `ListingCitation` sources `manual`, `qmaps` and `provider_api` supply saved *evidence*, when status is not planned/archived. Only explicit `metadata.observedNap` is used as observed values; never convert a linked reference listing into independent proof of directory content.
- Existing authorized Social Google Business Profile account discovery stores location metadata from the official Google Business Information API. The provider already requested `phoneNumbers` in the readMask, but previously discarded the primary phone. This change preserves `primaryPhone` in encrypted-connection-scoped SocialAccount snapshots after a new authorized discovery. Old snapshots may lack the phone. Profile `profileUrl` actually holds the business website, NOT the Google listing URL: keep `listingUrl` empty for Google evidence.
- Saved citation rows are associated only when same exact local listing or Google account ID matches; brand-only records may match within one brand, but do not match separate specific locations by brand alone.
- Limit evidence to current tenant, currently connected selected Google account and capped saved citation reads. Cross-tenant, global-admin and foundation-demo modes get no saved evidence. No new migration, no client-supplied IDs, no new provider API calls.
- Client can select **my CSV** (kept in browser) or **linked saved evidence** (read from existing database); missing fields are flagged for verification, not claimed correct.

## Reliability
- Pure tests: evidence metadata provenance, matching locations, URL safety, Google phone parser, missing phone and address.
- Dedicated PR GitHub workflow plus full V1 Node22 CI/typecheck/lint/build/security tests.
- No external publishing, directory crawling, competitor indexing, link-building automation, payment, or API-key changes.
- Existing Social, QMAPS and Growth UX unaffected.

## Release and operational gates
1. Check exact main SHA, concurrent PR ownership and `AGENTS.md`.
2. Green targeted and complete CI after final branch changes; coordinator review before main merge.
3. Preserve rollback artifact/previous verified image; no migration.
4. Confirm actual Coolify deployed commit `X-TAKATAK-Release` and trusted readiness; testing the public URL is not equivalent to provider verification.
5. Authorized two-workspace test (A cannot view B; no other brand/location auto comparison) and selected current Google account test.
6. Even when code is live, true publisher discovery, listing create/update, monitoring, AI SEO autopublishing, rank grids, backlink index, comprehensive competitor intelligence remain separate open items in issue #302. Never call full suite 100% live until evidenced.

Signed GPT-6 @ ChatGPT — coded scope; production requires proof.

## Official Google documentation and access prerequisites
- Business Information Location schema, including `phoneNumbers.primaryPhone`: https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations
- Basic API access and zero-quota approval status: https://developers.google.com/my-business/content/limits
- Current prerequisites and OAuth/API access process: https://developers.google.com/my-business/content/prereqs
The project must be approved for Google Business Profile API access; a 0 QPM quota means access was not granted. No provider API calls are introduced by this PR, and the future location-discovery run will be subject to the existing provider's OAuth, permissions and API rate limits.

## 2026-11-16 — current-main security hardening
- Ported Phase 2 files onto latest main (no overwrites to Meta/Studio changes).
- Brand-only citation evidence never auto-matches a location; requires exact localListingId or socialAccountId. Multi-location attribution is fail-closed.
- Stored citation records without explicitly observed NAP values are excluded from evidence (not counted as inspections).
- No automatic provider writes, charges, API requests, migrations or external directory scanning.

2026-11-16 user/operator smoke evidence: Owner session reported first-phase audit page renders and selected workspace profiles only; one duplicated Club Havana Camping label; CSV real import/export NOT yet exercised. This report is provided by user, not a verified agent-controlled browser test. Phase-2 deployment not yet proven. Further tasks in issue #302.

## 2026-11-16 second reconciliation gate
Ported this CI-green phase-2 increment onto the then-latest main cd834ccf while preserving AI File Organizer updates. Owner reported phase-1 page loads in the owner account. Real CSV import/export, cross-tenant authenticated smoke, provider API discovery and Coolify exact served SHA remain separate release gates. No billing, migrations, automatic directory calls or publishing were enabled.

## Same-name saved profile UX (QA follow-up #323)

An owner's authenticated UI test showed Club Havana Camping twice in the profile selector. No evidence establishes whether those are duplicate database records or separate TAKATAK/Google entries. The next UI increment disambiguates same-name options by source (saved TAKATAK listing vs connected Google snapshot), stored address and a short stable record reference. Matching names are normalized (case, accents, punctuation), but records are **never merged or deleted automatically**, including across different business locations. The change does not load other clients' records, issue provider requests or change billing.

Required production acceptance: select each option in the owner's session, confirm correct NAP and linked citation evidence; verify another client sees none of these profiles; inspect actual record IDs only in authorized administrative tooling before considering cleanup. Issue #323 retains data-level investigation.
