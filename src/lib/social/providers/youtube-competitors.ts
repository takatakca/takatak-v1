import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { credentialToken, providerJson } from "@/lib/social/providers/youtube-community-analytics";

const API = "https://www.googleapis.com/youtube/v3";
const CHANNEL = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO = /^[A-Za-z0-9_-]{11}$/;
const MAX_TRACKS = 100;
const VIDEO_SAMPLE_CHANNELS = 5;
const VIDEO_SAMPLE_SIZE = 20;

type Rec = Record<string, unknown>;
function obj(value: unknown): Rec | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Rec : null;
}
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function num(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function photo(value: unknown): string | null {
  const src = str(value);
  if (!src) return null;
  try {
    const u = new URL(src);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && ["yt3.ggpht.com", "yt3.googleusercontent.com"].includes(host)
      ? u.toString() : null;
  } catch { return null; }
}
function fingerprint(channelId: string): string {
  return createHash("sha256").update("youtube:competitor:" + channelId).digest("hex");
}
function urlFor(id: string): string {
  return "https://www.youtube.com/channel/" + id;
}

/** Strictly parse an ID or official YouTube handle; never fetch user-provided URLs. */
export function parseYoutubeCompetitorInput(input: string): { type: "id" | "handle"; value: string } {
  let raw = input.trim();
  if (raw.length > 220) throw new ServiceError("invalid_input", "Enter a YouTube channel URL or @handle.", { status: 400 });
  if (raw.startsWith("https://")) {
    let url: URL;
    try { url = new URL(raw); }
    catch { throw new ServiceError("invalid_input", "Enter a valid YouTube channel URL.", { status: 400 }); }
    if (!["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname.toLowerCase()) || url.port || url.username || url.password) {
      throw new ServiceError("invalid_input", "Use a YouTube channel URL, ID or @handle.", { status: 400 });
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length === 1 && parts[0].startsWith("@")) raw = parts[0];
    else if (parts.length === 2 && parts[0] === "channel") raw = parts[1];
    else throw new ServiceError("invalid_input", "Use a channel URL such as youtube.com/@channel.", { status: 400 });
  }
  if (CHANNEL.test(raw)) return { type: "id", value: raw };
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(raw)) return { type: "handle", value: raw };
  throw new ServiceError("invalid_input", "Enter a YouTube channel ID or @handle.", { status: 400 });
}

type PublicChannel = {
  id: string;
  name: string;
  image: string | null;
  handle: string | null;
  subscribers: number | null;
  views: number | null;
  videos: number | null;
  uploads: string | null;
};
function readPublicChannel(value: unknown): PublicChannel | null {
  const item = obj(value);
  const id = str(item?.id);
  if (!id || !CHANNEL.test(id)) return null;
  const snippet = obj(item?.snippet);
  const statistics = obj(item?.statistics);
  const thumbnails = obj(snippet?.thumbnails);
  const icon = obj(thumbnails?.default);
  const related = obj(obj(item?.contentDetails)?.relatedPlaylists);
  return {
    id,
    name: str(snippet?.title) ?? "YouTube channel",
    image: photo(icon?.url),
    handle: str(snippet?.customUrl),
    subscribers: statistics?.hiddenSubscriberCount === true ? null : num(statistics?.subscriberCount),
    views: num(statistics?.viewCount),
    videos: num(statistics?.videoCount),
    uploads: str(related?.uploads),
  };
}
async function channelsByIds(token: string, ids: string[]): Promise<Map<string, PublicChannel>> {
  const result = new Map<string, PublicChannel>();
  for (let i = 0; i < ids.length; i += 50) {
    const url = new URL(API + "/channels");
    url.searchParams.set("part", "snippet,statistics,contentDetails");
    url.searchParams.set("id", ids.slice(i, i + 50).join(","));
    url.searchParams.set("maxResults", "50");
    const response = await providerJson(url, { headers: { Authorization: "Bearer " + token } });
    for (const entry of Array.isArray(response.items) ? response.items : []) {
      const channel = readPublicChannel(entry);
      if (channel) result.set(channel.id, channel);
    }
  }
  return result;
}

export type YoutubeCompetitorVideo = {
  title: string;
  url: string;
  publishedAt: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  channelName: string;
  ref: string;
};
export type YoutubeCompetitorRow = {
  ref: string;
  name: string;
  imageUrl: string | null;
  url: string;
  starred: boolean;
  subscribers: number | null;
  views: number | null;
  videos: number | null;
  likes: number | null;
  dislikes: null;
  averageComments: number | null;
  sampleCount: number;
  recentVideos: YoutubeCompetitorVideo[];
};
export type YoutubeCompetitorsReport = {
  competitors: YoutubeCompetitorRow[];
  sampledChannels: number;
  retrievedAt: string;
  limit: number;
};

async function recentVideoSample(options: {
  token: string;
  channel: PublicChannel;
  ref: string;
  start: string;
  end: string;
}): Promise<{ likes: number | null; averageComments: number | null; videos: YoutubeCompetitorVideo[] }> {
  if (!options.channel.uploads) return { likes: null, averageComments: null, videos: [] };
  const list = new URL(API + "/playlistItems");
  list.searchParams.set("part", "contentDetails");
  list.searchParams.set("maxResults", String(VIDEO_SAMPLE_SIZE));
  list.searchParams.set("playlistId", options.channel.uploads);
  const listing = await providerJson(list, { headers: { Authorization: "Bearer " + options.token } });
  const ids = (Array.isArray(listing.items) ? listing.items : [])
    .map((entry) => str(obj(obj(entry)?.contentDetails)?.videoId))
    .filter((id): id is string => !!id && VIDEO.test(id));
  if (!ids.length) return { likes: null, averageComments: null, videos: [] };
  const url = new URL(API + "/videos");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("id", [...new Set(ids)].join(","));
  url.searchParams.set("maxResults", String(VIDEO_SAMPLE_SIZE));
  const body = await providerJson(url, { headers: { Authorization: "Bearer " + options.token } });
  const selected: YoutubeCompetitorVideo[] = [];
  for (const entry of Array.isArray(body.items) ? body.items : []) {
    const video = obj(entry);
    const snippet = obj(video?.snippet);
    const stats = obj(video?.statistics);
    const id = str(video?.id);
    const publishedAt = str(snippet?.publishedAt);
    if (!id || !VIDEO.test(id) || snippet?.channelId !== options.channel.id || !publishedAt) continue;
    const day = publishedAt.slice(0, 10);
    if (day < options.start || day > options.end) continue;
    selected.push({
      title: str(snippet?.title) ?? "Untitled video",
      url: "https://www.youtube.com/watch?v=" + id,
      publishedAt,
      views: num(stats?.viewCount),
      likes: num(stats?.likeCount),
      comments: num(stats?.commentCount),
      channelName: options.channel.name,
      ref: options.ref,
    });
  }
  const knownLikes = selected.map((item) => item.likes).filter((x): x is number => x !== null);
  const knownComments = selected.map((item) => item.comments).filter((x): x is number => x !== null);
  return {
    likes: selected.length && knownLikes.length === selected.length
      ? knownLikes.reduce((a, b) => a + b, 0) : null,
    averageComments: selected.length && knownComments.length === selected.length
      ? knownComments.reduce((a, b) => a + b, 0) / selected.length : null,
    videos: selected,
  };
}

export async function listYoutubeCompetitors(input: {
  clientId: string;
  brandId: string;
  connectionId: string;
  start: string;
  end: string;
  allowance: number;
}): Promise<YoutubeCompetitorsReport> {
  const db = getPrisma();
  if (!db) throw new ServiceError("unavailable", "Competitor database is unavailable.", { status: 503 });
  const records = await db.socialCompetitorTrack.findMany({
    where: { clientId: input.clientId, businessBrandId: input.brandId, platform: "youtube", status: "active" },
    orderBy: { createdAt: "asc" },
    take: MAX_TRACKS,
    select: { publicRef: true, externalPageId: true, pageName: true, profileImageUrl: true, metadata: true },
  });
  const noSample: YoutubeCompetitorsReport = { competitors: [], sampledChannels: 0, retrievedAt: new Date().toISOString(), limit: input.allowance };
  if (!records.length) return noSample;
  const { token } = await credentialToken(input.clientId, input.connectionId);
  const lookup = await channelsByIds(token, records.map((track) => track.externalPageId).filter((id) => CHANNEL.test(id)));
  const competitors: YoutubeCompetitorRow[] = records.map((track) => {
    const publicChannel = lookup.get(track.externalPageId);
    const metadata = obj(track.metadata);
    return {
      ref: track.publicRef,
      name: publicChannel?.name ?? track.pageName ?? "YouTube channel",
      imageUrl: publicChannel?.image ?? photo(track.profileImageUrl),
      url: urlFor(track.externalPageId),
      starred: metadata?.starred === true,
      subscribers: publicChannel?.subscribers ?? null,
      views: publicChannel?.views ?? null,
      videos: publicChannel?.videos ?? null,
      likes: null,
      dislikes: null,
      averageComments: null,
      sampleCount: 0,
      recentVideos: [],
    };
  });
  const sample = competitors.slice(0, VIDEO_SAMPLE_CHANNELS);
  // Read at most 5 recent public-video samples per request. The other rows
  // intentionally show "unavailable" instead of pretending partial totals.
  await Promise.all(sample.map(async (row) => {
    const record = records.find((track) => track.publicRef === row.ref);
    const channel = record && lookup.get(record.externalPageId);
    if (!channel) return;
    try {
      const activity = await recentVideoSample({
        token, channel, ref: row.ref, start: input.start, end: input.end,
      });
      row.likes = activity.likes;
      row.averageComments = activity.averageComments;
      row.sampleCount = activity.videos.length;
      row.recentVideos = activity.videos;
    } catch {
      // An optional public sample can fail without concealing known channel stats.
    }
  }));
  return { competitors, sampledChannels: sample.length, retrievedAt: new Date().toISOString(), limit: input.allowance };
}

export async function addYoutubeCompetitor(input: {
  clientId: string;
  brandId: string;
  connectionId: string;
  ownerAccountId: string;
  source: string;
  allowance: number;
}): Promise<void> {
  const db = getPrisma();
  if (!db) throw new ServiceError("unavailable", "Competitor database is unavailable.", { status: 503 });
  const parsed = parseYoutubeCompetitorInput(input.source);
  const active = await db.socialCompetitorTrack.count({
    where: { clientId: input.clientId, businessBrandId: input.brandId, platform: "youtube", status: "active" },
  });
  if (active >= Math.min(MAX_TRACKS, input.allowance)) {
    throw new ServiceError("forbidden", "Your Social plan's competitor allowance has been reached.", { status: 403 });
  }
  const { token } = await credentialToken(input.clientId, input.connectionId);
  const url = new URL(API + "/channels");
  url.searchParams.set("part", "snippet,statistics,contentDetails");
  url.searchParams.set(parsed.type === "id" ? "id" : "forHandle", parsed.value);
  const body = await providerJson(url, { headers: { Authorization: "Bearer " + token } });
  const channel = Array.isArray(body.items) ? readPublicChannel(body.items[0]) : null;
  if (!channel) throw new ServiceError("not_found", "YouTube could not find that channel.", { status: 404 });
  if (channel.id === input.ownerAccountId) {
    throw new ServiceError("invalid_input", "Your connected channel is not a competitor. Choose another channel.", { status: 400 });
  }
  const existing = await db.socialCompetitorTrack.findFirst({
    where: { clientId: input.clientId, businessBrandId: input.brandId, externalPageIdHash: fingerprint(channel.id) },
    select: { id: true, status: true, platform: true },
  });
  if (existing?.status === "active") {
    throw new ServiceError("conflict", "That channel is already in your competitor list.", { status: 409 });
  }
  const update = {
    platform: "youtube",
    pageName: channel.name,
    usernameCanonical: channel.handle,
    externalPageId: channel.id,
    externalPageIdHash: fingerprint(channel.id),
    profileImageUrl: channel.image,
    availability: "available",
    capabilityStatus: "ready",
    status: "active",
    lastSuccessAt: new Date(),
  };
  if (existing) {
    if (existing.platform !== "youtube") {
      throw new ServiceError("conflict", "A different provider already uses this competitor identity.", { status: 409 });
    }
    await db.socialCompetitorTrack.update({ where: { id: existing.id }, data: update });
  } else {
    await db.socialCompetitorTrack.create({
      data: {
        ...update,
        clientId: input.clientId,
        businessBrandId: input.brandId,
        publicRef: "ytc_" + randomBytes(12).toString("hex"),
      },
    });
  }
}

export async function removeYoutubeCompetitor(input: { clientId: string; brandId: string; ref: string }): Promise<void> {
  const db = getPrisma();
  if (!db) throw new ServiceError("unavailable", "Competitor database is unavailable.", { status: 503 });
  const updated = await db.socialCompetitorTrack.updateMany({
    where: { clientId: input.clientId, businessBrandId: input.brandId, platform: "youtube", publicRef: input.ref, status: "active" },
    data: { status: "removed" },
  });
  if (!updated.count) throw new ServiceError("not_found", "That competitor could not be found.", { status: 404 });
}

export async function starYoutubeCompetitor(input: {
  clientId: string;
  brandId: string;
  ref: string;
  starred: boolean;
}): Promise<void> {
  const db = getPrisma();
  if (!db) throw new ServiceError("unavailable", "Competitor database is unavailable.", { status: 503 });
  const track = await db.socialCompetitorTrack.findFirst({
    where: { clientId: input.clientId, businessBrandId: input.brandId, platform: "youtube", publicRef: input.ref, status: "active" },
    select: { id: true, metadata: true },
  });
  if (!track) throw new ServiceError("not_found", "That competitor could not be found.", { status: 404 });
  const metadata = obj(track.metadata) ?? {};
  await db.socialCompetitorTrack.update({ where: { id: track.id }, data: { metadata: { ...metadata, starred: input.starred } } });
}
