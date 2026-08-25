import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { shiftInsightEndTimeToReportingDate } from "@/lib/social/sync/facebook-range-coverage";

export const GRAPH_VERSION = "v21.0";
const TOKEN_REQUEST_TIMEOUT_MS = 12_000;
const MAX_INSIGHT_PAGES = 12;
const MAX_POST_PAGES = 20;

/**
 * Candidate Page insight metrics for Step 7.
 * Never include retired page_impressions* as Views substitutes.
 */
export const FACEBOOK_PAGE_INSIGHT_CANDIDATES = [
  {
    metaMetric: "page_media_view",
    dashboardMetric: "views",
    dayField: "impressions" as const,
  },
  {
    metaMetric: "page_total_media_view_unique",
    dashboardMetric: "unique_media_views",
    dayField: "reach" as const,
  },
  {
    metaMetric: "page_views_total",
    dashboardMetric: "page_visits",
    dayField: "pageVisits" as const,
  },
  {
    metaMetric: "page_daily_follows_unique",
    dashboardMetric: "followers_acquired",
    dayField: "followersAcquired" as const,
  },
  {
    metaMetric: "page_daily_unfollows_unique",
    dashboardMetric: "followers_lost",
    dayField: "followersLost" as const,
  },
  {
    metaMetric: "page_daily_follows",
    dashboardMetric: "followers_acquired",
    dayField: "followersAcquired" as const,
  },
  {
    metaMetric: "page_daily_unfollows",
    dashboardMetric: "followers_lost",
    dayField: "followersLost" as const,
  },
] as const;

/** Core media-view pair always attempted first (never legacy impressions). */
export const FACEBOOK_PAGE_INSIGHT_METRICS = [
  "page_media_view",
  "page_total_media_view_unique",
] as const;

export type FacebookPageInsightMetric =
  (typeof FACEBOOK_PAGE_INSIGHT_METRICS)[number];

export type MetaInsightErrorCategory =
  | "authorization_expired"
  | "permission_required"
  | "rate_limited"
  | "not_found"
  | "temporary"
  | "malformed"
  | "unsupported"
  | "deprecated"
  | "privacy_threshold";

export class MetaInsightError extends ServiceError {
  readonly category: MetaInsightErrorCategory;

  constructor(
    category: MetaInsightErrorCategory,
    message: string,
    options?: { status?: number },
  ) {
    const code =
      category === "authorization_expired" ||
      category === "permission_required"
        ? "forbidden"
        : category === "not_found"
          ? "not_found"
          : category === "malformed" ||
              category === "unsupported" ||
              category === "deprecated"
            ? "invalid_input"
            : "unavailable";

    super(code, message, {
      status:
        options?.status ??
        (category === "authorization_expired" ||
        category === "permission_required"
          ? 403
          : category === "not_found"
            ? 404
            : category === "rate_limited"
              ? 429
              : 503),
    });
    this.name = "MetaInsightError";
    this.category = category;
  }
}

export type FacebookPageIdentitySnapshot = {
  name: string;
  category: string | null;
  profileImageUrl: string | null;
  followers: number | null;
  timezone: string | null;
};

export type FacebookDailyInsightRow = {
  /** YYYY-MM-DD in the Page/provider day boundary. */
  date: string;
  reach: number | null;
  impressions: number | null;
  engagement: number | null;
  /** Point-in-time lifetime total when stamped; null when unknown. */
  followers: number | null;
  pageVisits: number | null;
  followersAcquired: number | null;
  followersLost: number | null;
  contentPublished: number | null;
};

export type FacebookMetricIngestionStatus = {
  dashboardMetric: string;
  metaSource: string;
  status:
    | "received"
    | "empty"
    | "unsupported"
    | "deprecated"
    | "permission_denied"
    | "privacy_threshold"
    | "unavailable"
    | "error";
  rowCount: number;
  coveredFrom: string | null;
  coveredThrough: string | null;
  errorCategory: string | null;
};

