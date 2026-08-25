/**
 * Pure Step 7 helpers for daily metric writes + lifetime snapshot selection.
 * No DB / secrets / Page IDs.
 */

export type FacebookDailyMetricIncoming = {
  date: string;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  followers: number | null;
  pageVisits?: number | null;
  followersAcquired?: number | null;
  followersLost?: number | null;
  contentPublished?: number | null;
};

export type FacebookDailyMetricStored = {
  reach: number;
  impressions: number;
  engagement: number;
  followers: number;
  metadata: Record<string, unknown> | null;
};

export type FacebookDailyFieldSources = {
  impressions: string | null;
  reach: string | null;
  engagement: string | null;
  followers: string | null;
  pageVisits: string | null;
  followersAcquired: string | null;
  followersLost: string | null;
  contentPublished: string | null;
};

const IMPRESSIONS_FIELD = "page_media_view";
const REACH_FIELD = "page_total_media_view_unique";
const FOLLOWERS_FIELD = "followers_count|fan_count";
const PAGE_VISITS_FIELD = "page_views_total";
const FOLLOWS_FIELD = "page_daily_follows_unique|page_daily_follows";
const UNFOLLOWS_FIELD = "page_daily_unfollows_unique|page_daily_unfollows";
const CONTENT_FIELD = "published_posts";
const ENGAGEMENT_FIELD = "published_posts.reactions.summary";
const GRAPH_API_VERSION = "v21.0";

function readFields(
  metadata: Record<string, unknown> | null | undefined,
): FacebookDailyFieldSources {
  const fields =
    metadata &&
    typeof metadata.fields === "object" &&
    metadata.fields !== null &&
    !Array.isArray(metadata.fields)
      ? (metadata.fields as Record<string, unknown>)
      : null;

  return {
    impressions:
      typeof fields?.impressions === "string" ? fields.impressions : null,
    reach: typeof fields?.reach === "string" ? fields.reach : null,
    engagement:
      typeof fields?.engagement === "string" ? fields.engagement : null,
    followers:
      typeof fields?.followers === "string" ? fields.followers : null,
    pageVisits:
      typeof fields?.pageVisits === "string" ? fields.pageVisits : null,
    followersAcquired:
      typeof fields?.followersAcquired === "string"
        ? fields.followersAcquired
        : null,
    followersLost:
      typeof fields?.followersLost === "string"
        ? fields.followersLost
        : null,
    contentPublished:
      typeof fields?.contentPublished === "string"
        ? fields.contentPublished
        : null,
  };
}

function readExtraValues(
  metadata: Record<string, unknown> | null | undefined,
): {
  pageVisits: number | null;
  followersAcquired: number | null;
  followersLost: number | null;
  contentPublished: number | null;
} {
  const values =
    metadata &&
    typeof metadata.values === "object" &&
    metadata.values !== null &&
    !Array.isArray(metadata.values)
      ? (metadata.values as Record<string, unknown>)
      : null;

  const read = (key: string): number | null => {
    const value = values?.[key];
    return typeof value === "number" && Number.isFinite(value)
      ? Math.trunc(value)
      : null;
  };

  return {
    pageVisits: read("pageVisits"),
    followersAcquired: read("followersAcquired"),
    followersLost: read("followersLost"),
    contentPublished: read("contentPublished"),
  };
}

function mergeExtraNumber(
  incoming: number | null | undefined,
  existing: number | null,
): number | null {
  if (incoming != null) return incoming;
  return existing;
}

/**
 * Merge incoming Meta day values onto an existing row.
 * Null incoming MUST NOT overwrite a previously confirmed value with 0.
 */
