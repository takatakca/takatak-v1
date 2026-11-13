import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { credentialToken, providerJson } from "@/lib/social/providers/youtube-community-analytics";

const DATA_HOST = "https://www.googleapis.com";
const REPORTS_URL = "https://youtubeanalytics.googleapis.com/v2/reports";
const VIDEO_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const METRIC_NAMES = ["views", "likes", "dislikes", "comments", "shares"] as const;
type MetricName = (typeof METRIC_NAMES)[number];
export type YoutubeVideoMetrics = Record<MetricName, number | null>;
export type YoutubeVideoDay = { day: string; metrics: YoutubeVideoMetrics };
export type YoutubeVideoRow = {
  id: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string | null;
  metrics: YoutubeVideoMetrics;
};
export type YoutubeVideoSection = {
  totals: YoutubeVideoMetrics;
  daily: YoutubeVideoDay[];
  videos: YoutubeVideoRow[];
  limited: boolean;
  count: number;
  periodAvailable: boolean;
};
export type YoutubeVideoPerformance = {
  range: { start: string; end: string };
  published: YoutubeVideoSection;
  viewed: YoutubeVideoSection;
  retrievedAt: string;
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function number(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function emptyMetrics(): YoutubeVideoMetrics {
  return { views: null, likes: null, dislikes: null, comments: null, shares: null };
}
function values(raw: unknown): YoutubeVideoMetrics {
  if (!Array.isArray(raw)) return emptyMetrics();
  return {
    views: number(raw[0]),
    likes: number(raw[1]),
    dislikes: number(raw[2]),
    comments: number(raw[3]),
    shares: number(raw[4]),
  };
}
function mergeMetrics(a: YoutubeVideoMetrics, b: YoutubeVideoMetrics): YoutubeVideoMetrics {
  const result = emptyMetrics();
  for (const key of METRIC_NAMES) {
    result[key] = a[key] === null && b[key] === null ? null : (a[key] ?? 0) + (b[key] ?? 0);
  }
  return result;
}
function sumMetrics(rows: YoutubeVideoMetrics[]): YoutubeVideoMetrics {
  return rows.reduce((current, next) => mergeMetrics(current, next), emptyMetrics());
}
function auth(token: string): RequestInit {
  return { headers: { Authorization: "Bearer " + token } };
}
async function analytics(options: {
  token: string;
  channelId: string;
  start: string;
  end: string;
  dimensions: "day" | "video";
  filterIds?: string[];
}): Promise<Map<string, YoutubeVideoMetrics>> {
  if (options.filterIds?.length === 0) return new Map();
  const url = new URL(REPORTS_URL);
  url.searchParams.set("ids", "channel==" + options.channelId);
  url.searchParams.set("startDate", options.start);
  url.searchParams.set("endDate", options.end);
  url.searchParams.set("dimensions", options.dimensions);
  url.searchParams.set("metrics", METRIC_NAMES.join(","));
  url.searchParams.set("sort", options.dimensions === "video" ? "-views" : "day");
  if (options.dimensions === "video") url.searchParams.set("maxResults", "200");
  if (options.filterIds?.length) url.searchParams.set("filters", "video==" + options.filterIds.join(","));
  const body = await providerJson(url, auth(options.token));
  const result = new Map<string, YoutubeVideoMetrics>();
  if (!Array.isArray(body.rows)) return result;
  for (const row of body.rows) {
    if (!Array.isArray(row) || typeof row[0] !== "string") continue;
    const id = row[0];
    if (options.dimensions === "video" && !VIDEO_PATTERN.test(id)) continue;
    if (options.dimensions === "day" && !/^\d{4}-\d{2}-\d{2}$/.test(id)) continue;
    result.set(id, values(row.slice(1)));
  }
  return result;
}

function expandDays(start: string, end: string, results: Map<string, YoutubeVideoMetrics>): YoutubeVideoDay[] {
  const days: YoutubeVideoDay[] = [];
  const cursor = new Date(start + "T00:00:00Z");
  const last = Date.parse(end + "T00:00:00Z");
  while (cursor.getTime() <= last && days.length < 365) {
    const key = cursor.toISOString().slice(0, 10);
    days.push({ day: key, metrics: results.get(key) ?? emptyMetrics() });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function uploadedVideoIds(options: {
  token: string; channelId: string; start: string; end: string;
}): Promise<{ ids: string[]; limited: boolean }> {
  const url = new URL(DATA_HOST + "/youtube/v3/channels");
  url.searchParams.set("part", "contentDetails");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "50");
  const details = await providerJson(url, auth(options.token));
  const channels = Array.isArray(details.items) ? details.items : [];
  const selected = channels.map(asObject).find((channel) => channel?.id === options.channelId);
  const playlists = asObject(asObject(selected?.contentDetails)?.relatedPlaylists);
  const playlist = playlists?.uploads;
  if (typeof playlist !== "string" || !playlist) {
    throw new ServiceError("unavailable", "YouTube uploads playlist is unavailable for this channel.", { status: 502 });
  }
  const all: string[] = [];
  let pageToken: string | null = null;
  let more = false;
  for (let page = 0; page < 4; page++) {
    const request = new URL(DATA_HOST + "/youtube/v3/playlistItems");
    request.searchParams.set("part", "contentDetails");
    request.searchParams.set("playlistId", playlist);
    request.searchParams.set("maxResults", "50");
    if (pageToken) request.searchParams.set("pageToken", pageToken);
    const body = await providerJson(request, auth(options.token));
    const items = Array.isArray(body.items) ? body.items : [];
    for (const item of items) {
      const detail = asObject(asObject(item)?.contentDetails);
      const id = detail?.videoId;
      if (typeof id === "string" && VIDEO_PATTERN.test(id) && !all.includes(id)) all.push(id);
    }
    pageToken = typeof body.nextPageToken === "string" ? body.nextPageToken : null;
    if (!pageToken) break;
  }
  more = pageToken !== null;
  return { ids: all, limited: more };
}
type VideoDetail = { id: string; title: string; publishedAt: string; thumbnailUrl: string | null };
async function videoMetadata(options: { token: string; channelId: string; ids: string[] }): Promise<Map<string, VideoDetail>> {
  const result = new Map<string, VideoDetail>();
  const validIds = [...new Set(options.ids)].filter((id) => VIDEO_PATTERN.test(id));
  for (let start = 0; start < validIds.length; start += 50) {
    const url = new URL(DATA_HOST + "/youtube/v3/videos");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("id", validIds.slice(start, start + 50).join(","));
    url.searchParams.set("maxResults", "50");
    const response = await providerJson(url, auth(options.token));
    const videos = Array.isArray(response.items) ? response.items : [];
    for (const candidate of videos) {
      const row = asObject(candidate);
      const snippet = asObject(row?.snippet);
      const id = row?.id;
      if (typeof id !== "string" || !VIDEO_PATTERN.test(id) || snippet?.channelId !== options.channelId) continue;
      const title = typeof snippet.title === "string" ? snippet.title : "Untitled video";
      const publishedAt = typeof snippet.publishedAt === "string" && !Number.isNaN(Date.parse(snippet.publishedAt)) ? snippet.publishedAt : "";
      const thumbnails = asObject(snippet.thumbnails);
      const thumbnail = asObject(thumbnails?.medium) ?? asObject(thumbnails?.default);
      const originalUrl = thumbnail?.url;
      const thumbnailUrl = typeof originalUrl === "string" && /^https:\/\/i\.ytimg\.com\//.test(originalUrl) ? originalUrl : null;
      result.set(id, { id, title, publishedAt, thumbnailUrl });
    }
  }
  return result;
}
function videoList(ids: string[], metadata: Map<string, VideoDetail>, metrics: Map<string, YoutubeVideoMetrics>): YoutubeVideoRow[] {
  return ids.flatMap((id) => {
    const details = metadata.get(id);
    if (!details) return [];
    return [{ ...details, metrics: metrics.get(id) ?? emptyMetrics() }];
  });
}

/** Two different populations: uploads within period vs videos viewed in period.
 * Video rows are bounded to YouTube's documented top-200 analytics limit.
 * No user-supplied channel IDs or arbitrary external videos are accepted.
 */
export async function getYoutubeVideoPerformance(options: {
  clientId: string;
  brandId: string;
  connectionId: string;
  socialAccountId: string;
  range: { start: string; end: string };
}): Promise<YoutubeVideoPerformance> {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "YouTube analytics database unavailable.", { status: 503 });
  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId, clientId: options.clientId,
      businessBrandId: options.brandId, providerConnectionId: options.connectionId,
      platform: "youtube", status: "connected", accessStatus: "selected",
    },
    select: { externalAccountId: true },
  });
  const channelId = account?.externalAccountId;
  if (!channelId || !/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) {
    throw new ServiceError("not_found", "The selected YouTube channel was not found.", { status: 404 });
  }
  const { token } = await credentialToken(options.clientId, options.connectionId);
  const query = { token, channelId, start: options.range.start, end: options.range.end };
  const [viewedByDay, viewedByVideo, uploads] = await Promise.all([
    analytics({ ...query, dimensions: "day" }),
    analytics({ ...query, dimensions: "video" }),
    uploadedVideoIds(query),
  ]);
  const meta = await videoMetadata({ token, channelId, ids: [...uploads.ids, ...viewedByVideo.keys()] });
  const startTime = Date.parse(options.range.start + "T00:00:00.000Z");
  const endTime = Date.parse(options.range.end + "T23:59:59.999Z");
  const publishedIds = uploads.ids.filter((id) => {
    const time = Date.parse(meta.get(id)?.publishedAt ?? "");
    return Number.isFinite(time) && time >= startTime && time <= endTime;
  });
  const publishedRows = publishedIds.length
    ? await analytics({ ...query, dimensions: "video", filterIds: publishedIds })
    : new Map<string, YoutubeVideoMetrics>();
  const publishedDaily = new Map<string, YoutubeVideoMetrics>();
  // Query daily engagement on only videos uploaded in the selected period.
  // Split into bounded batches to avoid large video-ID filters.
  for (let i = 0; i < publishedIds.length; i += 50) {
    const report = await analytics({ ...query, dimensions: "day", filterIds: publishedIds.slice(i, i + 50) });
    for (const [day, row] of report) publishedDaily.set(day, mergeMetrics(publishedDaily.get(day) ?? emptyMetrics(), row));
  }
  const published = expandDays(options.range.start, options.range.end, publishedDaily);
  const viewed = expandDays(options.range.start, options.range.end, viewedByDay);
  return {
    range: options.range,
    published: {
      videos: videoList(publishedIds, meta, publishedRows),
      daily: published,
      totals: sumMetrics(published.map((point) => point.metrics)),
      count: publishedIds.length,
      limited: uploads.limited,
      periodAvailable: publishedIds.length > 0 && publishedDaily.size > 0,
    },
    viewed: {
      videos: videoList([...viewedByVideo.keys()], meta, viewedByVideo),
      daily: viewed,
      totals: sumMetrics(viewed.map((point) => point.metrics)),
      count: viewedByVideo.size,
      limited: viewedByVideo.size >= 200,
      periodAvailable: viewedByDay.size > 0,
    },
    retrievedAt: new Date().toISOString(),
  };
}
