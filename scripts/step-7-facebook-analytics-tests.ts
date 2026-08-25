/**
 * Step 7 — Facebook analytics schedule / range / mapping unit tests.
 * No secrets, tokens, or external IDs in output.
 */

import assert from "node:assert/strict";

import { FACEBOOK_PAGE_METRIC_MAPPING } from "../src/lib/social/sync/facebook-metric-mapping";
import {
  computeIncrementalFetchWindow,
  computeIncrementalJitterMs,
  daysBetweenInclusive,
  planBackfillWindows,
  resolveFacebookAnalyticsRange,
  shiftDateOnly,
} from "../src/lib/social/sync/facebook-page-sync-schedule";
import {
  deriveNetFollowerChange,
  deriveNetFollowerChangeFromDailyFollows,
  pickLifetimeFollowers,
  resolveFacebookSelectedRangeCoverage,
  shiftInsightEndTimeToReportingDate,
} from "../src/lib/social/sync/facebook-range-coverage";
import {
  buildCoveredMetricSeries,
  buildFacebookDailyMetricCreate,
  buildFacebookMetricCoverageMap,
  classifyStoredImpressionsProvenance,
  mergeFacebookDailyMetricUpdate,
  resolvePerMetricCompleteness,
  resolveViewsDisplayFromStoredDays,
  selectLifetimeFollowersAtOrBefore,
  sumConfirmedDailyValues,
} from "../src/lib/social/sync/facebook-metric-write";

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

section("metric mapping");
{
  const views = FACEBOOK_PAGE_METRIC_MAPPING.find(
    (row) => row.dashboardKey === "impressions",
  );
  const lifetime = FACEBOOK_PAGE_METRIC_MAPPING.find(
    (row) => row.dashboardKey === "lifetime_followers",
  );
  const acquired = FACEBOOK_PAGE_METRIC_MAPPING.find(
    (row) => row.dashboardKey === "followers_acquired",
  );
  const lost = FACEBOOK_PAGE_METRIC_MAPPING.find(
    (row) => row.dashboardKey === "followers_lost",
  );
  const visits = FACEBOOK_PAGE_METRIC_MAPPING.find(
    (row) => row.dashboardKey === "page_visits",
  );
  const content = FACEBOOK_PAGE_METRIC_MAPPING.find(
    (row) => row.dashboardKey === "total_content",
  );
  const reactions = FACEBOOK_PAGE_METRIC_MAPPING.find(
    (row) => row.dashboardKey === "reactions",
  );
  const engagement = FACEBOOK_PAGE_METRIC_MAPPING.find(
    (row) => row.dashboardKey === "engagement",
  );

  assert.equal(views?.metaField, "page_media_view");
  assert.equal(views?.dashboardLabel, "Views");
  assert.equal(lifetime?.metaField, "followers_count|fan_count");
  assert.equal(lifetime?.dashboardLabel, "Lifetime followers");
  assert.equal(acquired?.status, "probe_then_fetch");
  assert.equal(lost?.status, "probe_then_fetch");
  assert.equal(visits?.status, "probe_then_fetch");
  assert.equal(content?.status, "probe_then_fetch");
  assert.equal(reactions?.status, "probe_then_fetch");
  assert.equal(engagement?.status, "probe_then_fetch");
  console.log("ok: Views/lifetime/acquired/lost/visits/content/reactions mapped");
}

section("range presets");
{
  const now = new Date("2026-08-14T15:00:00.000Z");
  const last7 = resolveFacebookAnalyticsRange({
    preset: "last_7",
    timezone: "UTC",
    now,
  });
  assert.equal(last7.end, "2026-08-13");
  assert.equal(last7.start, "2026-08-07");
  assert.equal(daysBetweenInclusive(last7.start, last7.end), 7);

  const last30 = resolveFacebookAnalyticsRange({
    preset: "last_30",
    timezone: "UTC",
    now,
    compare: true,
  });
  assert.equal(daysBetweenInclusive(last30.start, last30.end), 30);
  assert.ok(last30.compareStart && last30.compareEnd);
  assert.equal(
    daysBetweenInclusive(last30.compareStart!, last30.compareEnd!),
    30,
  );
  console.log("ok: last_7 / last_30 + equivalent comparison length");
}

