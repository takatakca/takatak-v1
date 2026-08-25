import "server-only";

import { createHash } from "node:crypto";

import {
  MetaInsightError,
  GRAPH_VERSION,
  type MetaInsightsTransport,
} from "@/lib/social/providers/meta-insights";

const TOKEN_REQUEST_TIMEOUT_MS = 12_000;
const MAX_PAGES = 20;

export type FacebookContentType = "post" | "reel" | "story";

export type MetricFieldStatus =
  | "confirmed"
  | "confirmed_zero"
  | "unavailable"
  | "partial"
  | "permission_denied"
  | "privacy_threshold"
  | "unsupported";

export type FacebookContentMetricStatus = {
  reach: MetricFieldStatus;
  views: MetricFieldStatus;
  reactions: MetricFieldStatus;
  comments: MetricFieldStatus;
  shares: MetricFieldStatus;
  engagement: MetricFieldStatus;
};

export type FacebookContentItemDraft = {
  contentType: FacebookContentType;
  externalObjectId: string;
  externalIdHash: string;
  publishedAt: string;
  captionExcerpt: string | null;
  permalinkUrl: string | null;
  thumbnailUrl: string | null;
  availability: "available" | "expired" | "deleted" | "unknown";
  reach: number | null;
  views: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
  engagement: number | null;
  metricStatus: FacebookContentMetricStatus;
  graphApiVersion: string;
  retrievedAt: string;
};

export type FacebookContentFetchReport = {
  contentType: FacebookContentType;
  metaSource: string;
  status:
    | "received"
    | "empty"
    | "unsupported"
    | "permission_denied"
    | "privacy_threshold"
    | "unavailable"
    | "error";
  itemCount: number;
  coveredFrom: string | null;
  coveredThrough: string | null;
  errorCategory: string | null;
};

export type FacebookContentFetchResult = {
  items: FacebookContentItemDraft[];
  report: FacebookContentFetchReport[];
  partial: boolean;
  graphApiVersion: string;
  providerSyncedAt: string;
};

export const FACEBOOK_CONTENT_METRIC_MATRIX = [
  {
    contentType: "post" as const,
    dashboardMetric: "views",
    metaSource: "post_media_view|post_impressions (legacy rejected)",
    status: "probe_post_insights",
  },
  {
    contentType: "post" as const,
    dashboardMetric: "reach",
    metaSource: "post_total_media_view_unique",
    status: "probe_post_insights",
  },
  {
    contentType: "post" as const,
    dashboardMetric: "reactions",
    metaSource: "reactions.summary.total_count",
    status: "supported",
  },
  {
    contentType: "post" as const,
    dashboardMetric: "comments",
    metaSource: "comments.summary.total_count",
    status: "supported",
  },
  {
    contentType: "post" as const,
    dashboardMetric: "shares",
    metaSource: "shares.count",
    status: "supported",
  },
  {
    contentType: "reel" as const,
    dashboardMetric: "views",
    metaSource: "post_video_views|video insights",
    status: "probe_then_fetch",
  },
  {
    contentType: "story" as const,
    dashboardMetric: "views",
    metaSource: "story insights when permitted",
    status: "probe_then_fetch",
  },
  {
    contentType: "page" as const,
    dashboardMetric: "demographics",
    metaSource: "page_fans_gender_age|page_fans_city (privacy thresholded)",
    status: "probe_only_when_returned",
  },
] as const;

function graphUrl(path: string): URL {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return new URL(`https://graph.facebook.com/${GRAPH_VERSION}${normalized}`);
}