export type FacebookInsightsFetchResult = {
  identity: FacebookPageIdentitySnapshot;
  days: FacebookDailyInsightRow[];
  /** Opaque resume cursor when pagination stopped early. */
  nextCursor: string | null;
  partial: boolean;
  providerSyncedAt: string;
  graphApiVersion: string;
  metricReport: FacebookMetricIngestionStatus[];
};

export type MetaInsightsTransport = {
  fetchJson: (
    url: URL,
    stage: string,
  ) => Promise<Record<string, unknown>>;
};

function graphUrl(path: string): URL {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(
    `https://graph.facebook.com/${GRAPH_VERSION}${normalized}`,
  );
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function classifyMetaStatus(
  status: number,
  body: Record<string, unknown>,
): MetaInsightErrorCategory {
  const error =
    typeof body.error === "object" &&
    body.error !== null &&
    !Array.isArray(body.error)
      ? (body.error as Record<string, unknown>)
      : null;
  const code = readNumber(error ?? {}, "code");
  const subcode = readNumber(error ?? {}, "error_subcode");
  const message = (readString(error ?? {}, "message") ?? "").toLowerCase();

  if (status === 429 || code === 4 || code === 17 || code === 32) {
    return "rate_limited";
  }

  if (
    status === 401 ||
    code === 190 ||
    code === 102 ||
    subcode === 463 ||
    subcode === 467 ||
    message.includes("session has expired") ||
    message.includes("error validating access token")
  ) {
    return "authorization_expired";
  }

  if (
    message.includes("deprecated") ||
    message.includes("no longer available") ||
    message.includes("has been deprecated")
  ) {
    return "deprecated";
  }

  if (
    message.includes("privacy") ||
    message.includes("100 likes") ||
    message.includes("not enough data") ||
    message.includes("threshold")
  ) {
    return "privacy_threshold";
  }

  if (
    status === 403 ||
    code === 10 ||
    code === 200 ||
    code === 294 ||
    subcode === 33 ||
    message.includes("permission") ||
    message.includes("#10")
  ) {
    return "permission_required";
  }

  if (
    code === 100 &&
    (message.includes("nonexisting field") ||
      message.includes("valid insights metric") ||
      message.includes("unknown field") ||
      message.includes("tried accessing") ||
      message.includes("invalid metric") ||
      message.includes("is not a valid"))
  ) {
    return "unsupported";
  }

  if (status === 404 || code === 100 || message.includes("does not exist")) {
    return "not_found";
  }

  if (status >= 500) {
    return "temporary";
  }

  return "temporary";
}

async function defaultFetchJson(
  url: URL,
  stage: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TOKEN_REQUEST_TIMEOUT_MS,
  );

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new MetaInsightError(
        "temporary",
        "Facebook Page sync timed out. You can retry.",
        { status: 503 },
      );
    }

    throw new MetaInsightError(
      "temporary",
      "Facebook Page sync could not be completed. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new MetaInsightError(
      "malformed",
      "Facebook returned an unexpected sync response.",
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new MetaInsightError(
      "malformed",
      "Facebook returned an invalid sync response.",
      { status: 502 },
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    throw new MetaInsightError(
      "malformed",
      "Facebook returned an incomplete sync response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;

  if (!response.ok || record.error) {
    const category = classifyMetaStatus(response.status, record);
    void stage;
    throw new MetaInsightError(
      category,
      category === "authorization_expired"
        ? "Facebook authorization expired. Reconnect to continue."
        : category === "permission_required"
          ? "Facebook Page analytics access is missing. Reconnect with Page access, and ensure your Meta app use case includes pages_read_engagement and read_insights."
          : category === "rate_limited"
            ? "Facebook rate-limited analytics sync. Wait a moment and retry."
            : category === "not_found"
              ? "The selected Facebook Page is no longer available through this authorization."
              : category === "unsupported" || category === "deprecated"
                ? "Facebook returned an unsupported or deprecated analytics metric."
                : category === "privacy_threshold"
                  ? "Facebook withheld analytics below a privacy or Page-size threshold."
                  : category === "malformed"
                    ? "Facebook returned an unsupported analytics field or metric. Sync cannot continue until the integration is updated."
                    : "Facebook Page sync failed temporarily. You can retry.",
    );
  }

  return record;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  run: () => Promise<T>,
  options?: { attempts?: number },
): Promise<T> {
  const attempts = options?.attempts ?? 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (
        !(error instanceof MetaInsightError) ||
        (error.category !== "temporary" &&
          error.category !== "rate_limited") ||
        attempt >= attempts
      ) {
        throw error;
      }

      const delayMs =
        error.category === "rate_limited"
          ? 800 * attempt * attempt
          : 250 * attempt * attempt;
      await sleep(delayMs);
    }
  }

  throw lastError;
}

