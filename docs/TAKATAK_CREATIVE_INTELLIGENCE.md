## Active delivery branch (2026-11-15)
- **Active draft PR:** https://github.com/takatakca/takatak-v1/pull/303, rebased from current main `176966c4` with existing Local Citation feature preserved.
- Previous PR #300 was **closed unmerged** because its WORKLOG conflicted with the newly merged Local Citation #301. All Creative Intelligence files were transplanted to #303; do not revive the old branch.
- Default-off flags and exact-SHA CI + live authorized Meta QA must be satisfied before enabling UI/API or calling this deployed.
- Overall project percentage is **indicative ~20%** and actual live deployment of the new feature remains **0% verified**. The final product includes rights-cleared industry benchmarks, legitimate creative assets, attribution-aware analytics, FR/EN, and real on-site acceptance.

# TAKATAK Creative Intelligence — foundation and release gates

Date: 2026-11-15. Owner request: build an original TAKATAK feature inspired by the *concept* of Motion Creative Benchmarks, not a copy of its proprietary dataset, algorithms or visual assets.

Tracking: [GitHub #299](https://github.com/takatakca/takatak-v1/issues/299).

## What the M0 branch actually adds
- A **read-only, same-account campaign** comparison panel to the already-subscribed Meta Ads dashboard. It reuses the existing signed, brand-scoped `/api/social/meta-ads/analytics` response and `ads_read` scopes. No new provider call, OAuth scope, database model, schema migration, billing or automation.
- CTR/CPC/CPM **unweighted per-campaign medians** from complete campaign responses, subject to at least three campaigns with 1,000 impressions and 10 units of account-currency spend *each*. Each shown metric must have three valid reported values. Rows display at most eight campaigns, sorted by spend, not effectiveness.
- Honest unavailable states for incomplete campaigns, insufficient sample or missing metrics. These thresholds are TAKATAK M0 safety choices, **not independently validated industry standards**.
- Existing server authorization and selected account retain full control; the UI receives no other client's data.

**Important limitation:** campaign comparisons are NOT creative benchmarks. The existing Meta connection returns campaign-level stats but does not yet import ad-to-creative join data. This panel must never say it identifies winning ads, industry percentiles, profits, causal ad effectiveness or competitor performance. Objectives, placements and attribution windows differ.

## M1 preview now coded on this branch (not yet verified live)
- An authenticated `GET /api/social/meta-ads/creatives` route resolves the selected client, brand and Meta ad account **server-side**. Caller may specify a validated start/end date (at most 31 days); never accepts a client/brand/account ID.
- On-demand (button click only): reads `level=ad` insights and bounded `/ads` metadata with `creative{id,name,object_type}` from the *same* authorized Meta Ads account. `ads_read` is already the original OAuth scope, but actual access and field availability require an authorized live Meta test.
- Cap: 3 pages and 100 rows per source, with incomplete/permission-denied states; per-account in-process 20-second cooldown (not a global quota), no secrets in browser. The UI displays up to 50 individual ads sorted by reported spend.
- No assumptions about images, video assets or Advantage+ dynamic asset variants. One row is **one ad**, not a creative asset or a peer/industry score. Missing metadata or performance is shown as unavailable. No actions, ROI or purchases assumed.
- Pure ad-to-creative mapper, malformed-value tests and route-source isolation checks in `scripts/meta-ad-creative-report-tests.ts`. Integrated in CI through `qa:social-meta-ads`.

## M1 next implementation (still missing)
1. Verify current Meta permissions, account authorization and API-level availability for ad-level insights. Query selected `act_<id>/ads` with creative identifiers and ad-level insights only after per-tenant account resolution; never accept a browser-supplied tenant ID. Link images/videos/text only if authorized and returned.
2. Join ad results to creative metadata by exact IDs; maintain explicit unsupported and partial coverage status (dynamic/Advantage+ creative may not give asset metrics). Normalize campaign objective, goal, period, currency, attribution window and placement before comparison.
3. For video creative evaluate only metrics actually returned: plays, 3-sec views, ThruPlay etc. Track sample, defined formulas, source and timestamp. Add safe video asset handling, export and human-reviewed recommendations.
4. Add bounded paging, idempotent sync, caching, rate limit and estimated request-operation logs; background operations require explicit approval and no unseen provider spend.

## M2/M3 external industry reference
- Industry benchmark claims require legally reusable third-party/reference data with verifiable sampling, geography, vertical, spend tier, date window and consent/licensing as applicable.
- **Do not pool connected Meta client data to make industry benchmarks.** Existing platform policy assessment at `docs/clover-takatak-app/RESEARCH_META_AND_CHANNELS.md` explicitly flags cross-client Meta data aggregation. Seek current policy/legal verification before implementing any pooled benchmarking.
- Motion's advertised sample of 578,750 creatives, 6,015 brands and $1.29B spend is **Motion's study, not TAKATAK data**.

## Validation / release
- `npm run qa:social-meta-ads` (existing checks + new synthetic benchmark tests); `npm run typecheck`; `npm run lint`; scoped UI QA.
- Independent draft PR only; do not merge or deploy until main coordinator has reviewed CI and current branch state.
- Later: live authorized Meta account verification, multi-client isolation tests, consent/privacy retention, FR/EN localization and gated billing decision.

References: https://developers.facebook.com/docs/marketing-api/reference/v27.0 ; https://developers.facebook.com/docs/marketing-api/insights/v9.0 ; https://developers.facebook.com/docs/business-management-apis/business-creative-asset-management/get-started ; https://go.motionapp.com/benchmarks-quiz


## M1 hardening (2026-11-15 follow-up)
- The read-only ad report remains user-triggered, and never uses browser-submitted client/account IDs. The server-side cooldown is bounded and fails closed when 500 active keys are present (no unconditional clearing of active rate limits).
- The report status is **partial** when any ad-level Insight row lacks its matching /ads metadata, even if Meta independently completed both response page sets. No missing creative is represented as a fully confirmed join.
- A user-initiated CSV export uses **only already-loaded authorized rows** (no additional Meta API reads) and writes coverage, period, currency, ad/creative IDs. CSV fields are quoted and potentially executable spreadsheet formulas are converted to text. Synthetic tests validate injection/missing-data behavior.
- **Default-off flags:** `TAKATAK_CREATIVE_INTELLIGENCE_ENABLED=false` (server API) and `NEXT_PUBLIC_TAKATAK_CREATIVE_INTELLIGENCE_ENABLED=false` (UI, build time) in `.env.example`. Both must be explicitly true on a validated release to expose this beta. A rollout needs CI, authenticated real Meta Ads read, two-client isolation smoke, served SHA + HTTPS readiness checks, and existing coordinator workflow. Never enable based on CI alone.
- Neither a successful compiled build nor an attached GitHub artifact proves the module is served in production. This phase is not licensed industry benchmarking, actual video-asset fatigue analysis, profitability, or fully ready for paid users.

## M2 implementation increment: authorized same-campaign ad peers (2026-11-15)
- Client-side-only descriptive medians from **already loaded selected-account ad rows**, grouped strictly by exact campaign ID. This adds **zero** Meta API calls or new credential use.
- Eligible samples require a **complete** Meta ad-level report; at least three distinct ads in the same campaign; each ad >=1,000 impressions and >=10 account-currency spend. Every metric requires three valid reported values, and missing or malformed values are not inferred.
- Display FR/EN campaign name, eligible ad count and median CTR/CPC/CPM (no creativity, return, success or ranking inference). Does not mix campaigns, brands, clients, time periods or currencies. Ads within the same campaign can still differ in audience, placements and attribution, so these medians are **not** causal ad performance or Motion industry benchmarks.
- Implementation: `src/lib/social/analytics/meta-ad-peer-comparisons.ts`, `MetaAdPeerComparisonPanel`, pure synthetic tests `scripts/meta-ad-peer-comparison-tests.ts`, SSR FR/EN tests in `meta-creative-ui-render-tests.ts`; integrated into `qa:social-meta-ads`.
- The new section inherits both **default-OFF** deployment flags from the parent Meta Ads dashboard. Real authorized Meta access, full CI, UI smoke, licensing for external benchmarks and on-host rollout still outstanding.

## Meta Marketing API version gate — verified 2026-11-15
- Meta's official Marketing API v21 expired September 9, 2025, while its Graph API v21 is active until January 21, 2027. Marketing v24 expired October 6, 2026; v25 is documented as supported.
- Ads account discovery and insights use the separate `getMetaMarketingApiVersion()` at v25.0, with optional server-only `META_ADS_MARKETING_API_VERSION=v25.0`. Unsupported overrides fail closed. Facebook and Instagram OAuth continue using the existing Graph API configuration; no global version migration.
- This fixes a CODE DEFAULT compatibility risk, not a confirmed production failure. Validate actual ads_read and fields on an authorized Meta Ads test account before activation. Both Creative Intelligence feature flags stay OFF by default.
- Official schedule: https://developers.facebook.com/docs/graph-api/changelog/versions/ ; Insights permission: https://developers.facebook.com/docs/marketing-api/insights/v9.0

## M2 preview gallery — 2026-11-15 incremental implementation
- A **read-only original creative gallery** is added below the per-ad report. Metadata is requested using an extended `creative{id,name,object_type,thumbnail_url,title,body,video_id,call_to_action_type}` field selection on the **existing, on-demand, account-bound `/ads` request**. No new endpoint, no additional calls, no actions or publication; the current `ads_read` grant remains the only source of authorization.
- This previews thumbnails, title, body text, video identifier and call-to-action **when returned**; it does not fetch videos, render playable ads, break down Advantage+ dynamic assets or guarantee provider media permissions. Expiring thumbnails may become unavailable. At most 12 cards; only already-authorized report rows are rendered.
- Thumbnail URLs are accepted only when HTTPS and hosted on Meta-controlled `facebook.com`, `fbcdn.net`, `fbsbx.com`, `cdninstagram.com` or `instagram.com` and subdomains. Credentials, unsafe credentials in URL, custom ports, fragments, access-token-like parameters or other domains are rejected. No thumbnail URL is included in the CSV. Titles, body, CTA and video identifiers are bounded/sanitized. No media is cached in TAKATAK.
- CSV adds creative title, body, video ID and CTA, with spreadsheet-formula neutralization. Synthetic tests cover safe/unsafe domains, missing fields, metadata joins, FR/EN render and CSV protections. Report and gallery remain behind existing **default-OFF** client/server flags.
- This is **not yet live-verified** and may need per-format fallback if Meta v25 rejects unsupported expanded creative fields on an authorized account. A real owned-account test is required before activating the feature flags.
- Meta SDK field reference: https://github.com/facebook/facebook-php-business-sdk/blob/main/src/FacebookAds/Object/Fields/AdCreativeFields.php ; official Meta Marketing Postman creative reference: https://www.postman.com/meta/facebook-marketing-api/request/xowugm6/retrieving-adcreative-details-l-1 .