section("selected range beyond last sync → partial");
{
  const coverage = resolveFacebookSelectedRangeCoverage({
    selectedStart: "2026-07-17",
    selectedEnd: "2026-08-15",
    lastConfirmedDate: "2026-08-13",
    syncedRangeEnd: "2026-08-13",
    metricsEndInRange: "2026-08-13",
    syncStatus: "ready",
    metricsAvailable: true,
  });
  assert.equal(coverage.rangeDisplayStatus, "partial");
  assert.equal(coverage.dataCompleteness, "partial");
  assert.equal(coverage.coverageEnd, "2026-08-13");
  assert.equal(coverage.selectedBeyondSync, true);
  assert.match(coverage.notice ?? "", /Partial data through/i);
  console.log("ok: Aug 15 selection with sync through Aug 13 is Partial");
}

section("selected range fully covered → ready");
{
  const coverage = resolveFacebookSelectedRangeCoverage({
    selectedStart: "2026-07-17",
    selectedEnd: "2026-08-13",
    lastConfirmedDate: "2026-08-13",
    syncedRangeEnd: "2026-08-13",
    metricsEndInRange: "2026-08-13",
    syncStatus: "ready",
    metricsAvailable: true,
  });
  assert.equal(coverage.rangeDisplayStatus, "ready");
  assert.equal(coverage.dataCompleteness, "complete");
  assert.equal(coverage.notice, null);
  console.log("ok: full coverage remains Ready");
}

section("lifetime followers vs net change");
{
  const rows = [
    { date: "2026-08-01", followers: null },
    { date: "2026-08-10", followers: null },
    { date: "2026-08-13", followers: 420 },
  ];
  assert.equal(pickLifetimeFollowers(rows), 420);
  assert.equal(
    deriveNetFollowerChange(rows, "2026-08-01", "2026-08-13"),
    null,
  );
  assert.equal(
    deriveNetFollowerChange(
      [
        { date: "2026-08-01", followers: 400 },
        { date: "2026-08-13", followers: 420 },
      ],
      "2026-08-01",
      "2026-08-13",
    ),
    20,
  );
  console.log("ok: lifetime ≠ invented net growth; missing ends stay null");
}

section("lifetime snapshot survives backfill / incremental overwrite");
{
  const confirmed = {
    reach: 10,
    impressions: 20,
    engagement: 0,
    followers: 914,
    metadata: {
      provider: "meta",
      fields: {
        impressions: "page_media_view",
        reach: "page_total_media_view_unique",
        engagement: null,
        followers: "followers_count|fan_count",
      },
    },
  };

  // Incremental re-write of media views without a follower stamp must keep 914.
  const afterIncremental = mergeFacebookDailyMetricUpdate({
    incoming: {
      date: "2026-08-13",
      reach: 11,
      impressions: 22,
      engagement: null,
      followers: null,
    },
    existing: confirmed,
  });
  assert.equal(afterIncremental.followers, 914);
  assert.equal(afterIncremental.preservedFollowers, true);
  assert.equal(
    (afterIncremental.metadata.fields as { followers: string | null })
      .followers,
    "followers_count|fan_count",
  );

  // Backfill-style day create without followers must not invent a stamp.
  const createOnly = buildFacebookDailyMetricCreate({
    date: "2026-07-01",
    reach: 1,
    impressions: 2,
    engagement: null,
    followers: null,
  });
  assert.equal(createOnly.followers, 0);
  assert.equal(
    (createOnly.metadata.fields as { followers: string | null }).followers,
    null,
  );

  // Duplicate job: second merge still preserves.
  const afterDuplicate = mergeFacebookDailyMetricUpdate({
    incoming: {
      date: "2026-08-13",
      reach: 11,
      impressions: 22,
      engagement: null,
      followers: null,
    },
    existing: {
      reach: afterIncremental.reach,
      impressions: afterIncremental.impressions,
      engagement: afterIncremental.engagement,
      followers: afterIncremental.followers,
      metadata: afterIncremental.metadata,
    },
  });
  assert.equal(afterDuplicate.followers, 914);
  console.log("ok: 914 survives incremental/backfill/duplicate without stamp");
}