export function mergeFacebookDailyMetricUpdate(options: {
  incoming: FacebookDailyMetricIncoming;
  existing: FacebookDailyMetricStored | null;
}): {
  reach: number;
  impressions: number;
  engagement: number;
  followers: number;
  metadata: Record<string, unknown>;
  preservedFollowers: boolean;
} {
  const existingFields = readFields(options.existing?.metadata ?? null);
  const existingExtras = readExtraValues(options.existing?.metadata ?? null);

  const reach =
    options.incoming.reach != null
      ? options.incoming.reach
      : (options.existing?.reach ?? 0);
  const impressions =
    options.incoming.impressions != null
      ? options.incoming.impressions
      : (options.existing?.impressions ?? 0);
  const engagement =
    options.incoming.engagement != null
      ? options.incoming.engagement
      : (options.existing?.engagement ?? 0);

  const incomingFollowers = options.incoming.followers;
  const preservedFollowers =
    incomingFollowers == null &&
    Boolean(options.existing) &&
    (existingFields.followers != null || (options.existing?.followers ?? 0) > 0);

  const followers =
    incomingFollowers != null
      ? incomingFollowers
      : preservedFollowers
        ? (options.existing?.followers ?? 0)
        : 0;

  const pageVisits = mergeExtraNumber(
    options.incoming.pageVisits,
    existingExtras.pageVisits,
  );
  const followersAcquired = mergeExtraNumber(
    options.incoming.followersAcquired,
    existingExtras.followersAcquired,
  );
  const followersLost = mergeExtraNumber(
    options.incoming.followersLost,
    existingExtras.followersLost,
  );
  const contentPublished = mergeExtraNumber(
    options.incoming.contentPublished,
    existingExtras.contentPublished,
  );

  const fields: FacebookDailyFieldSources = {
    impressions:
      options.incoming.impressions != null
        ? IMPRESSIONS_FIELD
        : existingFields.impressions,
    reach:
      options.incoming.reach != null ? REACH_FIELD : existingFields.reach,
    engagement:
      options.incoming.engagement != null
        ? ENGAGEMENT_FIELD
        : existingFields.engagement,
    followers:
      incomingFollowers != null
        ? FOLLOWERS_FIELD
        : preservedFollowers
          ? existingFields.followers ?? FOLLOWERS_FIELD
          : null,
    pageVisits:
      options.incoming.pageVisits != null
        ? PAGE_VISITS_FIELD
        : existingFields.pageVisits,
    followersAcquired:
      options.incoming.followersAcquired != null
        ? FOLLOWS_FIELD
        : existingFields.followersAcquired,
    followersLost:
      options.incoming.followersLost != null
        ? UNFOLLOWS_FIELD
        : existingFields.followersLost,
    contentPublished:
      options.incoming.contentPublished != null
        ? CONTENT_FIELD
        : existingFields.contentPublished,
  };

  return {
    reach,
    impressions,
    engagement,
    followers,
    preservedFollowers,
    metadata: {
      provider: "meta",
      metricSet: "page_insights_day",
      graphApiVersion: GRAPH_API_VERSION,
      aggregation: "day",
      period: "day",
      retrievedAt: new Date().toISOString(),
      fields,
      values: {
        pageVisits,
        followersAcquired,
        followersLost,
        contentPublished,
      },
    },
  };
}

export function buildFacebookDailyMetricCreate(
  incoming: FacebookDailyMetricIncoming,
): {
  reach: number;
  impressions: number;
  engagement: number;
  followers: number;
  metadata: Record<string, unknown>;
} {
  return {
    reach: incoming.reach ?? 0,
    impressions: incoming.impressions ?? 0,
    engagement: incoming.engagement ?? 0,
    followers: incoming.followers ?? 0,
    metadata: {
      provider: "meta",
      metricSet: "page_insights_day",
      graphApiVersion: GRAPH_API_VERSION,
      aggregation: "day",
      period: "day",
      retrievedAt: new Date().toISOString(),
      fields: {
        impressions:
          incoming.impressions != null ? IMPRESSIONS_FIELD : null,
        reach: incoming.reach != null ? REACH_FIELD : null,
        engagement:
          incoming.engagement != null ? ENGAGEMENT_FIELD : null,
        followers: incoming.followers != null ? FOLLOWERS_FIELD : null,
        pageVisits:
          incoming.pageVisits != null ? PAGE_VISITS_FIELD : null,
        followersAcquired:
          incoming.followersAcquired != null ? FOLLOWS_FIELD : null,
        followersLost:
          incoming.followersLost != null ? UNFOLLOWS_FIELD : null,
        contentPublished:
          incoming.contentPublished != null ? CONTENT_FIELD : null,
      },
      values: {
        pageVisits: incoming.pageVisits ?? null,
        followersAcquired: incoming.followersAcquired ?? null,
        followersLost: incoming.followersLost ?? null,
        contentPublished: incoming.contentPublished ?? null,
      },
    },
  };
}

