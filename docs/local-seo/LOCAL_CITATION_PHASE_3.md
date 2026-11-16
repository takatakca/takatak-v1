# TAKATAK Local Citation — Phase 3: live official Google NAP read (manual, gated)

Date: 2026-11-16. Epic: https://github.com/takatakca/takatak-v1/issues/302.

## Scope and sources
This phase adds **an on-demand read-only request** to the official Google Business Information v1 locations/{id} endpoint. It does NOT scan Yelp, Apple, Bing, or arbitrary directories. It does NOT publish, correct listings, buy advertising, charge customers or automatically write to TAKATAK's database.

The server action receives only the selected SocialAccount UUID. It re-resolves that ID in the authenticated selected workspace with a connected google_business provider, selected account status and manage_integrations permission. The location's official locations/{id} name comes from the authorized database record, NEVER client input. Reuse the existing provider loadGoogleAccessToken() and its encrypted Social OAuth credential, with no second Google login.

The GET uses HTTPS only, a fixed official Google hostname, an explicit readMask, redirect:error, no-store, an abort timeout, and sanitizes the response to name, street/postal address, primary phone and website. Returned data is in-memory UI evidence and marked with the successful request time. The business website is **not** presented as a Google listing URL.

## Safety / feature gate
Server env TAKATAK_LOCAL_CITATION_GBP_LIVE_READ=false by default. The UI shows a disabled-state message until server env is deliberately enabled. Manual button only; there is no cron or scheduled provider fetch. A 120-second per selected workspace/location process-local cooldown mitigates single-instance bursts, but **is not a distributed quota guarantee**; before high-volume rollout add a durable per-tenant rate limit. Fail closed on 401/403, 429, malformed location or timeout. No token or provider response logged. Existing billing remains unchanged.

Google Business Profile access may require project approval; a **zero quota means the project has not been granted access**, per official documentation:
- https://developers.google.com/my-business/content/limits
- https://developers.google.com/my-business/content/location-data
- https://developers.google.com/my-business/reference/businessinformation/rest/v1/locations/get

## Acceptance
1. Exact-head CI (focused Google URL/response validation, authorization source contract, TS/lint/build and tenant regression) green.
2. Review and merge without overwriting unrelated main work.
3. Verify Coolify runtime SHA, database readiness and the flag remains OFF initially.
4. In an approved single owned test workspace with valid google_business OAuth and API quota, enable flag server-side, open audit, select exact connected Google location and click manual verify. Confirm returned NAP is current and time-stamped, 403/429 failures are honest, client B cannot read A by sending A's account ID, unprivileged role denied. Rate-limit test. Do not perform listing writes.
5. Observe production and decide separate authorization for a durable quota policy / automated periodic checking. No paid providers, AI autopublishing or listing updates in this phase.

Until steps 3–4 are proven this is **tested code**, not a verified live Google API connection. The full platform's 100% release target remains open in issue #302.

Signed GPT-6 @ ChatGPT.