section("lifetime at-or-before range end (may predate selected start)");
{
  const selected = selectLifetimeFollowersAtOrBefore(
    [
      {
        date: "2026-07-01",
        followers: 900,
        fieldSource: "followers_count|fan_count",
      },
      {
        date: "2026-08-10",
        followers: 914,
        fieldSource: "followers_count|fan_count",
      },
      { date: "2026-08-14", followers: 0, fieldSource: null },
      { date: "2026-08-15", followers: 0, fieldSource: null },
    ],
    "2026-08-15",
  );
  assert.equal(selected?.value, 914);
  assert.equal(selected?.date, "2026-08-10");
  assert.equal(selected?.metaField, "followers_count|fan_count");
  assert.equal(selected?.dateAttribution, "stored");

  // Snapshot before selected start still wins for lifetime card.
  const beforeStart = selectLifetimeFollowersAtOrBefore(
    [
      {
        date: "2026-06-01",
        followers: 914,
        fieldSource: "followers_count|fan_count",
      },
    ],
    "2026-08-15",
  );
  assert.equal(beforeStart?.value, 914);

  // No confirmed snapshot → null (UI —), never fabricated 0.
  const missing = selectLifetimeFollowersAtOrBefore(
    [
      { date: "2026-08-14", followers: 0, fieldSource: null },
      { date: "2026-08-15", followers: 0, fieldSource: null },
    ],
    "2026-08-15",
  );
  assert.equal(missing, null);
  console.log("ok: at-or-before selection; missing → null not 0");
}

section("over-extended stamp attributed to sync range end");
{
  // Real regression shape: 914 survived on a future metric day; Aug window was zeroed.
  const recovered = selectLifetimeFollowersAtOrBefore(
    [
      { date: "2026-08-13", followers: 0, fieldSource: null },
      { date: "2026-08-15", followers: 0, fieldSource: null },
      { date: "2026-09-10", followers: 914, fieldSource: null },
    ],
    "2026-08-15",
    { syncRangeEnd: "2026-08-13" },
  );
  assert.equal(recovered?.value, 914);
  assert.equal(recovered?.date, "2026-08-13");
  assert.equal(recovered?.dateAttribution, "sync_range_end");
  assert.equal(recovered?.storedDate, "2026-09-10");
  assert.equal(recovered?.provenance, "legacy_confirmed");

  // Without syncRangeEnd, do not invent a lifetime from the future day.
  const strict = selectLifetimeFollowersAtOrBefore(
    [
      { date: "2026-08-13", followers: 0, fieldSource: null },
      { date: "2026-09-10", followers: 914, fieldSource: null },
    ],
    "2026-08-15",
  );
  assert.equal(strict, null);

  // Never infer lifetime from acquired/lost-style daily deltas (not present as inputs).
  const noDeltaInference = selectLifetimeFollowersAtOrBefore(
    [{ date: "2026-08-13", followers: 0, fieldSource: null }],
    "2026-08-15",
    { syncRangeEnd: "2026-08-13" },
  );
  assert.equal(noDeltaInference, null);
  console.log("ok: over-extended 914 → as-of sync end; no delta inference");
}