export type LifetimeFollowerCandidate = {
  date: string;
  followers: number;
  fieldSource: string | null;
};

/**
 * Latest confirmed lifetime snapshot at or before rangeEnd.
 * Does not require the snapshot date to fall inside the selected start.
 * Never returns 0 as a fabricated default — only explicit stored snapshots.
 * Never infers lifetime from acquired/lost daily deltas.
 *
 * Over-extended metric days: when the only positive identity stamp was written
 * on a day after syncRangeEnd (historical date-window bug), attribute the
 * value to syncRangeEnd when syncRangeEnd <= selected rangeEnd.
 */
export function selectLifetimeFollowersAtOrBefore(
  candidates: LifetimeFollowerCandidate[],
  rangeEnd: string,
  options?: {
    syncRangeEnd?: string | null;
  },
): {
  value: number;
  date: string;
  metaField: string;
  provenance: "confirmed" | "legacy_confirmed";
  dateAttribution: "stored" | "sync_range_end";
  storedDate?: string;
} | null {
  const pickFrom = (
    rows: LifetimeFollowerCandidate[],
  ): {
    value: number;
    date: string;
    metaField: string;
    provenance: "confirmed" | "legacy_confirmed";
  } | null => {
    const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
    for (const row of sorted) {
      if (row.fieldSource && row.fieldSource.trim().length > 0) {
        return {
          value: row.followers,
          date: row.date,
          metaField: row.fieldSource,
          provenance: "confirmed",
        };
      }
    }
    for (const row of sorted) {
      if (row.followers > 0) {
        return {
          value: row.followers,
          date: row.date,
          metaField: "followers_count|fan_count",
          provenance: "legacy_confirmed",
        };
      }
    }
    return null;
  };

  const eligible = candidates.filter((row) => row.date <= rangeEnd);
  const direct = pickFrom(eligible);
  if (direct) {
    return { ...direct, dateAttribution: "stored" };
  }

  const syncRangeEnd = options?.syncRangeEnd?.trim() || null;
  if (
    !syncRangeEnd ||
    !/^\d{4}-\d{2}-\d{2}$/.test(syncRangeEnd) ||
    syncRangeEnd > rangeEnd
  ) {
    return null;
  }

  // Stamp landed after the durable sync window (over-fetched future days).
  const overextended = candidates.filter(
    (row) => row.date > syncRangeEnd && row.followers > 0,
  );
  const recovered = pickFrom(overextended);
  if (!recovered) {
    return null;
  }

  return {
    value: recovered.value,
    date: syncRangeEnd,
    metaField: recovered.metaField,
    provenance: recovered.provenance,
    dateAttribution: "sync_range_end",
    storedDate: recovered.date,
  };
}

export function isConfirmedMetricValue(options: {
  fieldSource: string | null | undefined;
  /** When field is set, 0 is a confirmed zero. When unset, value is uncovered. */
  hasField: boolean;
}): boolean {
  return options.hasField && Boolean(options.fieldSource);
}

/**
 * Build a chart series for the selected window.
 * Uncovered dates → null (not 0). Confirmed Meta zeros → 0.
 */
