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

## Meta Marketing API version gate — verified 2026-11-15
- Official Meta version schedule lists Marketing API **v21.0 expired September 9, 2025**, and v24.0 expired October 6, 2026; v25.0 is supported. Do **not** confuse Marketing API retirement dates with the longer Graph API v21 lifetime (until January 21, 2027).
- Existing `getMetaGraphApiVersion()` default v21.0 remains untouched for Facebook Pages and Instagram Graph OAuth. Meta **Ads account discovery and insights only** now use `getMetaMarketingApiVersion()` pinned to `v25.0`, with `META_ADS_MARKETING_API_VERSION=v25.0` server-only environment override; invalid/expired overrides fail closed, not downgraded.
- Requires real `ads_read` connection with owned Meta account and Meta app permissions plus staged provider response before declaring operational. Cannot guarantee Meta's v25 fields are approved for this app from source alone; do not auto-enable public beta flags.
- Source: https://developers.facebook.com/docs/graph-api/changelog/versions/ (version schedule); https://developers.facebook.com/docs/marketing-api/insights/v9.0 (permission requirement).