function mapIdentity(
  record: Record<string, unknown>,
): FacebookPageIdentitySnapshot {
  const name = readString(record, "name");
  if (!name) {
    throw new MetaInsightError(
      "malformed",
      "Facebook returned an incomplete Page identity.",
      { status: 502 },
    );
  }

  let profileImageUrl: string | null = null;
  const picture = record.picture;
  if (
    typeof picture === "object" &&
    picture !== null &&
    !Array.isArray(picture)
  ) {
    const data = (picture as Record<string, unknown>).data;
    if (
      typeof data === "object" &&
      data !== null &&
      !Array.isArray(data)
    ) {
      profileImageUrl = readString(
        data as Record<string, unknown>,
        "url",
      );
    }
  }

  return {
    name,
    category: readString(record, "category"),
    profileImageUrl,
    followers:
      readNumber(record, "followers_count") ??
      readNumber(record, "fan_count"),
    timezone: null,
  };
}

function emptyDay(date: string): FacebookDailyInsightRow {
  return {
    date,
    reach: null,
    impressions: null,
    engagement: null,
    followers: null,
    pageVisits: null,
    followersAcquired: null,
    followersLost: null,
    contentPublished: null,
  };
}

function upsertDay(
  byDate: Map<string, FacebookDailyInsightRow>,
  date: string,
  patch: Partial<FacebookDailyInsightRow>,
): void {
  const current = byDate.get(date) ?? emptyDay(date);
  byDate.set(date, {
    ...current,
    ...patch,
    date,
  });
}

function readInsightValues(
  metricRecord: Record<string, unknown>,
): Array<{ date: string; value: number }> {
  const values = metricRecord.values;
  if (!Array.isArray(values)) {
    return [];
  }

  const rows: Array<{ date: string; value: number }> = [];

  for (const item of values) {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item)
    ) {
      continue;
    }

    const row = item as Record<string, unknown>;
    const endTime = readString(row, "end_time");
    if (!endTime) {
      continue;
    }

    const endDate = endTime.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      continue;
    }

    // Meta day-period `end_time` is the exclusive end of the day bucket
    // (often midnight at the start of the next calendar day in UTC).
    // Reporting date = end_time date − 1 day so Jul 17 data is not labeled Jul 18.
    const date = shiftInsightEndTimeToReportingDate(endDate);

    const value = readNumber(row, "value");
    if (value == null) {
      continue;
    }
    rows.push({ date, value: Math.max(0, Math.trunc(value)) });
  }

  return rows;
}

function coverageFromDates(dates: string[]): {
  coveredFrom: string | null;
  coveredThrough: string | null;
} {
  if (dates.length === 0) {
    return { coveredFrom: null, coveredThrough: null };
  }
  const sorted = [...dates].sort();
  return {
    coveredFrom: sorted[0] ?? null,
    coveredThrough: sorted[sorted.length - 1] ?? null,
  };
}

function statusFromCategory(
  category: MetaInsightErrorCategory,
): FacebookMetricIngestionStatus["status"] {
  if (category === "permission_required") return "permission_denied";
  if (category === "deprecated") return "deprecated";
  if (category === "unsupported" || category === "malformed") {
    return "unsupported";
  }
  if (category === "privacy_threshold") return "privacy_threshold";
  return "error";
}