section("lifetime across date changes, partial ranges, backfill, repeated jobs");
{
  let stored: {
    reach: number;
    impressions: number;
    engagement: number;
    followers: number;
    metadata: Record<string, unknown>;
  } = {
    reach: 10,
    impressions: 20,
    engagement: 0,
    followers: 914,
    metadata: {
      provider: "meta",
      fields: {
        impressions: "page_media_view",
        reach: "page_total_media_view_unique",
        engagement: null,
        followers: "followers_count|fan_count",
      },
    },
  };

  // Repeated incremental jobs without follower stamp.
  for (let i = 0; i < 5; i += 1) {
    const next = mergeFacebookDailyMetricUpdate({
      incoming: {
        date: "2026-08-13",
        reach: 10 + i,
        impressions: 20 + i,
        engagement: null,
        followers: null,
      },
      existing: stored,
    });
    assert.equal(next.followers, 914);
    stored = {
      reach: next.reach,
      impressions: next.impressions,
      engagement: next.engagement,
      followers: next.followers,
      metadata: next.metadata,
    };
  }

  // Backfill older day must not invent lifetime or clear the stamp day.
  const backfillDay = buildFacebookDailyMetricCreate({
    date: "2026-07-01",
    reach: 3,
    impressions: 4,
    engagement: null,
    followers: null,
  });
  assert.equal(
    (backfillDay.metadata.fields as { followers: string | null }).followers,
    null,
  );

  // Partial selected range still resolves lifetime from before start.
  const partial = selectLifetimeFollowersAtOrBefore(
    [
      {
        date: "2026-08-01",
        followers: 914,
        fieldSource: "followers_count|fan_count",
      },
      { date: "2026-08-14", followers: 0, fieldSource: null },
      { date: "2026-08-15", followers: 0, fieldSource: null },
    ],
    "2026-08-15",
  );
  assert.equal(partial?.value, 914);
  assert.equal(partial?.date, "2026-08-01");

  // Date-range change to earlier end still uses latest ≤ end.
  const earlierEnd = selectLifetimeFollowersAtOrBefore(
    [
      {
        date: "2026-07-20",
        followers: 900,
        fieldSource: "followers_count|fan_count",
      },
      {
        date: "2026-08-10",
        followers: 914,
        fieldSource: "followers_count|fan_count",
      },
    ],
    "2026-07-31",
  );
  assert.equal(earlierEnd?.value, 900);
  assert.equal(earlierEnd?.date, "2026-07-20");
  console.log("ok: date changes / partial / backfill / repeated incrementals");
}

section("charts: uncovered days are not confirmed zeros");
{
  const series = buildCoveredMetricSeries({
    selectedStart: "2026-08-12",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    points: [
      { date: "2026-08-12", value: 5, confirmed: true },
      { date: "2026-08-13", value: 0, confirmed: true },
      { date: "2026-08-14", value: 0, confirmed: false },
      { date: "2026-08-15", value: 0, confirmed: false },
    ],
  });
  assert.equal(series[0]?.value, 5);
  assert.equal(series[0]?.coverage, "confirmed");
  assert.equal(series[1]?.value, 0);
  assert.equal(series[1]?.coverage, "confirmed");
  assert.equal(series[2]?.value, null);
  assert.equal(series[2]?.coverage, "uncovered");
  assert.equal(series[3]?.value, null);
  assert.equal(series[3]?.coverage, "uncovered");

  const completeness = resolvePerMetricCompleteness({
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    lifetimeFollowers: { value: 914, date: "2026-08-10" },
    hasConfirmedViewsInRange: true,
  });
  assert.equal(completeness.views.status, "partial");
  assert.equal(completeness.lifetime_followers.status, "partial");
  assert.match(completeness.views.notice ?? "", /2026-08-13/);
  console.log("ok: Aug 14–15 uncovered; confirmed zero kept on Aug 13");
}

