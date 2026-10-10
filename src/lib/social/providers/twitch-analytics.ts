import "server-only";

import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { getTwitchClientId } from "@/lib/social/providers/twitch-oauth";
import { refreshTwitchAccessToken } from "@/lib/social/providers/twitch-token";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  encryptSocialTokenPayload,
  type SocialTokenPayload,
} from "@/lib/social/security/social-crypto";

const HELIX_HOST = "https://api.twitch.tv";
const MAX_VIDEO_PAGES = 5;
const MAX_SUBSCRIPTION_PAGES = 5;
const SNAPSHOT_KIND = "twitch_community_balance";
const LIVE_STATUSES = ["connected", "authorized", "reauthorization_required"] as const;

export type TwitchCommunityPoint = {
  date: string;
  followers: number | null;
  subscribers: number | null;
  videos: number | null;
  views: number | null;
  durationSeconds: number | null;
};

export type TwitchMediaRow = {
  title: string;
  publishedOn: string;
  views: number;
  durationSeconds: number;
  url: string | null;
};

export type TwitchSubscriberRow = {
  name: string;
  label: string;
};

export type TwitchCommunityAnalytics = {
  account: {
    name: string;
    handle: string | null;
    avatarUrl: string | null;
  };
  followers: number | null;
  subscribers: number | null;
  videos: number | null;
  videosConfirmed: boolean;
  streamViews: number | null;
  streamDurationSeconds: number | null;
  videoList: TwitchMediaRow[];
  clipList: TwitchMediaRow[];
  clipsConfirmed: boolean;
  points: TwitchCommunityPoint[];
  subscriptionTiers: {
    tier1: number | null;
    tier2: number | null;
    tier3: number | null;
    gifts: number | null;
  };
  subscriptionList: TwitchSubscriberRow[];
  notice: string | null;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateKeys(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dbInt(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(Math.round(value), 2_147_483_647));
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function readCount(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return null;
}

export async function helix(
  path: string,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetch(`${HELIX_HOST}${path}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Client-Id": getTwitchClientId(),
        },
        signal: controller.signal,
        cache: "no-store",
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("twitch-timeout"));
        }, 8_000);
      }),
    ]);
    let body: Record<string, unknown> = {};
    try {
      const parsed = await response.json();
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      body = {};
    }
    return { status: response.status, body };
  } catch {
    return { status: 504, body: {} };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function loadAccessToken(options: {
  clientId: string;
  connectionId: string;
}): Promise<{ accessToken: string; broadcasterId: string }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
      { status: 503 },
    );
  }

  const connection = await prisma.socialProviderConnection.findFirst({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      provider: "twitch",
      status: { in: [...LIVE_STATUSES] },
    },
    select: {
      id: true,
      scopes: true,
      externalSubjectId: true,
      credential: {
        select: {
          id: true,
          encryptedPayload: true,
          iv: true,
          authTag: true,
          keyVersion: true,
          tokenExpiresAt: true,
          status: true,
        },
      },
    },
  });

  if (!connection?.credential || connection.credential.status !== "active") {
    throw new ServiceError("forbidden", "Twitch is not connected.", { status: 401 });
  }

  const aad = buildSocialCredentialAad({
    clientId: options.clientId,
    connectionId: options.connectionId,
    provider: "twitch",
  });

  let payload: SocialTokenPayload;
  try {
    payload = decryptSocialTokenPayload(
      {
        ciphertext: connection.credential.encryptedPayload,
        iv: connection.credential.iv,
        authTag: connection.credential.authTag,
        keyVersion: connection.credential.keyVersion,
      },
      aad,
    );
  } catch {
    throw new ServiceError(
      "forbidden",
      "The Twitch credential could not be read. Reconnect the channel.",
      { status: 401 },
    );
  }

  const expiresSoon =
    !connection.credential.tokenExpiresAt ||
    connection.credential.tokenExpiresAt.getTime() <= Date.now() + 60_000;

  let accessToken = payload.accessToken;
  if (expiresSoon) {
    if (!payload.refreshToken) {
      throw new ServiceError(
        "forbidden",
        "Twitch authorization has expired. Reconnect the channel.",
        { status: 401 },
      );
    }
    const refreshed = await refreshTwitchAccessToken(payload.refreshToken);
    const nextPayload: SocialTokenPayload = {
      ...payload,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? payload.refreshToken,
      scopes: refreshed.scopes.length ? refreshed.scopes : payload.scopes,
      issuedAt: new Date().toISOString(),
    };
    const encrypted = encryptSocialTokenPayload(nextPayload, aad);
    await prisma.$transaction([
      prisma.socialCredential.update({
        where: { id: connection.credential.id },
        data: {
          encryptedPayload: encrypted.ciphertext,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          keyVersion: encrypted.keyVersion,
          tokenExpiresAt: refreshed.expiresAt,
          lastValidatedAt: new Date(),
        },
      }),
      prisma.socialProviderConnection.update({
        where: { id: options.connectionId },
        data: {
          scopes: nextPayload.scopes ?? [],
          accessTokenExpiresAt: refreshed.expiresAt,
          lastValidatedAt: new Date(),
          lastErrorCode: null,
          lastErrorMessage: null,
          lastErrorAt: null,
        },
      }),
    ]);
    accessToken = refreshed.accessToken;
  }

  let broadcasterId = connection.externalSubjectId?.trim() || "";
  if (!broadcasterId) {
    const users = await helix("/helix/users", accessToken);
    const data = users.body.data;
    const first = Array.isArray(data) ? data[0] : null;
    if (typeof first === "object" && first !== null && !Array.isArray(first)) {
      broadcasterId = readString(first as Record<string, unknown>, "id") ?? "";
    }
  }
  if (!broadcasterId) {
    throw new ServiceError(
      "unavailable",
      "Twitch did not return this channel.",
      { status: 502 },
    );
  }

  return { accessToken, broadcasterId };
}

async function readTotal(
  path: string,
  accessToken: string,
): Promise<{ value: number | null; denied: boolean }> {
  const result = await helix(path, accessToken);
  if (result.status === 401 || result.status === 403) {
    return { value: null, denied: true };
  }
  if (result.status < 200 || result.status >= 300) {
    return { value: null, denied: false };
  }
  return { value: readCount(result.body, "total"), denied: false };
}

function tierLabel(tier: string | null, gifted: boolean): string {
  if (gifted) return "Gift";
  if (tier === "3000") return "Tier 3";
  if (tier === "2000") return "Tier 2";
  return "Tier 1";
}

async function listSubscriptions(
  broadcasterId: string,
  accessToken: string,
): Promise<{
  denied: boolean;
  unavailable: boolean;
  total: number | null;
  tier1: number | null;
  tier2: number | null;
  tier3: number | null;
  gifts: number | null;
  subscribers: TwitchSubscriberRow[];
}> {
  const empty = {
    tier1: null,
    tier2: null,
    tier3: null,
    gifts: null,
    subscribers: [] as TwitchSubscriberRow[],
  };
  const counts = { tier1: 0, tier2: 0, tier3: 0, gifts: 0 };
  const subscribers: TwitchSubscriberRow[] = [];
  let cursor: string | null = null;
  let total: number | null = null;

  for (let page = 0; page < MAX_SUBSCRIPTION_PAGES; page += 1) {
    const query = new URLSearchParams({
      broadcaster_id: broadcasterId,
      first: "100",
    });
    if (cursor) query.set("after", cursor);
    const result = await helix(`/helix/subscriptions?${query.toString()}`, accessToken);
    if (result.status === 401 || result.status === 403) {
      return { denied: true, unavailable: false, total: null, ...empty };
    }
    if (result.status < 200 || result.status >= 300) {
      return { denied: false, unavailable: true, total: null, ...empty };
    }

    if (total == null) total = readCount(result.body, "total");
    if (total === 0) {
      return {
        denied: false,
        unavailable: false,
        total: 0,
        tier1: 0,
        tier2: 0,
        tier3: 0,
        gifts: 0,
        subscribers: [],
      };
    }

    const data = Array.isArray(result.body.data) ? result.body.data : [];
    for (const item of data) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const name = readString(record, "user_name") ?? readString(record, "user_login");
      if (!name) continue;
      const gifted = record.is_gift === true;
      const tier = readString(record, "tier");
      if (gifted) counts.gifts += 1;
      else if (tier === "3000") counts.tier3 += 1;
      else if (tier === "2000") counts.tier2 += 1;
      else counts.tier1 += 1;
      subscribers.push({ name, label: tierLabel(tier, gifted) });
    }

    const pagination = result.body.pagination;
    const next =
      typeof pagination === "object" &&
      pagination !== null &&
      !Array.isArray(pagination)
        ? readString(pagination as Record<string, unknown>, "cursor")
        : null;
    if (!next || data.length === 0) {
      return {
        denied: false,
        unavailable: false,
        total: total ?? subscribers.length,
        ...counts,
        subscribers,
      };
    }
    cursor = next;
  }

  return { denied: false, unavailable: false, total, ...empty };
}

function parseTwitchDuration(value: string | null): number {
  if (!value) return 0;
  const hours = Number(/(\d+)h/.exec(value)?.[1] ?? 0);
  const minutes = Number(/(\d+)m/.exec(value)?.[1] ?? 0);
  const seconds = Number(/(\d+)s/.exec(value)?.[1] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function safeTwitchUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return null;
    if (host !== "twitch.tv" && !host.endsWith(".twitch.tv")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function emptyVideoList(): {
  days: Map<string, number>;
  viewDays: Map<string, number>;
  durationDays: Map<string, number>;
  videos: TwitchMediaRow[];
  confirmed: boolean;
} {
  return {
    days: new Map(),
    viewDays: new Map(),
    durationDays: new Map(),
    videos: [],
    confirmed: false,
  };
}

async function listVideoDays(
  broadcasterId: string,
  accessToken: string,
  start: string,
  end: string,
): Promise<{
  days: Map<string, number>;
  viewDays: Map<string, number>;
  durationDays: Map<string, number>;
  videos: TwitchMediaRow[];
  confirmed: boolean;
}> {
  const days = new Map<string, number>();
  const viewDays = new Map<string, number>();
  const durationDays = new Map<string, number>();
  const videos: TwitchMediaRow[] = [];
  let cursor: string | null = null;
  let confirmed = true;

  for (let page = 0; page < MAX_VIDEO_PAGES; page += 1) {
    const query = new URLSearchParams({
      user_id: broadcasterId,
      first: "100",
    });
    if (cursor) query.set("after", cursor);
    const result = await helix(`/helix/videos?${query.toString()}`, accessToken);
    if (result.status === 401 || result.status === 403 || result.status >= 400) {
      return emptyVideoList();
    }
    const data = Array.isArray(result.body.data) ? result.body.data : [];
    let oldest: string | null = null;
    for (const item of data) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const published = readString(record, "published_at");
      if (!published) continue;
      const day = published.slice(0, 10);
      if (oldest == null || day < oldest) oldest = day;
      if (day < start || day > end) continue;
      const views = readCount(record, "view_count") ?? 0;
      const durationSeconds = parseTwitchDuration(readString(record, "duration"));
      days.set(day, (days.get(day) ?? 0) + 1);
      viewDays.set(day, (viewDays.get(day) ?? 0) + views);
      durationDays.set(day, (durationDays.get(day) ?? 0) + durationSeconds);
      videos.push({
        title: readString(record, "title") ?? "Untitled video",
        publishedOn: day,
        views,
        durationSeconds,
        url: safeTwitchUrl(readString(record, "url")),
      });
    }
    const pagination = result.body.pagination;
    const next =
      typeof pagination === "object" &&
      pagination !== null &&
      !Array.isArray(pagination)
        ? readString(pagination as Record<string, unknown>, "cursor")
        : null;
    if (!next || data.length === 0 || (oldest != null && oldest < start)) {
      break;
    }
    cursor = next;
    if (page === MAX_VIDEO_PAGES - 1) confirmed = false;
  }

  return { days, viewDays, durationDays, videos: confirmed ? videos : [], confirmed };
}

async function listClips(
  broadcasterId: string,
  accessToken: string,
  start: string,
  end: string,
): Promise<{ clips: TwitchMediaRow[]; confirmed: boolean }> {
  const clips: TwitchMediaRow[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 2; page += 1) {
    const query = new URLSearchParams({
      broadcaster_id: broadcasterId,
      first: "20",
    });
    if (cursor) query.set("after", cursor);
    const result = await helix(`/helix/clips?${query.toString()}`, accessToken);
    if (result.status < 200 || result.status >= 300) {
      return { clips: [], confirmed: false };
    }
    const data = Array.isArray(result.body.data) ? result.body.data : [];
    let oldest: string | null = null;
    for (const item of data) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
      const record = item as Record<string, unknown>;
      const created = readString(record, "created_at");
      if (!created) continue;
      const day = created.slice(0, 10);
      if (oldest == null || day < oldest) oldest = day;
      if (day < start || day > end) continue;
      const duration = record.duration;
      clips.push({
        title: readString(record, "title") ?? "Untitled clip",
        publishedOn: day,
        views: readCount(record, "view_count") ?? 0,
        durationSeconds:
          typeof duration === "number" && Number.isFinite(duration)
            ? Math.max(0, Math.round(duration))
            : 0,
        url: safeTwitchUrl(readString(record, "url")),
      });
    }
    const pagination = result.body.pagination;
    const next =
      typeof pagination === "object" &&
      pagination !== null &&
      !Array.isArray(pagination)
        ? readString(pagination as Record<string, unknown>, "cursor")
        : null;
    if (!next || data.length === 0 || (oldest != null && oldest < start)) {
      return { clips, confirmed: true };
    }
    cursor = next;
  }

  return { clips, confirmed: false };
}

function buildPoints(options: {
  start: string;
  end: string;
  videoDays: Map<string, number>;
  viewDays: Map<string, number>;
  durationDays: Map<string, number>;
  videosConfirmed: boolean;
  snapshots: Array<{ date: string; followers: number; subscribers: number | null }>;
}): TwitchCommunityPoint[] {
  const snapshots = new Map(options.snapshots.map((row) => [row.date, row]));
  return dateKeys(options.start, options.end).map((date) => {
    const snapshot = snapshots.get(date);
    const videosOnDay = options.videoDays.get(date) ?? 0;
    const viewsOnDay = options.viewDays.get(date) ?? 0;
    const durationOnDay = options.durationDays.get(date) ?? 0;
    return {
      date,
      followers: snapshot ? snapshot.followers : null,
      subscribers: snapshot ? snapshot.subscribers : null,
      videos: options.videosConfirmed
        ? videosOnDay
        : options.videoDays.has(date)
          ? videosOnDay
          : null,
      views: options.videosConfirmed
        ? viewsOnDay
        : options.viewDays.has(date)
          ? viewsOnDay
          : null,
      durationSeconds: options.videosConfirmed
        ? durationOnDay
        : options.durationDays.has(date)
          ? durationOnDay
          : null,
    };
  });
}

export async function fetchTwitchCommunityAnalytics(options: {
  clientId: string;
  connectionId: string;
  socialAccountId: string;
  start: string;
  end: string;
}): Promise<TwitchCommunityAnalytics> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
      { status: 503 },
    );
  }

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId,
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
      platform: "twitch",
    },
    select: {
      id: true,
      businessBrandId: true,
      displayName: true,
      handle: true,
      profileImageUrl: true,
    },
  });
  if (!account?.businessBrandId) {
    throw new ServiceError("not_found", "No connected Twitch channel is selected.", {
      status: 404,
    });
  }

  const access = await loadAccessToken({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });

  const [followerResult, subscriptionList, videoList, clipList] = await Promise.all([
    readTotal(
      `/helix/channels/followers?broadcaster_id=${encodeURIComponent(access.broadcasterId)}&first=1`,
      access.accessToken,
    ),
    listSubscriptions(access.broadcasterId, access.accessToken),
    listVideoDays(
      access.broadcasterId,
      access.accessToken,
      options.start,
      options.end,
    ),
    listClips(access.broadcasterId, access.accessToken, options.start, options.end),
  ]);
  const followers = followerResult.value;
  const subscribers = subscriptionList.total;

  if (followers != null) {
    const metadata: Prisma.InputJsonValue = {
      kind: SNAPSHOT_KIND,
      ...(subscribers != null ? { subscribers } : {}),
    };
    const date = todayKey();
    await prisma.socialAnalyticsDaily.upsert({
      where: {
        socialAccountId_date_source: {
          socialAccountId: account.id,
          date: parseDateOnly(date),
          source: "provider_api",
        },
      },
      create: {
        clientId: options.clientId,
        businessBrandId: account.businessBrandId,
        socialAccountId: account.id,
        platform: "twitch",
        date: parseDateOnly(date),
        followers: dbInt(followers),
        source: "provider_api",
        metadata,
      },
      update: {
        followers: dbInt(followers),
        metadata,
      },
    });
  }

  const rows = await prisma.socialAnalyticsDaily.findMany({
    where: {
      clientId: options.clientId,
      socialAccountId: account.id,
      platform: "twitch",
      source: "provider_api",
      date: {
        gte: parseDateOnly(options.start),
        lte: parseDateOnly(options.end),
      },
    },
    select: { date: true, followers: true, metadata: true },
  });

  const snapshots = rows
    .filter((row) => {
      const metadata = row.metadata;
      return (
        typeof metadata === "object" &&
        metadata !== null &&
        !Array.isArray(metadata) &&
        (metadata as Record<string, unknown>).kind === SNAPSHOT_KIND
      );
    })
    .map((row) => {
      const metadata = row.metadata as Record<string, unknown>;
      return {
        date: row.date.toISOString().slice(0, 10),
        followers: row.followers,
        subscribers: readCount(metadata, "subscribers"),
      };
    });

  const points = buildPoints({
    start: options.start,
    end: options.end,
    videoDays: videoList.days,
    viewDays: videoList.viewDays,
    durationDays: videoList.durationDays,
    videosConfirmed: videoList.confirmed,
    snapshots,
  });

  const videos = videoList.confirmed
    ? points.reduce((total, point) => total + (point.videos ?? 0), 0)
    : null;
  const streamViews = videoList.confirmed
    ? points.reduce((total, point) => total + (point.views ?? 0), 0)
    : null;
  const streamDurationSeconds = videoList.confirmed
    ? points.reduce((total, point) => total + (point.durationSeconds ?? 0), 0)
    : null;

  const denied = followerResult.denied || subscriptionList.denied;
  const unavailable =
    (!followerResult.denied && followers == null) ||
    (!subscriptionList.denied && (subscribers == null || subscriptionList.unavailable));

  return {
    account: {
      name: account.displayName ?? account.handle ?? "Twitch channel",
      handle: account.handle,
      avatarUrl: account.profileImageUrl,
    },
    followers,
    subscribers,
    videos,
    videosConfirmed: videoList.confirmed,
    streamViews,
    streamDurationSeconds,
    videoList: videoList.videos,
    clipList: clipList.clips,
    clipsConfirmed: clipList.confirmed,
    points,
    subscriptionTiers: {
      tier1: subscriptionList.tier1,
      tier2: subscriptionList.tier2,
      tier3: subscriptionList.tier3,
      gifts: subscriptionList.gifts,
    },
    subscriptionList: subscriptionList.subscribers,
    notice: denied
      ? "Reconnect Twitch to grant the missing follower or subscriber permission. This page only shows numbers Twitch returns."
      : unavailable
        ? "Twitch did not return every Community total for this channel."
        : videoList.confirmed
          ? null
          : "Older Twitch videos in this range could not be listed, so those days stay blank.",
  };
}