function applyMetricValues(
  byDate: Map<string, FacebookDailyInsightRow>,
  metaMetric: string,
  values: Array<{ date: string; value: number }>,
  range?: { since: string; until: string },
): void {
  const candidate = FACEBOOK_PAGE_INSIGHT_CANDIDATES.find(
    (row) => row.metaMetric === metaMetric,
  );
  if (!candidate) {
    return;
  }

  for (const point of values) {
    if (range && (point.date < range.since || point.date > range.until)) {
      continue;
    }
    upsertDay(byDate, point.date, {
      [candidate.dayField]: point.value,
    } as Partial<FacebookDailyInsightRow>);
  }
}

async function fetchInsightsForMetrics(options: {
  externalPageId: string;
  pageAccessToken: string;
  since: string;
  until: string;
  metrics: string[];
  cursor?: string | null;
  transport: MetaInsightsTransport;
}): Promise<{
  byMetric: Map<string, Array<{ date: string; value: number }>>;
  nextCursor: string | null;
  partial: boolean;
}> {
  const byMetric = new Map<string, Array<{ date: string; value: number }>>();
  if (options.metrics.length === 0) {
    return { byMetric, nextCursor: null, partial: false };
  }

  let nextUrl: URL | null = graphUrl(
    `/${encodeURIComponent(options.externalPageId.trim())}/insights`,
  );
  nextUrl.searchParams.set("metric", options.metrics.join(","));
  nextUrl.searchParams.set("period", "day");
  nextUrl.searchParams.set("since", options.since);
  nextUrl.searchParams.set("until", options.until);
  nextUrl.searchParams.set("access_token", options.pageAccessToken);

  if (options.cursor?.trim()) {
    nextUrl.searchParams.set("after", options.cursor.trim());
  }

  let pages = 0;
  let partial = false;
  let nextCursor: string | null = null;

  while (nextUrl && pages < MAX_INSIGHT_PAGES) {
    pages += 1;
    let pageRecord: Record<string, unknown>;
    try {
      const url = nextUrl;
      pageRecord = await withRetry(() =>
        options.transport.fetchJson(url, "page_insights"),
      );
    } catch (error) {
      if (
        error instanceof MetaInsightError &&
        (error.category === "temporary" ||
          error.category === "rate_limited") &&
        byMetric.size > 0
      ) {
        partial = true;
        break;
      }
      throw error;
    }

    const data = pageRecord.data;
    if (Array.isArray(data)) {
      for (const metric of data) {
        if (
          typeof metric !== "object" ||
          metric === null ||
          Array.isArray(metric)
        ) {
          continue;
        }
        const metricRecord = metric as Record<string, unknown>;
        const name = readString(metricRecord, "name");
        if (!name) continue;
        const values = readInsightValues(metricRecord);
        const existing = byMetric.get(name) ?? [];
        byMetric.set(name, existing.concat(values));
      }
    }

    const paging =
      typeof pageRecord.paging === "object" &&
      pageRecord.paging !== null &&
      !Array.isArray(pageRecord.paging)
        ? (pageRecord.paging as Record<string, unknown>)
        : null;
    const cursors =
      paging &&
      typeof paging.cursors === "object" &&
      paging.cursors !== null &&
      !Array.isArray(paging.cursors)
        ? (paging.cursors as Record<string, unknown>)
        : null;
    const after = cursors ? readString(cursors, "after") : null;
    const next = paging ? readString(paging, "next") : null;

    if (next) {
      try {
        nextUrl = new URL(next);
        nextCursor = after;
      } catch {
        nextUrl = null;
        nextCursor = after;
      }
    } else {
      nextUrl = null;
      nextCursor = null;
    }
  }

  if (pages >= MAX_INSIGHT_PAGES && nextUrl) {
    partial = true;
  }

  return { byMetric, nextCursor: partial ? nextCursor : null, partial };
}

/**
 * Verify which insight metrics the configured Graph version accepts.
 * Splits batches on unsupported/deprecated errors; never substitutes
 * legacy page_impressions for media views.
 */