export function hashExternalContentId(externalObjectId: string): string {
  return createHash("sha256")
    .update(`meta:facebook:content:${externalObjectId}`)
    .digest("hex")
    .slice(0, 32);
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function excerptCaption(value: string | null, max = 180): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

function summaryTotal(record: Record<string, unknown>, key: string): number | null {
  const node = record[key];
  if (typeof node !== "object" || node === null || Array.isArray(node)) {
    return null;
  }
  const summary = (node as Record<string, unknown>).summary;
  if (typeof summary !== "object" || summary === null || Array.isArray(summary)) {
    return null;
  }
  const total = readNumber(summary as Record<string, unknown>, "total_count");
  return total == null ? null : Math.max(0, Math.trunc(total));
}

function fieldStatus(value: number | null): MetricFieldStatus {
  if (value == null) return "unavailable";
  if (value === 0) return "confirmed_zero";
  return "confirmed";
}

function buildMetricStatus(options: {
  reach: number | null;
  views: number | null;
  reactions: number | null;
  comments: number | null;
  shares: number | null;
}): FacebookContentMetricStatus {
  const engagementParts = [
    options.reactions,
    options.comments,
    options.shares,
  ].filter((v): v is number => v != null);
  const engagement =
    engagementParts.length > 0
      ? engagementParts.reduce((sum, n) => sum + n, 0)
      : null;
  return {
    reach: fieldStatus(options.reach),
    views: fieldStatus(options.views),
    reactions: fieldStatus(options.reactions),
    comments: fieldStatus(options.comments),
    shares: fieldStatus(options.shares),
    engagement: fieldStatus(engagement),
  };
}

async function defaultFetchJson(
  url: URL,
  stage: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new MetaInsightError(
        "malformed",
        "Facebook returned an unexpected content response.",
        { status: 502 },
      );
    }
    const body = (await response.json()) as Record<string, unknown>;
    if (!response.ok || body.error) {
      void stage;
      const message =
        typeof body.error === "object" &&
        body.error !== null &&
        !Array.isArray(body.error)
          ? String((body.error as Record<string, unknown>).message ?? "")
          : "";
      const lower = message.toLowerCase();
      if (lower.includes("permission") || response.status === 403) {
        throw new MetaInsightError(
          "permission_required",
          "Facebook content access is missing.",
          { status: 403 },
        );
      }
      if (lower.includes("privacy") || lower.includes("threshold")) {
        throw new MetaInsightError(
          "privacy_threshold",
          "Facebook withheld content metrics below a privacy threshold.",
        );
      }
      if (
        lower.includes("deprecated") ||
        lower.includes("nonexisting") ||
        lower.includes("unknown path") ||
        lower.includes("does not exist")
      ) {
        throw new MetaInsightError(
          "unsupported",
          "Facebook content endpoint is unsupported for this app/version.",
        );
      }
      if (response.status === 401) {
        throw new MetaInsightError(
          "authorization_expired",
          "Facebook authorization expired.",
          { status: 401 },
        );
      }
      throw new MetaInsightError(
        "temporary",
        "Facebook content sync failed temporarily.",
      );
    }
    return body;
  } catch (error) {
    if (error instanceof MetaInsightError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MetaInsightError(
        "temporary",
        "Facebook content sync timed out.",
      );
    }
    throw new MetaInsightError(
      "temporary",
      "Facebook content sync could not be completed.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function paginateEdge(options: {
  path: string;
  pageAccessToken: string;
  fields: string;
  since?: string;
  until?: string;
  transport: MetaInsightsTransport;
  stage: string;
}): Promise<{
  rows: Record<string, unknown>[];
  partial: boolean;
  error: MetaInsightError | null;
}> {
  const rows: Record<string, unknown>[] = [];
  let nextUrl: URL | null = graphUrl(options.path);
  nextUrl.searchParams.set("fields", options.fields);
  nextUrl.searchParams.set("limit", "50");
  nextUrl.searchParams.set("access_token", options.pageAccessToken);
  if (options.since) nextUrl.searchParams.set("since", options.since);
  if (options.until) nextUrl.searchParams.set("until", options.until);

  let pages = 0;
  let partial = false;
  try {
    while (nextUrl && pages < MAX_PAGES) {
      pages += 1;
      const page = await options.transport.fetchJson(nextUrl, options.stage);
      const data = page.data;
      if (Array.isArray(data)) {
        for (const item of data) {
          if (typeof item === "object" && item !== null && !Array.isArray(item)) {
            rows.push(item as Record<string, unknown>);
          }
        }
      }
      const paging =
        typeof page.paging === "object" &&
        page.paging !== null &&
        !Array.isArray(page.paging)
          ? (page.paging as Record<string, unknown>)
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
    if (pages >= MAX_PAGES && nextUrl) partial = true;
    return { rows, partial, error: null };
  } catch (error) {
    return {
      rows,
      partial: rows.length > 0,
      error:
        error instanceof MetaInsightError
          ? error
          : new MetaInsightError("temporary", "Facebook content sync failed."),
    };
  }
}

function mapPostRow(
  row: Record<string, unknown>,
  contentType: FacebookContentType,
  retrievedAt: string,
): FacebookContentItemDraft | null {
  const id = readString(row, "id");
  const created =
    readString(row, "created_time") ??
    readString(row, "creation_time") ??
    null;
  if (!id || !created) return null;

  const publishedAt = new Date(created);
  if (Number.isNaN(publishedAt.getTime())) return null;

  const reactions = summaryTotal(row, "reactions");
  const comments = summaryTotal(row, "comments");
  const sharesNode = row.shares;
  const shares =
    typeof sharesNode === "object" &&
    sharesNode !== null &&
    !Array.isArray(sharesNode)
      ? readNumber(sharesNode as Record<string, unknown>, "count")
      : null;

  // Lifetime post media-view metrics when nested insights are present.
  let views: number | null = null;
  let reach: number | null = null;
  const insights = row.insights;
  if (
    typeof insights === "object" &&
    insights !== null &&
    !Array.isArray(insights)
  ) {
    const data = (insights as Record<string, unknown>).data;
    if (Array.isArray(data)) {
      for (const metric of data) {
        if (
          typeof metric !== "object" ||
          metric === null ||
          Array.isArray(metric)
        ) {
          continue;
        }
        const name = readString(metric as Record<string, unknown>, "name");
        const values = (metric as Record<string, unknown>).values;
        const first =
          Array.isArray(values) &&
          typeof values[0] === "object" &&
          values[0] !== null
            ? (values[0] as Record<string, unknown>)
            : null;
        const value = first ? readNumber(first, "value") : null;
        if (value == null) continue;
        // Reject legacy post_impressions / post_impressions_unique (unattested).
        if (name === "post_media_view" || name === "post_video_views") {
          views = Math.max(0, Math.trunc(value));
        }
        if (name === "post_total_media_view_unique") {
          reach = Math.max(0, Math.trunc(value));
        }
      }
    }
  }

  const status =
    readString(row, "status")?.toUpperCase() ?? null;
  const availability =
    contentType === "story" && status === "ARCHIVED"
      ? ("expired" as const)
      : ("available" as const);

  const metricStatus = buildMetricStatus({
    reach,
    views,
    reactions,
    comments,
    shares: shares == null ? null : Math.max(0, Math.trunc(shares)),
  });
  const engagementParts = [reactions, comments, shares].filter(
    (v): v is number => v != null,
  );

  return {
    contentType,
    externalObjectId: id,
    externalIdHash: hashExternalContentId(id),
    publishedAt: publishedAt.toISOString(),
    captionExcerpt: excerptCaption(
      readString(row, "message") ?? readString(row, "description"),
    ),
    permalinkUrl:
      readString(row, "permalink_url") ?? readString(row, "url") ?? null,
    thumbnailUrl:
      readString(row, "full_picture") ??
      readString(row, "picture") ??
      null,
    availability,
    reach,
    views,
    reactions,
    comments,
    shares: shares == null ? null : Math.max(0, Math.trunc(shares)),
    engagement:
      engagementParts.length > 0
        ? engagementParts.reduce((sum, n) => sum + n, 0)
        : null,
    metricStatus,
    graphApiVersion: GRAPH_VERSION,
    retrievedAt,
  };
}

function coverageDates(items: FacebookContentItemDraft[]): {
  coveredFrom: string | null;
  coveredThrough: string | null;
} {
  if (items.length === 0) {
    return { coveredFrom: null, coveredThrough: null };
  }
  const dates = items
    .map((item) => item.publishedAt.slice(0, 10))
    .sort();
  return {
    coveredFrom: dates[0] ?? null,
    coveredThrough: dates[dates.length - 1] ?? null,
  };
}

function reportFromError(
  contentType: FacebookContentType,
  metaSource: string,
  error: MetaInsightError | null,
  itemCount: number,
  coveredFrom: string | null,
  coveredThrough: string | null,
): FacebookContentFetchReport {
  if (!error) {
    return {
      contentType,
      metaSource,
      status: itemCount > 0 ? "received" : "empty",
      itemCount,
      coveredFrom,
      coveredThrough,
      errorCategory: null,
    };
  }
  const status =
    error.category === "permission_required"
      ? "permission_denied"
      : error.category === "privacy_threshold"
        ? "privacy_threshold"
        : error.category === "unsupported" || error.category === "deprecated"
          ? "unsupported"
          : error.category === "authorization_expired"
            ? "unavailable"
            : "error";
  return {
    contentType,
    metaSource,
    status,
    itemCount,
    coveredFrom,
    coveredThrough,
    errorCategory: error.category,
  };
}

/**
 * Fetch Page posts, reels, and stories for a range.
 * Never logs tokens or provider object IDs.
 */
export async function fetchFacebookPageContent(options: {
  pageAccessToken: string;
  externalPageId: string;
  since: string;
  until: string;
  transport?: MetaInsightsTransport;
}): Promise<FacebookContentFetchResult> {
  const transport = options.transport ?? { fetchJson: defaultFetchJson };
  const retrievedAt = new Date().toISOString();
  const pageId = options.externalPageId.trim();
  const items: FacebookContentItemDraft[] = [];
  const report: FacebookContentFetchReport[] = [];
  let partial = false;

  // Posts
  {
    const posts = await paginateEdge({
      path: `/${encodeURIComponent(pageId)}/published_posts`,
      pageAccessToken: options.pageAccessToken,
      fields:
        "id,message,created_time,permalink_url,full_picture,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0),insights.metric(post_media_view,post_total_media_view_unique)",
      since: options.since,
      until: options.until,
      transport,
      stage: "page_posts",
    });
    partial = partial || posts.partial;
    const mapped = posts.rows
      .map((row) => mapPostRow(row, "post", retrievedAt))
      .filter((row): row is FacebookContentItemDraft => row != null)
      .filter((row) => {
        const day = row.publishedAt.slice(0, 10);
        return day >= options.since && day <= options.until;
      });
    items.push(...mapped);
    const coverage = coverageDates(mapped);
    report.push(
      reportFromError(
        "post",
        "published_posts",
        posts.error,
        mapped.length,
        coverage.coveredFrom,
        coverage.coveredThrough,
      ),
    );
  }

  // Reels — probe video_reels; fall back to unsupported without inventing.
  {
    const reels = await paginateEdge({
      path: `/${encodeURIComponent(pageId)}/video_reels`,
      pageAccessToken: options.pageAccessToken,
      fields:
        "id,description,created_time,permalink_url,picture,reactions.summary(true).limit(0),comments.summary(true).limit(0)",
      since: options.since,
      until: options.until,
      transport,
      stage: "page_reels",
    });
    partial = partial || reels.partial;
    const mapped = reels.rows
      .map((row) => mapPostRow(row, "reel", retrievedAt))
      .filter((row): row is FacebookContentItemDraft => row != null)
      .filter((row) => {
        const day = row.publishedAt.slice(0, 10);
        return day >= options.since && day <= options.until;
      });
    items.push(...mapped);
    const coverage = coverageDates(mapped);
    report.push(
      reportFromError(
        "reel",
        "video_reels",
        reels.error,
        mapped.length,
        coverage.coveredFrom,
        coverage.coveredThrough,
      ),
    );
  }

  // Stories
  {
    const stories = await paginateEdge({
      path: `/${encodeURIComponent(pageId)}/stories`,
      pageAccessToken: options.pageAccessToken,
      fields: "post_id,status,creation_time,media_type,url",
      since: options.since,
      until: options.until,
      transport,
      stage: "page_stories",
    });
    partial = partial || stories.partial;
    const mapped = stories.rows
      .map((row) => {
        const normalized = {
          ...row,
          id: readString(row, "post_id") ?? readString(row, "id"),
        };
        return mapPostRow(normalized, "story", retrievedAt);
      })
      .filter((row): row is FacebookContentItemDraft => row != null)
      .filter((row) => {
        const day = row.publishedAt.slice(0, 10);
        return day >= options.since && day <= options.until;
      });
    items.push(...mapped);
    const coverage = coverageDates(mapped);
    report.push(
      reportFromError(
        "story",
        "stories",
        stories.error,
        mapped.length,
        coverage.coveredFrom,
        coverage.coveredThrough,
      ),
    );
  }

  return {
    items,
    report,
    partial,
    graphApiVersion: GRAPH_VERSION,
    providerSyncedAt: retrievedAt,
  };
}

/**
 * Probe Page demographics only when Meta returns values above privacy thresholds.
 * Never invents age/gender/city counts.
 */
export async function probeFacebookPageDemographics(options: {
  pageAccessToken: string;
  externalPageId: string;
  transport?: MetaInsightsTransport;
}): Promise<{
  status: "received" | "empty" | "privacy_threshold" | "permission_denied" | "unavailable";
  genderAge: Array<{ key: string; value: number }> | null;
  city: Array<{ key: string; value: number }> | null;
}> {
  const transport = options.transport ?? { fetchJson: defaultFetchJson };
  const url = graphUrl(`/${encodeURIComponent(options.externalPageId.trim())}/insights`);
  url.searchParams.set(
    "metric",
    "page_fans_gender_age,page_fans_city",
  );
  url.searchParams.set("period", "lifetime");
  url.searchParams.set("access_token", options.pageAccessToken);

  try {
    const body = await transport.fetchJson(url, "page_demographics");
    const data = Array.isArray(body.data) ? body.data : [];
    let genderAge: Array<{ key: string; value: number }> | null = null;
    let city: Array<{ key: string; value: number }> | null = null;

    for (const metric of data) {
      if (
        typeof metric !== "object" ||
        metric === null ||
        Array.isArray(metric)
      ) {
        continue;
      }
      const name = readString(metric as Record<string, unknown>, "name");
      const values = (metric as Record<string, unknown>).values;
      const first =
        Array.isArray(values) &&
        typeof values[0] === "object" &&
        values[0] !== null
          ? (values[0] as Record<string, unknown>)
          : null;
      const raw = first?.value;
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        continue;
      }
      const entries = Object.entries(raw as Record<string, unknown>)
        .map(([key, value]) => {
          const n =
            typeof value === "number"
              ? value
              : typeof value === "string"
                ? Number(value)
                : NaN;
          if (!Number.isFinite(n) || n < 0) return null;
          return { key, value: Math.trunc(n) };
        })
        .filter((row): row is { key: string; value: number } => row != null);
      if (entries.length === 0) continue;
      if (name === "page_fans_gender_age") genderAge = entries;
      if (name === "page_fans_city") city = entries;
    }

    if (!genderAge && !city) {
      return {
        status: "empty",
        genderAge: null,
        city: null,
      };
    }
    return { status: "received", genderAge, city };
  } catch (error) {
    if (error instanceof MetaInsightError) {
      if (error.category === "privacy_threshold") {
        return {
          status: "privacy_threshold",
          genderAge: null,
          city: null,
        };
      }
      if (error.category === "permission_required") {
        return {
          status: "permission_denied",
          genderAge: null,
          city: null,
        };
      }
    }
    return { status: "unavailable", genderAge: null, city: null };
  }
}
