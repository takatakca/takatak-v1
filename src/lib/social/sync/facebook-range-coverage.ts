/**
 * Step 7 — selected-range completeness vs synchronized watermark.
 * Pure helpers (no DB / secrets). Used by API + dashboard + tests.
 */

export type FacebookRangeCoverageInput = {
  selectedStart: string;
  selectedEnd: string;
  /** Last YYYY-MM-DD confirmed from Meta (watermark). */
  lastConfirmedDate: string | null;
  /** Persisted sync window end when watermark missing. */
  syncedRangeEnd: string | null;
  /** Latest metric day present inside the selected window (optional). */
  metricsEndInRange: string | null;
  syncStatus: string;
  metricsAvailable: boolean;
};

export type FacebookRangeCoverage = {
  /** Effective end of data usable for the selected range. */
  coverageEnd: string | null;
  coverageStart: string;
  /** True when selectedEnd is after the last synchronized day. */
  selectedBeyondSync: boolean;
  /** True when at least one synchronized day overlaps the selection. */
  hasCoverageInRange: boolean;
  /** complete | partial | unavailable | pending */
  dataCompleteness: "complete" | "partial" | "unavailable" | "pending";
  /**
   * Display badge for the selected range (not the raw job status alone).
   * ready = full selected window covered; partial = covered through coverageEnd.
   */
  rangeDisplayStatus: "ready" | "partial" | "empty" | "pending" | "unavailable";
  /** User-facing notice, e.g. "Partial data through Aug 13". */
  notice: string | null;
};