export async function probeFacebookPageInsightMetrics(options: {
  externalPageId: string;
  pageAccessToken: string;
  since: string;
  until: string;
  transport: MetaInsightsTransport;
  candidates?: readonly string[];
}): Promise<{
  supported: string[];
  report: FacebookMetricIngestionStatus[];
  byMetric: Map<string, Array<{ date: string; value: number }>>;
  partial: boolean;
  nextCursor: string | null;
}> {
  const candidates = [
    ...(options.candidates ??
      FACEBOOK_PAGE_INSIGHT_CANDIDATES.map((row) => row.metaMetric)),
  ];
  const supported: string[] = [];
  const report: FacebookMetricIngestionStatus[] = [];
  const claimedDashboards = new Set<string>();
  const byMetric = new Map<string, Array<{ date: string; value: number }>>();
  let partial = false;
  let nextCursor: string | null = null;

  async function probeOne(metric: string): Promise<void> {
    const candidate = FACEBOOK_PAGE_INSIGHT_CANDIDATES.find(
      (row) => row.metaMetric === metric,
    );
    if (
      candidate &&
      claimedDashboards.has(candidate.dashboardMetric)
    ) {
      report.push({
        dashboardMetric: candidate.dashboardMetric,
        metaSource: metric,
        status: "unsupported",
        rowCount: 0,
        coveredFrom: null,
        coveredThrough: null,
        errorCategory: "skipped_fallback",
      });
      return;
    }

    try {
      const result = await fetchInsightsForMetrics({
        externalPageId: options.externalPageId,
        pageAccessToken: options.pageAccessToken,
        since: options.since,
        until: options.until,
        metrics: [metric],
        transport: options.transport,
      });
      const values = result.byMetric.get(metric) ?? [];
      byMetric.set(metric, values);
      partial = partial || result.partial;
      if (result.nextCursor) nextCursor = result.nextCursor;
      const dates = values.map((row) => row.date);
      const coverage = coverageFromDates(dates);
      supported.push(metric);
      if (candidate) {
        claimedDashboards.add(candidate.dashboardMetric);
      }
      report.push({
        dashboardMetric: candidate?.dashboardMetric ?? metric,
        metaSource: metric,
        status: values.length > 0 ? "received" : "empty",
        rowCount: values.length,
        coveredFrom: coverage.coveredFrom,
        coveredThrough: coverage.coveredThrough,
        errorCategory: null,
      });
    } catch (error) {
      const category =
        error instanceof MetaInsightError ? error.category : "temporary";
      report.push({
        dashboardMetric: candidate?.dashboardMetric ?? metric,
        metaSource: metric,
        status: statusFromCategory(category),
        rowCount: 0,
        coveredFrom: null,
        coveredThrough: null,
        errorCategory: category,
      });
    }
  }

  const core = candidates.filter((name) =>
    (FACEBOOK_PAGE_INSIGHT_METRICS as readonly string[]).includes(name),
  );
  const rest = candidates.filter(
    (name) => !(FACEBOOK_PAGE_INSIGHT_METRICS as readonly string[]).includes(name),
  );

  if (core.length > 0) {
    try {
      const result = await fetchInsightsForMetrics({
        externalPageId: options.externalPageId,
        pageAccessToken: options.pageAccessToken,
        since: options.since,
        until: options.until,
        metrics: core,
        transport: options.transport,
      });
      partial = partial || result.partial;
      if (result.nextCursor) nextCursor = result.nextCursor;
      for (const metric of core) {
        const values = result.byMetric.get(metric) ?? [];
        byMetric.set(metric, values);
        const coverage = coverageFromDates(values.map((row) => row.date));
        const candidate = FACEBOOK_PAGE_INSIGHT_CANDIDATES.find(
          (row) => row.metaMetric === metric,
        );
        supported.push(metric);
        if (candidate) claimedDashboards.add(candidate.dashboardMetric);
        report.push({
          dashboardMetric: candidate?.dashboardMetric ?? metric,
          metaSource: metric,
          status: values.length > 0 ? "received" : "empty",
          rowCount: values.length,
          coveredFrom: coverage.coveredFrom,
          coveredThrough: coverage.coveredThrough,
          errorCategory: null,
        });
      }
    } catch {
      for (const metric of core) {
        await probeOne(metric);
      }
    }
  }

  for (const metric of rest) {
    await probeOne(metric);
  }

  return { supported, report, byMetric, partial, nextCursor };
}

