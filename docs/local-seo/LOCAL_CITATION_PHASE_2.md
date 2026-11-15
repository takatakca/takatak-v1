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
