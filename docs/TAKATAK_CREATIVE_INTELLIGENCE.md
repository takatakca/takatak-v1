# TAKATAK Creative Intelligence — foundation and release gates

Date: 2026-11-15. Owner request: build an original TAKATAK feature inspired by the *concept* of Motion Creative Benchmarks, not a copy of its proprietary dataset, algorithms or visual assets.

Tracking: [GitHub #299](https://github.com/takatakca/takatak-v1/issues/299).

## What the M0 branch actually adds
- A **read-only, same-account campaign** comparison panel to the already-subscribed Meta Ads dashboard. It reuses the existing signed, brand-scoped `/api/social/meta-ads/analytics` response and `ads_read` scopes. No new provider call, OAuth scope, database model, schema migration, billing or automation.
- CTR/CPC/CPM **unweighted per-campaign medians** from complete campaign responses, subject to at least three campaigns with 1,000 impressions and 10 units of account-currency spend *each*. Each shown metric must have three valid reported values. Rows display at most eight campaigns, sorted by spend, not effectiveness.
- Honest unavailable states for incomplete campaigns, insufficient sample or missing metrics. These thresholds are TAKATAK M0 safety choices, **not independently validated industry standards**.
- Existing server authorization and selected account retain full control; the UI receives no other client's data.

**Important limitation:** campaign comparisons are NOT creative benchmarks. The existing Meta connection returns campaign-level stats but does not yet import ad-to-creative join data. This panel must never say it identifies winning ads, industry percentiles, profits, causal ad effectiveness or competitor performance. Objectives, placements and attribution windows differ.

## M1 implementation (not yet built)
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