async function fetchPublishedPostsSummary(options: {
  externalPageId: string;
  pageAccessToken: string;
  since: string;
  until: string;
  transport: MetaInsightsTransport;
}): Promise<{
  postCount: number;
  reactionTotal: number | null;
  byDate: Map<string, { content: number; reactions: number }>;
  status: FacebookMetricIngestionStatus;
  engagementStatus: FacebookMetricIngestionStatus;
}> {
  const byDate = new Map<string, { content: number; reactions: number }>();
  let postCount = 0;
  let reactionTotal = 0;
  let reactionsSeen = false;

  try {
    let nextUrl: URL | null = graphUrl(
      `/${encodeURIComponent(options.externalPageId.trim())}/published_posts`,
    );
    nextUrl.searchParams.set(
      "fields",
      "created_time,reactions.summary(true).limit(0)",
    );
    nextUrl.searchParams.set("since", options.since);
    nextUrl.searchParams.set("until", options.until);
    nextUrl.searchParams.set("limit", "100");
    nextUrl.searchParams.set("access_token", options.pageAccessToken);

    let pages = 0;
    while (nextUrl && pages < MAX_POST_PAGES) {
      pages += 1;
      const pageRecord = await withRetry(() =>
        options.transport.fetchJson(nextUrl!, "page_posts"),
      );
      const data = pageRecord.data;
      if (Array.isArray(data)) {
        for (const item of data) {
          if (
            typeof item !== "object" ||
            item === null ||
            Array.isArray(item)
          ) {
            continue;
          }
          const row = item as Record<string, unknown>;
          const created = readString(row, "created_time");
          if (!created) continue;
          const date = created.slice(0, 10);
          if (date < options.since || date > options.until) continue;

          postCount += 1;
          const bucket = byDate.get(date) ?? { content: 0, reactions: 0 };
          bucket.content += 1;

          const reactions = row.reactions;
          if (
            typeof reactions === "object" &&
            reactions !== null &&
            !Array.isArray(reactions)
          ) {
            const summary = (reactions as Record<string, unknown>).summary;
            if (
              typeof summary === "object" &&
              summary !== null &&
              !Array.isArray(summary)
            ) {
              const total = readNumber(
                summary as Record<string, unknown>,
                "total_count",
              );
              if (total != null) {
                reactionsSeen = true;
                reactionTotal += total;
                bucket.reactions += total;
              }
            }
          }
          byDate.set(date, bucket);
        }
      }

      const paging =
        typeof pageRecord.paging === "object" &&
        pageRecord.paging !== null &&
        !Array.isArray(pageRecord.paging)
          ? (pageRecord.paging as Record<string, unknown>)
          : null;
      const next = paging ? readString(paging, "next") : null;
      if (next) {
        try {
          nextUrl = new URL(next);
        } catch {
          nextUrl = null;
        }
      } else {
        nextUrl = null;
      }
    }

    const dates = [...byDate.keys()].sort();
    return {
      postCount,
      reactionTotal: reactionsSeen ? reactionTotal : null,
      byDate,
      status: {
        dashboardMetric: "total_content",
        metaSource: "published_posts",
        status: postCount > 0 ? "received" : "empty",
        rowCount: postCount,
        coveredFrom: dates[0] ?? null,
        coveredThrough: dates[dates.length - 1] ?? null,
        errorCategory: null,
      },
      engagementStatus: {
        dashboardMetric: "engagement",
        metaSource: "published_posts.reactions.summary",
        status: reactionsSeen
          ? reactionTotal > 0
            ? "received"
            : "empty"
          : "unavailable",
        rowCount: reactionsSeen ? postCount : 0,
        coveredFrom: dates[0] ?? null,
        coveredThrough: dates[dates.length - 1] ?? null,
        errorCategory: reactionsSeen ? null : "reactions_summary_unavailable",
      },
    };
  } catch (error) {
    const category =
      error instanceof MetaInsightError ? error.category : "temporary";
    return {
      postCount: 0,
      reactionTotal: null,
      byDate,
      status: {
        dashboardMetric: "total_content",
        metaSource: "published_posts",
        status: statusFromCategory(category),
        rowCount: 0,
        coveredFrom: null,
        coveredThrough: null,
        errorCategory: category,
      },
      engagementStatus: {
        dashboardMetric: "engagement",
        metaSource: "published_posts.reactions.summary",
        status: statusFromCategory(category),
        rowCount: 0,
        coveredFrom: null,
        coveredThrough: null,
        errorCategory: category,
      },
    };
  }
}