section("partial ranges retain confirmed subtotals");
{
  // Attested daily page_media_view points (10+8+10). Distinct from the rejected
  // legacy production sum of unattested page_engagement_day impressions (also 28).
  const viewsPoints = [
    { date: "2026-08-11", value: 10, confirmed: true },
    { date: "2026-08-12", value: 8, confirmed: true },
    { date: "2026-08-13", value: 10, confirmed: true },
    { date: "2026-08-14", value: 0, confirmed: false },
    { date: "2026-08-15", value: 0, confirmed: false },
  ];

  const subtotal = sumConfirmedDailyValues({
    selectedStart: "2026-08-01",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    points: viewsPoints,
  });
  assert.equal(subtotal.total, 28);
  assert.equal(subtotal.coveredThrough, "2026-08-13");
  assert.equal(subtotal.confirmedDayCount, 3);

  const coverage = buildFacebookMetricCoverageMap({
    selectedStart: "2026-08-01",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    viewsPoints,
    lifetimeFollowers: {
      value: 914,
      date: "2026-08-13",
      provenance: "legacy_confirmed",
    },
  });

  assert.equal(coverage.views.value, 28);
  assert.equal(coverage.views.coveredThrough, "2026-08-13");
  assert.equal(coverage.views.isPartial, true);
  assert.equal(coverage.views.status, "partial");
  assert.equal(coverage.views.provenance, "confirmed");
  assert.match(coverage.views.notice ?? "", /through 2026-08-13/);

  assert.equal(coverage.lifetime_followers.value, 914);
  assert.equal(coverage.lifetime_followers.isPartial, true);

  // — only when nothing confirmed
  const empty = buildFacebookMetricCoverageMap({
    selectedStart: "2026-08-01",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    viewsPoints: [
      { date: "2026-08-14", value: 0, confirmed: false },
      { date: "2026-08-15", value: 0, confirmed: false },
    ],
    lifetimeFollowers: null,
  });
  assert.equal(empty.views.value, null);
  assert.equal(empty.views.status, "unavailable");
  assert.equal(empty.page_visits.value, null);
  assert.equal(empty.page_visits.provenance, "unavailable");
  assert.equal(empty.engagement.value, null);
  assert.equal(empty.posts.value, null);
  assert.equal(empty.reels.value, null);
  assert.equal(empty.stories.value, null);
  assert.equal(empty.demographics.value, null);
  assert.equal(empty.total_content.value, null);

  // Chart series still does not invent zeros past coverage
  const series = buildCoveredMetricSeries({
    selectedStart: "2026-08-12",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    points: viewsPoints,
  });
  assert.equal(series.find((p) => p.date === "2026-08-13")?.value, 10);
  assert.equal(series.find((p) => p.date === "2026-08-14")?.value, null);
  assert.equal(series.find((p) => p.date === "2026-08-15")?.value, null);
  console.log("ok: partial Views keep 28 through Aug 13; no trailing zeros");
}

