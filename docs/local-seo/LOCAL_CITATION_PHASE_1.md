# TAKATAK Local Citation — first functional increment (2026-11-15)

Branch: feat/local-citation-nap-audit-20261115. Existing billing and authentication remain unchanged.

## Delivered in this branch (not yet merged / deployed)
- Browser-local CSV evidence comparison at /dashboard/local-listings/citations/audit.
- Reference fields: name, address, phone, website.
- Import up to 500 supplied listing evidence rows (250 KB) with quoted CSV parsing.
- Field-level mismatch/missing comparisons, potential duplicate detection, and correction CSV export.
- No network calls or server upload of manually entered evidence; no database migration or provider spend.
- Unit tests and a PR test workflow.

## Truthful scope and limits
This is NOT BrightLocal's online citation discovery/publishing, nor a provider API connection. It cannot confirm any directory page exists, cannot prove the data in CSV is current, cannot submit changes to Google/Apple/Bing/Meta, and has no AI auto-publishing. "Consistent" means consistent with customer-supplied evidence only.

The production Local Listings foundation currently uses internal/demo citations and remains unchanged. Existing SEO/social/upmind work is preserved. Never claim live synchronization based on these audit results.

## Safe next increments
1. Current-workspace-owned business profile CRUD with audit log and permission checks.
2. Secure directory connector registry with official API, capability state, approval and rate limits; do not use unauthorized scraping.
3. Provider-backed import, provenance, last-sync and idempotent publishing queue; protect verified ownership.
4. Licensed/authorized local grid-rank, keywords, technical site crawl, backlink evidence.
5. AI recommendations with approval and rollback, then measured multi-tenant live tests.

## Acceptance gate
PR CI + types/build + tenant A/B auth tests + real customer workflow + coordinator release approval + live deployment SHA + app and provider smoke tests, before reporting the full suite functional.