/**
 * Fetch selected Page identity + daily insights + posts summary.
 * Never logs tokens or Page IDs. Callers must not wrap this in a DB TX.
 */
export async function fetchFacebookPageInsights(options: {
  pageAccessToken: string;
  externalPageId: string;
  since: string;
  until: string;
  cursor?: string | null;
  transport?: MetaInsightsTransport;
}): Promise<FacebookInsightsFetchResult> {
  if (!options.pageAccessToken.trim() || !options.externalPageId.trim()) {
    throw new MetaInsightError(
      "authorization_expired",
      "Facebook Page credentials are missing for analytics sync.",
      { status: 403 },
    );
  }

  const transport = options.transport ?? { fetchJson: defaultFetchJson };

  const identityUrl = graphUrl(
    `/${encodeURIComponent(options.externalPageId.trim())}`,
  );
  identityUrl.searchParams.set(
    "fields",
    "name,category,picture{url},fan_count,followers_count",
  );
  identityUrl.searchParams.set(
    "access_token",
    options.pageAccessToken,
  );

  const identityRecord = await withRetry(() =>
    transport.fetchJson(identityUrl, "page_identity"),
  );
  const identity = mapIdentity(identityRecord);

  const probe = await probeFacebookPageInsightMetrics({
    externalPageId: options.externalPageId,
    pageAccessToken: options.pageAccessToken,
    since: options.since,
    until: options.until,
    transport,
  });

  const byDate = new Map<string, FacebookDailyInsightRow>();
  let nextCursor: string | null = probe.nextCursor;
  let partial = probe.partial;

  for (const [metric, values] of probe.byMetric) {
    applyMetricValues(byDate, metric, values, {
      since: options.since,
      until: options.until,
    });
  }

  // Resume cursor pagination only when the probe could not finish.
  if (options.cursor?.trim() || (probe.partial && probe.supported.length > 0)) {
    try {
      const fetched = await fetchInsightsForMetrics({
        externalPageId: options.externalPageId,
        pageAccessToken: options.pageAccessToken,
        since: options.since,
        until: options.until,
        metrics: probe.supported,
        cursor: options.cursor,
        transport,
      });
      nextCursor = fetched.nextCursor;
      partial = partial || fetched.partial;
      for (const [metric, values] of fetched.byMetric) {
        applyMetricValues(byDate, metric, values, {
          since: options.since,
          until: options.until,
        });
        const inRange = values.filter(
          (row) => row.date >= options.since && row.date <= options.until,
        );
        const coverage = coverageFromDates(inRange.map((row) => row.date));
        const entry = probe.report.find((row) => row.metaSource === metric);
        if (entry && (entry.status === "received" || entry.status === "empty")) {
          entry.rowCount = inRange.length;
          entry.coveredFrom = coverage.coveredFrom;
          entry.coveredThrough = coverage.coveredThrough;
          entry.status = inRange.length > 0 ? "received" : "empty";
        }
      }
    } catch (error) {
      if (
        error instanceof MetaInsightError &&
        (error.category === "temporary" ||
          error.category === "rate_limited") &&
        byDate.size > 0
      ) {
        partial = true;
      } else if (!(options.cursor?.trim())) {
        // Probe already populated days; keep partial rather than failing hard.
        partial = true;
      } else {
        throw error;
      }
    }
  }

  // Clamp probe report coverage to the requested window.
  for (const entry of probe.report) {
    if (entry.status !== "received" && entry.status !== "empty") continue;
    const values = (probe.byMetric.get(entry.metaSource) ?? []).filter(
      (row) => row.date >= options.since && row.date <= options.until,
    );
    const coverage = coverageFromDates(values.map((row) => row.date));
    entry.rowCount = values.length;
    entry.coveredFrom = coverage.coveredFrom;
    entry.coveredThrough = coverage.coveredThrough;
    entry.status = values.length > 0 ? "received" : "empty";
  }

  const posts = await fetchPublishedPostsSummary({
    externalPageId: options.externalPageId,
    pageAccessToken: options.pageAccessToken,
    since: options.since,
    until: options.until,
    transport,
  });

  for (const [date, bucket] of posts.byDate) {
    upsertDay(byDate, date, {
      contentPublished: bucket.content,
      engagement: posts.reactionTotal != null ? bucket.reactions : null,
    });
  }

  // Confirmed empty posts query → store attested 0 (not missing/—).
  if (posts.status.status === "empty") {
    upsertDay(byDate, options.until, {
      contentPublished: 0,
    });
  }

  if (identity.followers != null) {
    const stampCandidates = [...byDate.keys()]
      .filter((date) => date <= options.until)
      .sort();
    const stampDate = stampCandidates.at(-1) ?? options.until;
    upsertDay(byDate, stampDate, {
      followers: Math.max(0, Math.trunc(identity.followers)),
    });
  }

  const lifetimeReport: FacebookMetricIngestionStatus = {
    dashboardMetric: "lifetime_followers",
    metaSource: "followers_count|fan_count",
    status: identity.followers != null ? "received" : "unavailable",
    rowCount: identity.followers != null ? 1 : 0,
    coveredFrom: identity.followers != null ? options.until : null,
    coveredThrough: identity.followers != null ? options.until : null,
    errorCategory:
      identity.followers != null ? null : "identity_followers_missing",
  };

  const netFollowerReport: FacebookMetricIngestionStatus = {
    dashboardMetric: "net_follower_change",
    metaSource: "derived:followers_acquired-followers_lost|lifetime_delta",
    status: "unavailable",
    rowCount: 0,
    coveredFrom: null,
    coveredThrough: null,
    errorCategory: "requires_confirmed_daily_or_endpoint_snapshots",
  };

  const acquired = probe.report.find(
    (row) => row.dashboardMetric === "followers_acquired" && row.status === "received",
  );
  const lost = probe.report.find(
    (row) => row.dashboardMetric === "followers_lost" && row.status === "received",
  );
  if (acquired || lost) {
    netFollowerReport.status = "received";
    netFollowerReport.rowCount =
      (acquired?.rowCount ?? 0) + (lost?.rowCount ?? 0);
    netFollowerReport.coveredFrom =
      [acquired?.coveredFrom, lost?.coveredFrom]
        .filter(Boolean)
        .sort()[0] ?? null;
    netFollowerReport.coveredThrough =
      [acquired?.coveredThrough, lost?.coveredThrough]
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
    netFollowerReport.errorCategory = null;
    netFollowerReport.metaSource =
      "page_daily_follows*_minus_page_daily_unfollows*";
  }

  const days = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return {
    identity,
    days,
    nextCursor: partial ? nextCursor : null,
    partial,
    providerSyncedAt: new Date().toISOString(),
    graphApiVersion: GRAPH_VERSION,
    metricReport: [
      lifetimeReport,
      netFollowerReport,
      ...probe.report.filter(
        (row) =>
          row.dashboardMetric === "views" ||
          row.dashboardMetric === "unique_media_views" ||
          row.dashboardMetric === "page_visits" ||
          row.dashboardMetric === "followers_acquired" ||
          row.dashboardMetric === "followers_lost",
      ),
      posts.status,
      posts.engagementStatus,
    ],
  };
}