export function buildCoveredMetricSeries(options: {
  selectedStart: string;
  selectedEnd: string;
  coverageEnd: string | null;
  points: Array<{ date: string; value: number | null; confirmed: boolean }>;
}): Array<{
  date: string;
  value: number | null;
  coverage: "confirmed" | "uncovered";
}> {
  const byDate = new Map(options.points.map((p) => [p.date, p]));
  const dates: string[] = [];
  {
    const cursor = new Date(`${options.selectedStart}T12:00:00Z`);
    const last = new Date(`${options.selectedEnd}T12:00:00Z`);
    while (cursor <= last) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return dates.map((date) => {
    if (options.coverageEnd && date > options.coverageEnd) {
      return { date, value: null, coverage: "uncovered" as const };
    }
    const point = byDate.get(date);
    if (!point || !point.confirmed || point.value === null) {
      return { date, value: null, coverage: "uncovered" as const };
    }
    return { date, value: point.value, coverage: "confirmed" as const };
  });
}

export function resolvePerMetricCompleteness(options: {
  selectedEnd: string;
  coverageEnd: string | null;
  lifetimeFollowers: { value: number; date: string } | null;
  hasConfirmedViewsInRange: boolean;
}): Record<
  string,
  {
    status: "ready" | "partial" | "unavailable";
    notice: string | null;
  }
> {
  const map = buildFacebookMetricCoverageMap({
    selectedStart: "1970-01-01",
    selectedEnd: options.selectedEnd,
    coverageEnd: options.coverageEnd,
    viewsPoints: options.hasConfirmedViewsInRange
      ? [{ date: options.coverageEnd ?? options.selectedEnd, value: 0, confirmed: true }]
      : [],
    lifetimeFollowers: options.lifetimeFollowers,
  });
  return Object.fromEntries(
    Object.entries(map).map(([key, row]) => [
      key,
      { status: row.status, notice: row.notice },
    ]),
  );
}

export type ViewsProvenanceKind =
  | "daily_page_media_view"
  | "period_aggregate_of_attested_daily"
  | "lifetime_snapshot"
  | "legacy_unattested_impressions"
  | "synthetic"
  | "missing";

/**
 * Classify a stored impressions cell for Step 7 Views (page_media_view only).
 * Legacy page_engagement_day rows without fields.impressions are not Views.
 */
export function classifyStoredImpressionsProvenance(options: {
  impressions: number | null | undefined;
  metricSet: string | null | undefined;
  fieldImpressions: string | null | undefined;
}): {
  kind: ViewsProvenanceKind;
  /** May contribute to Views daily series + period sum. */
  attestedForViews: boolean;
} {
  const field = options.fieldImpressions?.trim() || null;
  const metricSet = options.metricSet?.trim() || null;
  const value = options.impressions;

  if (field === "page_media_view") {
    return { kind: "daily_page_media_view", attestedForViews: true };
  }

  if (
    typeof value === "number" &&
    value > 0 &&
    metricSet === "page_engagement_day" &&
    !field
  ) {
    return {
      kind: "legacy_unattested_impressions",
      attestedForViews: false,
    };
  }

  if (typeof value === "number" && value > 0 && !field) {
    return {
      kind: "legacy_unattested_impressions",
      attestedForViews: false,
    };
  }

  return { kind: "missing", attestedForViews: false };
}

/**
 * Resolve Views card + chart inputs.
 * - Attested daily page_media_view → period sum + daily series.
 * - Legacy unattested impressions sum → rejected (not shown as Views).
 * - Never invent daily points from a period-only total.
 * - Lifetime snapshots are never used for Views.
 */
export function resolveViewsDisplayFromStoredDays(options: {
  selectedStart: string;
  selectedEnd: string;
  coverageEnd: string | null;
  days: Array<{
    date: string;
    impressions: number | null;
    metricSet: string | null;
    fieldImpressions: string | null;
  }>;
}): {
  cardValue: number | null;
  cardKind: ViewsProvenanceKind;
  coveredFrom: string | null;
  coveredThrough: string | null;
  isPartial: boolean;
  /** Daily series only when attested days exist — never synthesized from a period total. */
  chartPoints: Array<{ date: string; value: number | null; confirmed: boolean }>;
  chartAvailable: boolean;
  rejectedLegacyPeriodTotal: {
    value: number;
    coveredFrom: string;
    coveredThrough: string;
    dayCount: number;
    kind: "legacy_unattested_impressions";
    reason: string;
  } | null;
  notice: string | null;
} {
  const attested: Array<{ date: string; value: number }> = [];
  const legacy: Array<{ date: string; value: number }> = [];

  for (const day of options.days) {
    if (day.date < options.selectedStart || day.date > options.selectedEnd) {
      continue;
    }
    if (options.coverageEnd && day.date > options.coverageEnd) {
      continue;
    }
    const classification = classifyStoredImpressionsProvenance({
      impressions: day.impressions,
      metricSet: day.metricSet,
      fieldImpressions: day.fieldImpressions,
    });
    if (
      classification.attestedForViews &&
      typeof day.impressions === "number"
    ) {
      attested.push({ date: day.date, value: day.impressions });
    } else if (
      classification.kind === "legacy_unattested_impressions" &&
      typeof day.impressions === "number" &&
      day.impressions > 0
    ) {
      legacy.push({ date: day.date, value: day.impressions });
    }
  }

  const selectedBeyond =
    options.coverageEnd != null &&
    options.selectedEnd > options.coverageEnd;

  if (attested.length > 0) {
    const total = attested.reduce((sum, row) => sum + row.value, 0);
    const coveredFrom = attested.reduce(
      (min, row) => (row.date < min ? row.date : min),
      attested[0]!.date,
    );
    const coveredThrough = attested.reduce(
      (max, row) => (row.date > max ? row.date : max),
      attested[0]!.date,
    );
    const isPartial = selectedBeyond && coveredThrough < options.selectedEnd;
    const byDate = new Map(attested.map((row) => [row.date, row.value]));
    const chartPoints = buildCoveredMetricSeries({
      selectedStart: options.selectedStart,
      selectedEnd: options.selectedEnd,
      coverageEnd: options.coverageEnd,
      points: [...byDate.entries()].map(([date, value]) => ({
        date,
        value,
        confirmed: true,
      })),
    }).map((point) => ({
      date: point.date,
      value: point.value,
      confirmed: point.coverage === "confirmed",
    }));

    return {
      cardValue: total,
      cardKind:
        attested.length === 1
          ? "daily_page_media_view"
          : "period_aggregate_of_attested_daily",
      coveredFrom,
      coveredThrough,
      isPartial,
      chartPoints,
      chartAvailable: true,
      rejectedLegacyPeriodTotal: null,
      notice: isPartial
        ? `Showing confirmed page_media_view totals through ${coveredThrough}. Days after that are not synchronized yet.`
        : null,
    };
  }

  if (legacy.length > 0) {
    const value = legacy.reduce((sum, row) => sum + row.value, 0);
    const coveredFrom = legacy.reduce(
      (min, row) => (row.date < min ? row.date : min),
      legacy[0]!.date,
    );
    const coveredThrough = legacy.reduce(
      (max, row) => (row.date > max ? row.date : max),
      legacy[0]!.date,
    );
    return {
      cardValue: null,
      cardKind: "missing",
      coveredFrom: null,
      coveredThrough: null,
      isPartial: false,
      chartPoints: buildCoveredMetricSeries({
        selectedStart: options.selectedStart,
        selectedEnd: options.selectedEnd,
        coverageEnd: options.coverageEnd,
        points: [],
      }).map((point) => ({
        date: point.date,
        value: null,
        confirmed: false,
      })),
      chartAvailable: false,
      rejectedLegacyPeriodTotal: {
        value,
        coveredFrom,
        coveredThrough,
        dayCount: legacy.length,
        kind: "legacy_unattested_impressions",
        reason:
          "Stored impressions under page_engagement_day without metadata.fields.impressions=page_media_view. Earlier UI summed these as Views (incorrect fallback). Not valid Step 7 Views.",
      },
      notice:
        "No confirmed page_media_view days in this range. A legacy unattested impressions sum was rejected and is not shown as Views.",
    };
  }

  return {
    cardValue: null,
    cardKind: "missing",
    coveredFrom: null,
    coveredThrough: null,
    isPartial: false,
    chartPoints: buildCoveredMetricSeries({
      selectedStart: options.selectedStart,
      selectedEnd: options.selectedEnd,
      coverageEnd: options.coverageEnd,
      points: [],
    }).map((point) => ({
      date: point.date,
      value: null,
      confirmed: false,
    })),
    chartAvailable: false,
    rejectedLegacyPeriodTotal: null,
    notice: "No confirmed media-view days in this range.",
  };
}

export type FacebookMetricCoverage = {
  value: number | null;
  coveredThrough: string | null;
  /** Inclusive start of confirmed coverage when known (Views period totals). */
  coveredFrom?: string | null;
  isPartial: boolean;
  provenance:
    | "confirmed"
    | "partial"
    | "unavailable"
    | "missing"
    | "legacy_confirmed";
  status: "ready" | "partial" | "unavailable";
  notice: string | null;
  /** Views-only provenance classification. */
  kind?: ViewsProvenanceKind;
  /** False when the card total cannot back a daily chart. */
  chartAvailable?: boolean;
  rejectedLegacyPeriodTotal?: {
    value: number;
    coveredFrom: string;
    coveredThrough: string;
    dayCount: number;
    kind: "legacy_unattested_impressions";
    reason: string;
  } | null;
};

/**
 * Sum confirmed daily values inside the selected window, capped at coverageEnd.
 * Uncovered trailing days are omitted — never filled with zeros.
 */
export function sumConfirmedDailyValues(options: {
  selectedStart: string;
  selectedEnd: string;
  coverageEnd: string | null;
  points: Array<{ date: string; value: number | null; confirmed: boolean }>;
}): {
  total: number | null;
  coveredThrough: string | null;
  confirmedDayCount: number;
} {
  let total = 0;
  let confirmedDayCount = 0;
  let coveredThrough: string | null = null;

  for (const point of options.points) {
    if (point.date < options.selectedStart || point.date > options.selectedEnd) {
      continue;
    }
    if (options.coverageEnd && point.date > options.coverageEnd) {
      continue;
    }
    if (!point.confirmed || point.value === null || point.value === undefined) {
      continue;
    }
    total += point.value;
    confirmedDayCount += 1;
    if (!coveredThrough || point.date > coveredThrough) {
      coveredThrough = point.date;
    }
  }

  return {
    total: confirmedDayCount > 0 ? total : null,
    coveredThrough,
    confirmedDayCount,
  };
}

function unavailableMetric(notice: string): FacebookMetricCoverage {
  return {
    value: null,
    coveredThrough: null,
    isPartial: false,
    provenance: "unavailable",
    status: "unavailable",
    notice,
  };
}

function formatThroughNotice(coveredThrough: string): string {
  return `Showing confirmed data through ${coveredThrough}. Days after that are not synchronized yet.`;
}

/**
 * Per-metric coverage for the selected range.
 * Partial ranges keep confirmed subtotals; — only when nothing confirmed.
 */
export function buildFacebookMetricCoverageMap(options: {
  selectedStart: string;
  selectedEnd: string;
  coverageEnd: string | null;
  viewsPoints: Array<{ date: string; value: number | null; confirmed: boolean }>;
  pageVisitsPoints?: Array<{
    date: string;
    value: number | null;
    confirmed: boolean;
  }>;
  followersAcquiredPoints?: Array<{
    date: string;
    value: number | null;
    confirmed: boolean;
  }>;
  followersLostPoints?: Array<{
    date: string;
    value: number | null;
    confirmed: boolean;
  }>;
  contentPoints?: Array<{
    date: string;
    value: number | null;
    confirmed: boolean;
  }>;
  engagementPoints?: Array<{
    date: string;
    value: number | null;
    confirmed: boolean;
  }>;
  /** When published_posts completed with zero posts in range. */
  totalContentConfirmedEmpty?: boolean;
  lifetimeFollowers: {
    value: number;
    date: string;
    provenance?: "confirmed" | "legacy_confirmed";
  } | null;
}): Record<string, FacebookMetricCoverage> {
  const selectedBeyond =
    options.coverageEnd != null &&
    options.selectedEnd > options.coverageEnd;

  const viewsSum = sumConfirmedDailyValues({
    selectedStart: options.selectedStart,
    selectedEnd: options.selectedEnd,
    coverageEnd: options.coverageEnd,
    points: options.viewsPoints,
  });

  const viewsCoveredThrough =
    viewsSum.coveredThrough ??
    (viewsSum.total != null ? options.coverageEnd : null);
  const viewsPartial =
    viewsSum.total != null &&
    selectedBeyond &&
    Boolean(viewsCoveredThrough) &&
    viewsCoveredThrough! < options.selectedEnd;

  const views: FacebookMetricCoverage =
    viewsSum.total == null
      ? {
          value: null,
          coveredThrough: null,
          isPartial: false,
          provenance: "missing",
          status: "unavailable",
          notice: "No confirmed media-view days in this range.",
        }
      : {
          value: viewsSum.total,
          coveredThrough: viewsCoveredThrough,
          isPartial: viewsPartial,
          provenance: "confirmed",
          status: viewsPartial ? "partial" : "ready",
          notice: viewsPartial
            ? formatThroughNotice(viewsCoveredThrough!)
            : null,
        };

  const lifetimePartial =
    options.lifetimeFollowers != null &&
    selectedBeyond &&
    options.lifetimeFollowers.date < options.selectedEnd;

  const lifetime_followers: FacebookMetricCoverage = !options.lifetimeFollowers
    ? {
        value: null,
        coveredThrough: null,
        isPartial: false,
        provenance: "missing",
        status: "unavailable",
        notice:
          "No confirmed lifetime follower snapshot at or before the selected end.",
      }
    : {
        value: options.lifetimeFollowers.value,
        coveredThrough: options.lifetimeFollowers.date,
        isPartial: lifetimePartial || selectedBeyond,
        provenance: options.lifetimeFollowers.provenance ?? "confirmed",
        status:
          lifetimePartial || selectedBeyond ? "partial" : "ready",
        notice:
          lifetimePartial || selectedBeyond
            ? formatThroughNotice(options.lifetimeFollowers.date)
            : null,
      };

  function sumOrUnavailable(
    points: Array<{ date: string; value: number | null; confirmed: boolean }> | undefined,
    emptyNotice: string,
  ): FacebookMetricCoverage {
    if (!points || points.length === 0) {
      return unavailableMetric(emptyNotice);
    }
    const sum = sumConfirmedDailyValues({
      selectedStart: options.selectedStart,
      selectedEnd: options.selectedEnd,
      coverageEnd: options.coverageEnd,
      points,
    });
    if (sum.total == null) {
      return unavailableMetric(emptyNotice);
    }
    const coveredThrough =
      sum.coveredThrough ?? options.coverageEnd;
    const isPartial =
      selectedBeyond &&
      Boolean(coveredThrough) &&
      coveredThrough! < options.selectedEnd;
    return {
      value: sum.total,
      coveredThrough,
      isPartial,
      provenance: "confirmed",
      status: isPartial ? "partial" : "ready",
      notice: isPartial ? formatThroughNotice(coveredThrough!) : null,
    };
  }

  const contentFromPoints = sumOrUnavailable(
    options.contentPoints,
    "Total content is not available for this range.",
  );
  const total_content: FacebookMetricCoverage =
    options.totalContentConfirmedEmpty === true
      ? {
          value: 0,
          coveredThrough: options.coverageEnd ?? options.selectedEnd,
          isPartial: false,
          provenance: "confirmed",
          status: "ready",
          notice: null,
        }
      : contentFromPoints;

  return {
    lifetime_followers,
    views,
    unique_media_views: {
      value: null,
      coveredThrough: views.coveredThrough,
      isPartial: views.isPartial,
      provenance: views.value == null ? "unavailable" : views.provenance,
      status: views.value == null ? "unavailable" : views.status,
      notice:
        views.value == null
          ? "No confirmed unique media-view days in this range."
          : views.notice,
    },
    followers_acquired: sumOrUnavailable(
      options.followersAcquiredPoints,
      "Acquired follows are not available for this range.",
    ),
    followers_lost: sumOrUnavailable(
      options.followersLostPoints,
      "Lost follows are not available for this range.",
    ),
    page_visits: sumOrUnavailable(
      options.pageVisitsPoints,
      "Page visits are not available for this range.",
    ),
    total_content,
    reactions: sumOrUnavailable(
      options.engagementPoints,
      "Reactions are not available for this range.",
    ),
    engagement: sumOrUnavailable(
      options.engagementPoints,
      "Engagement is not available for this range.",
    ),
    posts: unavailableMetric("Posts are not synchronized yet."),
    reels: unavailableMetric("Reels are not synchronized yet."),
    stories: unavailableMetric("Stories are not synchronized yet."),
    demographics: unavailableMetric(
      "Demographics are not synchronized yet.",
    ),
  };
}