section("Views provenance: period totals vs lifetime vs daily vs legacy");
{
  // A) Attested daily page_media_view → period aggregate + daily chart
  const attested = resolveViewsDisplayFromStoredDays({
    selectedStart: "2026-08-01",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    days: [
      {
        date: "2026-08-11",
        impressions: 10,
        metricSet: "page_media_view_day",
        fieldImpressions: "page_media_view",
      },
      {
        date: "2026-08-12",
        impressions: 8,
        metricSet: "page_media_view_day",
        fieldImpressions: "page_media_view",
      },
      {
        date: "2026-08-13",
        impressions: 10,
        metricSet: "page_media_view_day",
        fieldImpressions: "page_media_view",
      },
    ],
  });
  assert.equal(attested.cardValue, 28);
  assert.equal(attested.cardKind, "period_aggregate_of_attested_daily");
  assert.equal(attested.coveredFrom, "2026-08-11");
  assert.equal(attested.coveredThrough, "2026-08-13");
  assert.equal(attested.chartAvailable, true);
  assert.equal(attested.rejectedLegacyPeriodTotal, null);
  assert.equal(
    attested.chartPoints.find((p) => p.date === "2026-08-12")?.value,
    8,
  );
  assert.equal(
    attested.chartPoints.find((p) => p.date === "2026-08-14")?.value,
    null,
  );

  // B) Lifetime snapshot is never Views
  const lifetimeClass = classifyStoredImpressionsProvenance({
    impressions: 914,
    metricSet: "page_engagement_day",
    fieldImpressions: null,
  });
  assert.equal(lifetimeClass.attestedForViews, false);
  assert.notEqual(lifetimeClass.kind, "lifetime_snapshot");
  // Lifetime followers use a separate resolver — Views path must not treat 914 as Views.
  const lifetimeAsViews = resolveViewsDisplayFromStoredDays({
    selectedStart: "2026-08-01",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    days: [
      {
        date: "2026-09-10",
        impressions: 914,
        metricSet: "page_engagement_day",
        fieldImpressions: null,
      },
    ],
  });
  assert.equal(lifetimeAsViews.cardValue, null);
  assert.equal(lifetimeAsViews.chartAvailable, false);

  // C) Legacy unattested page_engagement_day impressions (production “28” =
  // Jul 26:25 + Jul 30:3) — incorrect fallback; reject; keep —; no invented daily.
  const legacy = resolveViewsDisplayFromStoredDays({
    selectedStart: "2026-07-01",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    days: [
      {
        date: "2026-07-26",
        impressions: 25,
        metricSet: "page_engagement_day",
        fieldImpressions: null,
      },
      {
        date: "2026-07-30",
        impressions: 3,
        metricSet: "page_engagement_day",
        fieldImpressions: null,
      },
    ],
  });
  assert.equal(legacy.cardValue, null);
  assert.equal(legacy.cardKind, "missing");
  assert.equal(legacy.chartAvailable, false);
  assert.ok(legacy.rejectedLegacyPeriodTotal);
  assert.equal(legacy.rejectedLegacyPeriodTotal?.value, 28);
  assert.equal(legacy.rejectedLegacyPeriodTotal?.coveredFrom, "2026-07-26");
  assert.equal(legacy.rejectedLegacyPeriodTotal?.coveredThrough, "2026-07-30");
  assert.equal(legacy.rejectedLegacyPeriodTotal?.dayCount, 2);
  assert.equal(
    legacy.rejectedLegacyPeriodTotal?.kind,
    "legacy_unattested_impressions",
  );
  assert.match(legacy.notice ?? "", /rejected/i);
  // Never invent daily points from the rejected period total
  assert.ok(
    legacy.chartPoints.every((p) => p.value === null && !p.confirmed),
  );

  // D) Single attested day is daily series, not a fabricated multi-day split
  const single = resolveViewsDisplayFromStoredDays({
    selectedStart: "2026-08-01",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-13",
    days: [
      {
        date: "2026-08-10",
        impressions: 28,
        metricSet: "page_media_view_day",
        fieldImpressions: "page_media_view",
      },
    ],
  });
  assert.equal(single.cardValue, 28);
  assert.equal(single.cardKind, "daily_page_media_view");
  assert.equal(single.chartAvailable, true);
  assert.equal(
    single.chartPoints.filter((p) => p.confirmed && p.value != null).length,
    1,
  );

  console.log(
    "ok: Views provenance distinguishes attested period/daily vs rejects legacy 28",
  );
}

