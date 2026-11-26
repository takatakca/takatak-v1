// Real Instagram numbers for the network dashboard: types, the parsers for the
// Instagram Graph API answers and the period sums. Pure functions (no network,
// no database) so they are tested on their own. A number Instagram did not
// give stays null; nothing is estimated.

export type InstagramMediaKind = "post" | "reel";

export interface InstagramLiveMedia {
  id: string;
  caption: string;
  /** IMAGE, VIDEO or CAROUSEL_ALBUM, as Instagram names it. */
  mediaType: string;
  kind: InstagramMediaKind;
  publishedAt: string;
  permalink: string | null;
  likes: number | null;
  comments: number | null;
  views: number | null;
  reach: number | null;
  saved: number | null;
  shares: number | null;
}

export interface InstagramDailyPoint {
  date: string;
  value: number;
}

/** Account insights for the last days Instagram keeps per request (30 at most). */
export interface InstagramLiveAccount {
  since: string;
  until: string;
  reachSeries: InstagramDailyPoint[];
  newFollowersSeries: InstagramDailyPoint[];
  views: number | null;
  accountsEngaged: number | null;
  totalInteractions: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  profileLinksTaps: number | null;
  follows: number | null;
  unfollows: number | null;
}

export interface InstagramLiveStats {
  fetchedAt: string;
  username: string | null;
  followers: number | null;
  following: number | null;
  mediaCount: number | null;
  media: InstagramLiveMedia[];
  account: InstagramLiveAccount | null;
  /** Parts Instagram did not answer (permission, limit, outage), for an honest note. */
  missing: string[];
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const asNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const asText = (value: unknown, max = 2200): string =>
  typeof value === "string" ? value.slice(0, max) : "";

/** YYYY-MM-DD in UTC. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Reads one media insight value, whichever shape Instagram used. */
function insightValue(insights: unknown, metric: string): number | null {
  const rows = asRecord(insights).data;
  if (!Array.isArray(rows)) return null;
  for (const row of rows) {
    const item = asRecord(row);
    if (item.name !== metric) continue;
    const total = asNumber(asRecord(item.total_value).value);
    if (total !== null) return total;
    const values = item.values;
    if (Array.isArray(values) && values.length) return asNumber(asRecord(values[0]).value);
  }
  return null;
}

/** Parses one page of GET /{ig-user-id}/media (fields may carry insights.metric(...)). */
export function parseInstagramMedia(body: unknown): InstagramLiveMedia[] {
  const rows = asRecord(body).data;
  if (!Array.isArray(rows)) return [];
  const out: InstagramLiveMedia[] = [];
  for (const row of rows) {
    const item = asRecord(row);
    const id = typeof item.id === "string" ? item.id : "";
    const publishedAt = typeof item.timestamp === "string" ? item.timestamp : "";
    if (!id || !publishedAt || Number.isNaN(Date.parse(publishedAt))) continue;
    const product = typeof item.media_product_type === "string" ? item.media_product_type : "";
    // Stories expire after 24 hours and are not in the media list; skip any that slip in.
    if (product === "STORY") continue;
    const mediaType = typeof item.media_type === "string" ? item.media_type : "IMAGE";
    out.push({
      id,
      caption: asText(item.caption),
      mediaType,
      kind: product === "REELS" ? "reel" : "post",
      publishedAt: new Date(publishedAt).toISOString(),
      permalink: typeof item.permalink === "string" && item.permalink.startsWith("https://") ? item.permalink : null,
      likes: asNumber(item.like_count),
      comments: asNumber(item.comments_count),
      views: insightValue(item.insights, "views"),
      reach: insightValue(item.insights, "reach"),
      saved: insightValue(item.insights, "saved"),
      shares: insightValue(item.insights, "shares"),
    });
  }
  return out;
}

/** Parses a time series answer of GET /{ig-user-id}/insights (period=day). */
export function parseInsightSeries(body: unknown, metric: string): InstagramDailyPoint[] {
  const rows = asRecord(body).data;
  if (!Array.isArray(rows)) return [];
  const row = rows.map(asRecord).find((item) => item.name === metric);
  const values = row?.values;
  if (!Array.isArray(values)) return [];
  const points: InstagramDailyPoint[] = [];
  for (const raw of values) {
    const point = asRecord(raw);
    const value = asNumber(point.value);
    const end = typeof point.end_time === "string" ? Date.parse(point.end_time) : Number.NaN;
    if (value === null || Number.isNaN(end)) continue;
    // Instagram stamps a day with the end of that day (next midnight, Pacific time).
    points.push({ date: dayKey(new Date(end - 12 * 60 * 60 * 1000)), value });
  }
  return points;
}

/** Parses a metric_type=total_value answer into { metric: total }. */
export function parseInsightTotals(body: unknown): Record<string, number> {
  const rows = asRecord(body).data;
  const out: Record<string, number> = {};
  if (!Array.isArray(rows)) return out;
  for (const raw of rows) {
    const item = asRecord(raw);
    const value = asNumber(asRecord(item.total_value).value);
    if (typeof item.name === "string" && value !== null) out[item.name] = value;
  }
  return out;
}

/** Parses a total_value answer broken down by one dimension into { dimension: value }. */
export function parseInsightBreakdown(body: unknown, metric: string): Record<string, number> {
  const rows = asRecord(body).data;
  const out: Record<string, number> = {};
  if (!Array.isArray(rows)) return out;
  const row = rows.map(asRecord).find((item) => item.name === metric);
  const breakdowns = asRecord(row?.total_value).breakdowns;
  if (!Array.isArray(breakdowns) || !breakdowns.length) return out;
  const results = asRecord(breakdowns[0]).results;
  if (!Array.isArray(results)) return out;
  for (const raw of results) {
    const result = asRecord(raw);
    const key = Array.isArray(result.dimension_values) ? result.dimension_values.join(" / ") : "";
    const value = asNumber(result.value);
    if (key && value !== null) out[key] = value;
  }
  return out;
}

/** Media published from start to end (YYYY-MM-DD, inclusive), optionally of one kind. */
export function mediaInRange(media: InstagramLiveMedia[], start: string, end: string, kind?: InstagramMediaKind): InstagramLiveMedia[] {
  return media.filter((item) => {
    const day = item.publishedAt.slice(0, 10);
    return day >= start && day <= end && (!kind || item.kind === kind);
  });
}

/** Sum of the values Instagram gave; null when it gave none. */
function sumKnown(items: InstagramLiveMedia[], key: "likes" | "comments" | "views" | "reach" | "saved" | "shares"): number | null {
  let total = 0;
  let known = false;
  for (const item of items) {
    const value = item[key];
    if (value === null) continue;
    total += value;
    known = true;
  }
  return known ? total : null;
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

export interface InstagramMediaSummary {
  count: number;
  likes: number | null;
  comments: number | null;
  saved: number | null;
  shares: number | null;
  views: number | null;
  interactions: number | null;
  averageReach: number | null;
  /** Interactions divided by reach, in percent. */
  engagementRate: number | null;
  dailyLikes: number | null;
  likesPerPost: number | null;
  dailyComments: number | null;
  commentsPerPost: number | null;
  likesPerComment: number | null;
}

export function summarizeMedia(items: InstagramLiveMedia[], days: number): InstagramMediaSummary {
  const count = items.length;
  const likes = sumKnown(items, "likes");
  const comments = sumKnown(items, "comments");
  const saved = sumKnown(items, "saved");
  const shares = sumKnown(items, "shares");
  const views = sumKnown(items, "views");
  const reach = sumKnown(items, "reach");
  const parts = [likes, comments, saved, shares].filter((value): value is number => value !== null);
  const interactions = parts.length ? parts.reduce((total, value) => total + value, 0) : count === 0 ? 0 : null;
  const reachCount = items.filter((item) => item.reach !== null).length;
  const span = Math.max(1, days);
  return {
    count,
    likes: likes ?? (count === 0 ? 0 : null),
    comments: comments ?? (count === 0 ? 0 : null),
    saved: saved ?? (count === 0 ? 0 : null),
    shares: shares ?? (count === 0 ? 0 : null),
    views: views ?? (count === 0 ? 0 : null),
    interactions,
    averageReach: reach !== null && reachCount ? Math.round(reach / reachCount) : null,
    engagementRate: reach && interactions !== null ? round((interactions / reach) * 100, 2) : null,
    dailyLikes: likes !== null ? round(likes / span, 1) : count === 0 ? 0 : null,
    likesPerPost: likes !== null && count ? round(likes / count, 1) : null,
    dailyComments: comments !== null ? round(comments / span, 1) : count === 0 ? 0 : null,
    commentsPerPost: comments !== null && count ? round(comments / count, 1) : null,
    likesPerComment: likes !== null && comments ? round(likes / comments, 1) : null,
  };
}

/** Every day from start to end (YYYY-MM-DD, inclusive). */
export function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last && out.length < 400) {
    out.push(dayKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Interactions of the media published each day (0 on days without a post). */
export function dailyInteractions(items: InstagramLiveMedia[], start: string, end: string): InstagramDailyPoint[] {
  const byDay = new Map<string, number>();
  for (const item of items) {
    const day = item.publishedAt.slice(0, 10);
    const value = (item.likes ?? 0) + (item.comments ?? 0) + (item.saved ?? 0) + (item.shares ?? 0);
    byDay.set(day, (byDay.get(day) ?? 0) + value);
  }
  return enumerateDays(start, end).map((date) => ({ date, value: byDay.get(date) ?? 0 }));
}

/** Count and views per media type (photo, video, carousel). */
export function mediaTypeBreakdown(items: InstagramLiveMedia[]): Array<{ type: string; count: number; views: number }> {
  const map = new Map<string, { count: number; views: number }>();
  for (const item of items) {
    const entry = map.get(item.mediaType) ?? { count: 0, views: 0 };
    entry.count += 1;
    entry.views += item.views ?? 0;
    map.set(item.mediaType, entry);
  }
  return [...map.entries()].map(([type, entry]) => ({ type, ...entry })).sort((a, b) => b.count - a.count);
}

/** Hashtags used in the captions, with the posts and interactions they appear in. */
export function hashtagsFromMedia(items: InstagramLiveMedia[]): Array<{ tag: string; posts: number; interactions: number }> {
  const map = new Map<string, { posts: number; interactions: number }>();
  for (const item of items) {
    const tags = new Set((item.caption.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => tag.toLowerCase()));
    const interactions = (item.likes ?? 0) + (item.comments ?? 0) + (item.saved ?? 0) + (item.shares ?? 0);
    for (const tag of tags) {
      const entry = map.get(tag) ?? { posts: 0, interactions: 0 };
      entry.posts += 1;
      entry.interactions += interactions;
      map.set(tag, entry);
    }
  }
  return [...map.entries()]
    .map(([tag, entry]) => ({ tag, ...entry }))
    .sort((a, b) => b.posts - a.posts || b.interactions - a.interactions || a.tag.localeCompare(b.tag));
}

/** Community numbers for the period, in the shape the dashboard cards read. */
export function communityFromLive(stats: InstagramLiveStats, start: string, end: string) {
  const days = enumerateDays(start, end).length;
  const inRange = mediaInRange(stats.media, start, end);
  const series = (stats.account?.newFollowersSeries ?? []).filter((point) => point.date >= start && point.date <= end);
  // Instagram keeps new-follower days for 30 days: the sum is shown only when it covers the period.
  const covered = days <= 30 && series.length > 0;
  const acquired = covered ? series.reduce((total, point) => total + point.value, 0) : null;
  const lost = covered && stats.account?.unfollows !== null && stats.account?.unfollows !== undefined ? stats.account.unfollows : null;
  return {
    followers: stats.followers,
    following: stats.following,
    totalContent: stats.mediaCount,
    dailyFollowers: acquired !== null ? round(acquired / Math.max(1, days), 1) : null,
    followersPerPost: acquired !== null && inRange.length ? round(acquired / inRange.length, 1) : null,
    dailyPosts: round(inRange.length / Math.max(1, days), 2),
    postsPerWeek: round((inRange.length / Math.max(1, days)) * 7, 1),
    acquired,
    lost,
    followersSeries: stats.followers !== null ? [{ date: end, value: stats.followers }] : undefined,
    acquiredSeries: series.length ? series : undefined,
  };
}

/** One CSV cell, quoted when needed and protected from spreadsheet formulas. */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return String(value);
  let text = value;
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  return [header.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\n") + "\n";
}