function isDateOnly(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

/**
 * Convert Meta insights day-period end_time (YYYY-MM-DD) to the reporting day.
 * Meta’s end_time marks the exclusive end of the day bucket, so Jul 17 activity
 * arrives with end_time 2026-07-18 — normalize with −1 calendar day.
 */
export function shiftInsightEndTimeToReportingDate(endDate: string): string {
  const date = new Date(`${endDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}

function formatCoverageDay(dateOnly: string): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  if (!y || !m || !d) return dateOnly;
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Completeness of synchronized Facebook Page data against the UI-selected range.
 * Sync job "ready" does not imply the selected window is fully covered.
 */
export function resolveFacebookSelectedRangeCoverage(
  input: FacebookRangeCoverageInput,
): FacebookRangeCoverage {
  const selectedStart = input.selectedStart;
  const selectedEnd = input.selectedEnd;
  const coverageStart = selectedStart;

  if (
    input.syncStatus === "syncing" ||
    input.syncStatus === "idle" ||
    !input.syncStatus
  ) {
    return {
      coverageEnd: null,
      coverageStart,
      selectedBeyondSync: false,
      hasCoverageInRange: false,
      dataCompleteness: "pending",
      rangeDisplayStatus: "pending",
      notice: null,
    };
  }

  if (
    input.syncStatus === "failed" ||
    input.syncStatus === "action_required"
  ) {
    return {
      coverageEnd: null,
      coverageStart,
      selectedBeyondSync: false,
      hasCoverageInRange: false,
      dataCompleteness: "unavailable",
      rangeDisplayStatus: "unavailable",
      notice: "Analytics unavailable until synchronization succeeds.",
    };
  }

  const watermarkCandidates = [
    input.lastConfirmedDate,
    input.syncedRangeEnd,
    input.metricsEndInRange,
  ].filter(isDateOnly);

  if (watermarkCandidates.length === 0 || !input.metricsAvailable) {
    return {
      coverageEnd: null,
      coverageStart,
      selectedBeyondSync: false,
      hasCoverageInRange: false,
      dataCompleteness: "unavailable",
      rangeDisplayStatus: "empty",
      notice: "No synchronized data is available for this period.",
    };
  }

  const latestKnown = watermarkCandidates.reduce(maxDate);
  const coverageEnd = minDate(selectedEnd, latestKnown);

  const selectedBeyondSync = selectedEnd > latestKnown;
  const hasCoverageInRange = coverageEnd >= selectedStart;

  if (!hasCoverageInRange) {
    return {
      coverageEnd,
      coverageStart,
      selectedBeyondSync: true,
      hasCoverageInRange: false,
      dataCompleteness: "unavailable",
      rangeDisplayStatus: "empty",
      notice: `No synchronized data overlaps this range (last sync through ${formatCoverageDay(latestKnown)}).`,
    };
  }

  if (selectedBeyondSync) {
    return {
      coverageEnd,
      coverageStart,
      selectedBeyondSync: true,
      hasCoverageInRange: true,
      dataCompleteness: "partial",
      rangeDisplayStatus: "partial",
      notice: `Partial data through ${formatCoverageDay(coverageEnd)}. Days after that are not synchronized yet.`,
    };
  }

  return {
    coverageEnd,
    coverageStart,
    selectedBeyondSync: false,
    hasCoverageInRange: true,
    dataCompleteness: "complete",
    rangeDisplayStatus: "ready",
    notice: null,
  };
}

/**
 * Lifetime followers: latest confirmed point-in-time snapshot in range.
 * Never treat daily zeros as growth.
 */
export function pickLifetimeFollowers(
  rows: Array<{ date: string; followers: number | null }>,
): number | null {
  let latest: { date: string; followers: number } | null = null;
  for (const row of rows) {
    if (row.followers === null || row.followers === undefined) continue;
    if (!latest || row.date >= latest.date) {
      latest = { date: row.date, followers: row.followers };
    }
  }
  return latest?.followers ?? null;
}

/**
 * Net follower change only when both ends of the covered window have
 * confirmed follower snapshots. Otherwise null (render —).
 * Prefer deriveNetFollowerChangeFromDailyFollows when acquired/lost series exist.
 */
export function deriveNetFollowerChange(
  rows: Array<{ date: string; followers: number | null }>,
  coverageStart: string,
  coverageEnd: string,
): number | null {
  const startRow = rows.find(
    (row) => row.date === coverageStart && row.followers != null,
  );
  const endRow = rows.find(
    (row) => row.date === coverageEnd && row.followers != null,
  );
  if (
    startRow?.followers == null ||
    endRow?.followers == null ||
    startRow.date === endRow.date
  ) {
    return null;
  }
  return endRow.followers - startRow.followers;
}

export type DailyFollowPoint = {
  date: string;
  value: number | null;
  confirmed: boolean;
};

/**
 * Net = sum(confirmed page_daily_follows_unique) − sum(confirmed page_daily_unfollows_unique).
 * — when either series is unavailable or incomplete for the covered window.
 * Confirmed zeros are valid (net may be 0).
 */
export function deriveNetFollowerChangeFromDailyFollows(options: {
  selectedStart: string;
  selectedEnd: string;
  coverageEnd: string | null;
  acquiredPoints: DailyFollowPoint[];
  lostPoints: DailyFollowPoint[];
}): {
  value: number | null;
  status: "confirmed" | "unavailable" | "incomplete";
  acquiredTotal: number | null;
  lostTotal: number | null;
  coveredThrough: string | null;
} {
  const coverageEnd = options.coverageEnd;
  let acquiredTotal = 0;
  let acquiredDays = 0;
  let lostTotal = 0;
  let lostDays = 0;
  let coveredThrough: string | null = null;

  for (const point of options.acquiredPoints) {
    if (point.date < options.selectedStart || point.date > options.selectedEnd) {
      continue;
    }
    if (coverageEnd && point.date > coverageEnd) continue;
    if (!point.confirmed || point.value == null) continue;
    acquiredTotal += point.value;
    acquiredDays += 1;
    if (!coveredThrough || point.date > coveredThrough) {
      coveredThrough = point.date;
    }
  }

  for (const point of options.lostPoints) {
    if (point.date < options.selectedStart || point.date > options.selectedEnd) {
      continue;
    }
    if (coverageEnd && point.date > coverageEnd) continue;
    if (!point.confirmed || point.value == null) continue;
    lostTotal += point.value;
    lostDays += 1;
    if (!coveredThrough || point.date > coveredThrough) {
      coveredThrough = point.date;
    }
  }

  if (acquiredDays === 0 || lostDays === 0) {
    return {
      value: null,
      status: "unavailable",
      acquiredTotal: acquiredDays > 0 ? acquiredTotal : null,
      lostTotal: lostDays > 0 ? lostTotal : null,
      coveredThrough: null,
    };
  }

  // Incomplete when the selected window extends past coverage and either
  // series does not reach the coverage end day.
  const selectedBeyond =
    coverageEnd != null && options.selectedEnd > coverageEnd;
  if (selectedBeyond && coverageEnd) {
    const acquiredThrough = options.acquiredPoints
      .filter(
        (p) =>
          p.confirmed &&
          p.value != null &&
          p.date >= options.selectedStart &&
          p.date <= coverageEnd,
      )
      .reduce<string | null>(
        (max, p) => (!max || p.date > max ? p.date : max),
        null,
      );
    const lostThrough = options.lostPoints
      .filter(
        (p) =>
          p.confirmed &&
          p.value != null &&
          p.date >= options.selectedStart &&
          p.date <= coverageEnd,
      )
      .reduce<string | null>(
        (max, p) => (!max || p.date > max ? p.date : max),
        null,
      );
    if (
      !acquiredThrough ||
      !lostThrough ||
      acquiredThrough < coverageEnd ||
      lostThrough < coverageEnd
    ) {
      // Still allow net over the overlapping confirmed days when both series
      // share the same coveredThrough; only mark incomplete when they diverge.
      if (acquiredThrough !== lostThrough) {
        return {
          value: null,
          status: "incomplete",
          acquiredTotal,
          lostTotal,
          coveredThrough: null,
        };
      }
    }
  }

  return {
    value: acquiredTotal - lostTotal,
    status: "confirmed",
    acquiredTotal,
    lostTotal,
    coveredThrough,
  };
}