section("net follows, confirmed empty content, Meta end_time day");
{
  // Meta day-period end_time is exclusive → reporting date is prior calendar day.
  assert.equal(
    shiftInsightEndTimeToReportingDate("2026-07-18"),
    "2026-07-17",
  );
  assert.equal(
    shiftInsightEndTimeToReportingDate("2026-08-16"),
    "2026-08-15",
  );

  const acquired = [
    { date: "2026-07-17", value: 2, confirmed: true },
    { date: "2026-07-18", value: 0, confirmed: true },
    { date: "2026-07-19", value: 1, confirmed: true },
  ];
  const lost = [
    { date: "2026-07-17", value: 0, confirmed: true },
    { date: "2026-07-18", value: 1, confirmed: true },
    { date: "2026-07-19", value: 0, confirmed: true },
  ];

  // Confirmed zero net is allowed (2+0+1) - (0+1+0) = 2
  const net = deriveNetFollowerChangeFromDailyFollows({
    selectedStart: "2026-07-17",
    selectedEnd: "2026-07-19",
    coverageEnd: "2026-07-19",
    acquiredPoints: acquired,
    lostPoints: lost,
  });
  assert.equal(net.status, "confirmed");
  assert.equal(net.value, 2);

  // Confirmed zeros on both sides → net 0 (not —)
  const zeroNet = deriveNetFollowerChangeFromDailyFollows({
    selectedStart: "2026-07-17",
    selectedEnd: "2026-07-18",
    coverageEnd: "2026-07-18",
    acquiredPoints: [
      { date: "2026-07-17", value: 0, confirmed: true },
      { date: "2026-07-18", value: 0, confirmed: true },
    ],
    lostPoints: [
      { date: "2026-07-17", value: 0, confirmed: true },
      { date: "2026-07-18", value: 0, confirmed: true },
    ],
  });
  assert.equal(zeroNet.status, "confirmed");
  assert.equal(zeroNet.value, 0);

  // Unavailable when lost series missing
  const missingLost = deriveNetFollowerChangeFromDailyFollows({
    selectedStart: "2026-07-17",
    selectedEnd: "2026-07-19",
    coverageEnd: "2026-07-19",
    acquiredPoints: acquired,
    lostPoints: [],
  });
  assert.equal(missingLost.status, "unavailable");
  assert.equal(missingLost.value, null);

  // Incomplete when series diverge under partial coverage
  const incomplete = deriveNetFollowerChangeFromDailyFollows({
    selectedStart: "2026-07-17",
    selectedEnd: "2026-07-20",
    coverageEnd: "2026-07-19",
    acquiredPoints: [
      { date: "2026-07-17", value: 1, confirmed: true },
      { date: "2026-07-18", value: 1, confirmed: true },
      { date: "2026-07-19", value: 1, confirmed: true },
    ],
    lostPoints: [
      { date: "2026-07-17", value: 0, confirmed: true },
      { date: "2026-07-18", value: 0, confirmed: true },
      // missing coverage end day for lost
    ],
  });
  assert.equal(incomplete.status, "incomplete");
  assert.equal(incomplete.value, null);

  // Total content: confirmed empty → 0; unavailable → —
  const emptyContent = buildFacebookMetricCoverageMap({
    selectedStart: "2026-07-17",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-15",
    viewsPoints: [],
    contentPoints: [
      { date: "2026-08-15", value: 0, confirmed: true },
    ],
    totalContentConfirmedEmpty: true,
    lifetimeFollowers: null,
  });
  assert.equal(emptyContent.total_content.value, 0);
  assert.equal(emptyContent.total_content.status, "ready");
  assert.equal(emptyContent.total_content.provenance, "confirmed");

  const unavailableContent = buildFacebookMetricCoverageMap({
    selectedStart: "2026-07-17",
    selectedEnd: "2026-08-15",
    coverageEnd: "2026-08-15",
    viewsPoints: [],
    contentPoints: [],
    totalContentConfirmedEmpty: false,
    lifetimeFollowers: null,
  });
  assert.equal(unavailableContent.total_content.value, null);
  assert.equal(unavailableContent.total_content.status, "unavailable");

  console.log(
    "ok: net follows / confirmed-empty content / Meta end_time −1 day",
  );
}

section("incremental overlap window");
{
  const window = computeIncrementalFetchWindow({
    lastConfirmedDate: "2026-08-10",
    overlapDays: 2,
    timezone: "UTC",
    now: new Date("2026-08-14T12:00:00.000Z"),
  });
  assert.equal(window.mode, "incremental");
  assert.equal(window.until, "2026-08-13");
  assert.equal(window.since, "2026-08-08");
  console.log("ok: watermark + overlap");
}

section("backfill windows prioritize recent");
{
  const windows = planBackfillWindows({
    horizonStart: "2026-05-16",
    recentStart: "2026-07-17",
    windowDays: 14,
  });
  assert.ok(windows.length > 0);
  assert.equal(windows[0]?.until, "2026-07-16");
  assert.ok(windows[0]!.since >= "2026-05-16");
  console.log(`ok: ${windows.length} backfill windows, recent-first`);
}

section("deterministic jitter");
{
  const a = computeIncrementalJitterMs("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  const b = computeIncrementalJitterMs("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  const c = computeIncrementalJitterMs("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  assert.equal(a, b);
  assert.notEqual(a, c);
  console.log("ok: jitter stable per account, varied across accounts");
}

section("date shift");
{
  assert.equal(shiftDateOnly("2026-03-01", -1), "2026-02-28");
  console.log("ok: calendar shift");
}

console.log("\nStep 7 schedule/mapping/coverage tests passed.");
