import "server-only";

import { createHash } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  buildTikTokSeries,
  type TikTokDailyPoint,
  type TikTokSeriesTotals,
} from "@/lib/social/providers/tiktok-analytics-series";
import { refreshTikTokAccessToken } from "@/lib/social/providers/tiktok-token";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  encryptSocialTokenPayload,
  type SocialTokenPayload,
} from "@/lib/social/security/social-crypto";

const API_HOST = "https://open.tiktokapis.com";
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_VIDEO_PAGES = 8;
const FOLLOWER_SNAPSHOT_KIND = "tiktok_follower_balance";

const USER_FIELDS = [
  "open_id",
  "union_id",
  "avatar_url",
  "display_name",
  "username",
] as const;

const STAT_FIELDS = [
  "follower_count",
  "following_count",
  "likes_count",
  "video_count",
] as const;

const VIDEO_FIELDS = [
  "id",
  "create_time",
  "cover_image_url",
  "share_url",
  "video_description",
  "duration",
  "title",
  "like_count",
  "comment_count",
  "share_count",
  "view_count",
] as const;

const LIVE_STATUSES = [
  "connected",
  "authorized",
  "reauthorization_required",
] as const;

export type TikTokAnalyticsPost = {
  id: string;
  caption: string;
  type: "Video";
  publishedAt: string;
  publishedOn: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  permalinkUrl: string | null;
};

export type TikTokAnalyticsPayload = {
  account: {
    name: string;
    handle: string | null;
    avatarUrl: string | null;
  };
  followers: number | null;
  following: number | null;
  likes: number | null;
  videoCount: number | null;
  reauthorizationRequired: boolean;
  missingScopes: string[];
  videosConfirmed: boolean;
  videosPartial: boolean;
  notice: string | null;
  posts: TikTokAnalyticsPost[];
  points: TikTokDailyPoint[];
  totals: TikTokSeriesTotals;
};

type LiveVideo = TikTokAnalyticsPost & {
  externalId: string;
};

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function errorRecord(body: Record<string, unknown>): Record<string, unknown> {
  const nested = body.error;
  if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
    return nested as Record<string, unknown>;
  }
  return body;
}

function errorCode(body: Record<string, unknown>): string {
  const nested = errorRecord(body);
  return (
    readString(nested, "code") ??
    (typeof body.error === "string" ? body.error.trim() : "") ??
    ""
  ).toLowerCase();
}

function isApiError(responseOk: boolean, body: Record<string, unknown>): boolean {
  if (!responseOk) return true;
  const code = errorCode(body);
  if (!code) return Boolean(body.error);
  return code !== "ok";
}

function isScopeError(body: Record<string, unknown>): boolean {
  const code = errorCode(body);
  const message = (
    readString(errorRecord(body), "message") ?? ""
  ).toLowerCase();
  return (
    code.includes("scope") ||
    message.includes("scope") ||
    code === "access_denied"
  );
}

function hashVideoId(videoId: string): string {
  return createHash("sha256")
    .update(`tiktok:video:${videoId}`)
    .digest("hex")
    .slice(0, 32);
}

function dateKeyFromUnix(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function dbInt(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const rounded = Math.max(0, Math.round(value));
  return Math.min(rounded, 2_147_483_647);
}

function excerpt(value: string | null, max = 500): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

async function tikTokJson(
  url: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: body ? "POST" : "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError(
        "unavailable",
        "TikTok took too long to respond. You can retry.",
        { status: 503 },
      );
    }
    throw new ServiceError(
      "unavailable",
      "TikTok analytics could not be loaded. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "TikTok returned an unexpected analytics response.",
      { status: 502 },
    );
  }

  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "TikTok returned an invalid analytics response.",
      { status: 502 },
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ServiceError(
      "unavailable",
      "TikTok returned an incomplete analytics response.",
      { status: 502 },
    );
  }

  const record = parsed as Record<string, unknown>;
  if (!isApiError(response.ok, record)) {
    return record;
  }

  if (isScopeError(record)) {
    throw new ServiceError("forbidden", "TikTok did not grant this statistic.", {
      status: 403,
    });
  }

  const code = errorCode(record);
  if (
    response.status === 401 ||
    code.includes("token") ||
    code === "invalid_grant" ||
    code === "unauthorized"
  ) {
    throw new ServiceError(
      "forbidden",
      "TikTok authorization has expired. Reconnect the account.",
      { status: 401 },
    );
  }

  throw new ServiceError(
    "unavailable",
    "TikTok analytics could not be loaded. You can retry.",
    { status: 503 },
  );
}

async function loadAccessToken(options: {
  clientId: string;
  connectionId: string;
}): Promise<{ accessToken: string; scopes: string[] }> {
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
      provider: "tiktok",
      status: { in: [...LIVE_STATUSES] },
    },
    select: {
      id: true,
      scopes: true,
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
    throw new ServiceError(
      "forbidden",
      "TikTok is not connected.",
      { status: 401 },
    );
  }

  const aad = buildSocialCredentialAad({
    clientId: options.clientId,
    connectionId: options.connectionId,
    provider: "tiktok",
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
      "The TikTok credential could not be read. Reconnect the account.",
      { status: 401 },
    );
  }

  const expiresSoon =
    !connection.credential.tokenExpiresAt ||
    connection.credential.tokenExpiresAt.getTime() <= Date.now() + 60_000;

  const scopes = new Set<string>([
    ...connection.scopes,
    ...(payload.scopes ?? []),
  ]);

  if (!expiresSoon) {
    return { accessToken: payload.accessToken, scopes: [...scopes] };
  }

  if (!payload.refreshToken) {
    throw new ServiceError(
      "forbidden",
      "TikTok authorization has expired. Reconnect the account.",
      { status: 401 },
    );
  }

  const refreshed = await refreshTikTokAccessToken(payload.refreshToken);
  const nextPayload: SocialTokenPayload = {
    ...payload,
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken ?? payload.refreshToken,
    scopes: refreshed.scopes.length ? refreshed.scopes : [...scopes],
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
        refreshExpiresAt: refreshed.refreshExpiresAt,
        lastValidatedAt: new Date(),
      },
    }),
    prisma.socialProviderConnection.update({
      where: { id: options.connectionId },
      data: {
        scopes: nextPayload.scopes ?? [],
        accessTokenExpiresAt: refreshed.expiresAt,
        refreshTokenExpiresAt: refreshed.refreshExpiresAt,
        lastValidatedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    }),
  ]);

  return {
    accessToken: refreshed.accessToken,
    scopes: nextPayload.scopes ?? [],
  };
}

function mapVideo(record: Record<string, unknown>): LiveVideo | null {
  const externalId = readString(record, "id");
  const created = readNumber(record, "create_time");
  if (!externalId || created == null || created <= 0) return null;

  const publishedAt = new Date(created * 1000).toISOString();
  const caption =
    excerpt(readString(record, "video_description")) ??
    excerpt(readString(record, "title")) ??
    "TikTok video";

  return {
    id: hashVideoId(externalId),
    externalId,
    caption,
    type: "Video",
    publishedAt,
    publishedOn: dateKeyFromUnix(created),
    views: readNumber(record, "view_count"),
    likes: readNumber(record, "like_count"),
    comments: readNumber(record, "comment_count"),
    shares: readNumber(record, "share_count"),
    durationSeconds: readNumber(record, "duration"),
    thumbnailUrl: readString(record, "cover_image_url"),
    permalinkUrl: readString(record, "share_url"),
  };
}

async function listVideos(
  token: string,
  start: string,
): Promise<{ videos: LiveVideo[]; partial: boolean }> {
  const videos: LiveVideo[] = [];
  let cursor: number | null = null;
  let partial = false;

  for (let page = 0; page < MAX_VIDEO_PAGES; page += 1) {
    const url = new URL(`${API_HOST}/v2/video/list/`);
    url.searchParams.set("fields", VIDEO_FIELDS.join(","));
    const body: Record<string, unknown> = { max_count: 20 };
    if (cursor != null) body.cursor = cursor;

    const response = await tikTokJson(url.toString(), token, body);
    const data =
      typeof response.data === "object" &&
      response.data !== null &&
      !Array.isArray(response.data)
        ? (response.data as Record<string, unknown>)
        : {};
    const rows = Array.isArray(data.videos) ? data.videos : [];
    let oldestInPage: string | null = null;

    for (const row of rows) {
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        continue;
      }
      const video = mapVideo(row as Record<string, unknown>);
      if (!video) continue;
      videos.push(video);
      if (!oldestInPage || video.publishedOn < oldestInPage) {
        oldestInPage = video.publishedOn;
      }
    }

    const hasMore = data.has_more === true;
    const nextCursor = readNumber(data, "cursor");
    if (!hasMore || nextCursor == null || nextCursor === cursor) {
      partial = false;
      break;
    }

    if (oldestInPage && oldestInPage < start) {
      partial = false;
      break;
    }

    cursor = nextCursor;
    if (page === MAX_VIDEO_PAGES - 1) {
      partial = true;
    }
  }

  return { videos, partial };
}

async function persistVideos(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  videos: LiveVideo[];
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma || !options.videos.length) return;

  const retrievedAt = new Date();
  for (const video of options.videos) {
    const metadata: Prisma.InputJsonValue = {
      provider: "tiktok",
      durationSeconds: video.durationSeconds,
    };
    await prisma.socialContentItem.upsert({
      where: {
        socialAccountId_contentType_externalIdHash: {
          socialAccountId: options.socialAccountId,
          contentType: "video",
          externalIdHash: video.id,
        },
      },
      create: {
        clientId: options.clientId,
        businessBrandId: options.businessBrandId,
        socialAccountId: options.socialAccountId,
        contentType: "video",
        externalIdHash: video.id,
        externalObjectId: video.externalId,
        publishedAt: new Date(video.publishedAt),
        captionExcerpt: video.caption,
        permalinkUrl: video.permalinkUrl,
        thumbnailUrl: video.thumbnailUrl,
        availability: "available",
        views: dbInt(video.views),
        reactions: dbInt(video.likes),
        comments: dbInt(video.comments),
        shares: dbInt(video.shares),
        engagement: dbInt(
          [video.likes, video.comments, video.shares].every(
            (value) => value == null,
          )
            ? null
            : (video.likes ?? 0) + (video.comments ?? 0) + (video.shares ?? 0),
        ),
        retrievedAt,
        lastSeenAt: retrievedAt,
        metadata,
      },
      update: {
        publishedAt: new Date(video.publishedAt),
        captionExcerpt: video.caption,
        permalinkUrl: video.permalinkUrl,
        thumbnailUrl: video.thumbnailUrl,
        availability: "available",
        views: dbInt(video.views),
        reactions: dbInt(video.likes),
        comments: dbInt(video.comments),
        shares: dbInt(video.shares),
        engagement: dbInt(
          [video.likes, video.comments, video.shares].every(
            (value) => value == null,
          )
            ? null
            : (video.likes ?? 0) + (video.comments ?? 0) + (video.shares ?? 0),
        ),
        retrievedAt,
        lastSeenAt: retrievedAt,
        deletedAt: null,
        metadata,
      },
    });
  }
}

async function persistFollowerSnapshot(options: {
  clientId: string;
  businessBrandId: string;
  socialAccountId: string;
  followers: number;
}): Promise<void> {
  const prisma = getPrisma();
  if (!prisma) return;

  const date = todayKey();
  const metadata: Prisma.InputJsonValue = {
    kind: FOLLOWER_SNAPSHOT_KIND,
    provider: "tiktok",
  };

  await prisma.socialAnalyticsDaily.upsert({
    where: {
      socialAccountId_date_source: {
        socialAccountId: options.socialAccountId,
        date: parseDateOnly(date),
        source: "provider_api",
      },
    },
    create: {
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      socialAccountId: options.socialAccountId,
      platform: "tiktok",
      date: parseDateOnly(date),
      followers: dbInt(options.followers) ?? 0,
      source: "provider_api",
      metadata,
    },
    update: {
      followers: dbInt(options.followers) ?? 0,
      metadata,
    },
  });
}

async function readFollowerSnapshots(options: {
  clientId: string;
  socialAccountId: string;
  start: string;
  end: string;
}): Promise<Array<{ date: string; followers: number }>> {
  const prisma = getPrisma();
  if (!prisma) return [];

  const rows = await prisma.socialAnalyticsDaily.findMany({
    where: {
      clientId: options.clientId,
      socialAccountId: options.socialAccountId,
      platform: "tiktok",
      source: "provider_api",
      date: {
        gte: parseDateOnly(options.start),
        lte: parseDateOnly(options.end),
      },
    },
    select: {
      date: true,
      followers: true,
      metadata: true,
    },
  });

  return rows
    .filter((row) => {
      const metadata = row.metadata;
      return (
        typeof metadata === "object" &&
        metadata !== null &&
        !Array.isArray(metadata) &&
        (metadata as Record<string, unknown>).kind === FOLLOWER_SNAPSHOT_KIND
      );
    })
    .map((row) => ({
      date: row.date.toISOString().slice(0, 10),
      followers: row.followers,
    }));
}

function publicPost(video: LiveVideo): TikTokAnalyticsPost {
  return {
    id: video.id,
    caption: video.caption,
    type: video.type,
    publishedAt: video.publishedAt,
    publishedOn: video.publishedOn,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    shares: video.shares,
    durationSeconds: video.durationSeconds,
    thumbnailUrl: video.thumbnailUrl,
    permalinkUrl: video.permalinkUrl,
  };
}

export async function fetchTikTokAnalytics(options: {
  clientId: string;
  connectionId: string;
  socialAccountId: string;
  start: string;
  end: string;
}): Promise<TikTokAnalyticsPayload> {
  if (options.start > options.end) {
    throw new ServiceError(
      "invalid_input",
      "The TikTok date range is invalid.",
    );
  }

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
      platform: "tiktok",
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
    throw new ServiceError(
      "not_found",
      "No connected TikTok account is selected.",
      { status: 404 },
    );
  }

  const access = await loadAccessToken({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });

  const scopeSet = new Set(access.scopes);
  const knownScopes = access.scopes.length > 0;
  const canReadStats = !knownScopes || scopeSet.has("user.info.stats");
  const canListVideos = !knownScopes || scopeSet.has("video.list");
  const missingScopes = [
    canReadStats ? null : "user.info.stats",
    canListVideos ? null : "video.list",
  ].filter((scope): scope is string => Boolean(scope));

  let reauthorizationRequired = missingScopes.length > 0;
  let followers: number | null = null;
  let following: number | null = null;
  let likes: number | null = null;
  let videoCount: number | null = null;
  let displayName = account.displayName;
  let handle = account.handle;
  let avatarUrl = account.profileImageUrl;

  const userUrl = new URL(`${API_HOST}/v2/user/info/`);
  userUrl.searchParams.set(
    "fields",
    [...USER_FIELDS, ...(canReadStats ? STAT_FIELDS : [])].join(","),
  );

  try {
    const userResponse = await tikTokJson(userUrl.toString(), access.accessToken);
    const data =
      typeof userResponse.data === "object" &&
      userResponse.data !== null &&
      !Array.isArray(userResponse.data)
        ? (userResponse.data as Record<string, unknown>)
        : {};
    const user =
      typeof data.user === "object" &&
      data.user !== null &&
      !Array.isArray(data.user)
        ? (data.user as Record<string, unknown>)
        : data;

    displayName = readString(user, "display_name") ?? displayName;
    handle = readString(user, "username") ?? handle;
    avatarUrl = readString(user, "avatar_url") ?? avatarUrl;
    followers = canReadStats ? readNumber(user, "follower_count") : null;
    following = canReadStats ? readNumber(user, "following_count") : null;
    likes = canReadStats ? readNumber(user, "likes_count") : null;
    videoCount = canReadStats ? readNumber(user, "video_count") : null;

    await prisma.socialAccount.update({
      where: { id: account.id },
      data: {
        displayName: displayName ?? undefined,
        handle: handle ?? undefined,
        profileImageUrl: readString(user, "avatar_url") ?? undefined,
        lastSyncAt: new Date(),
      },
    });
  } catch (error) {
    if (
      error instanceof ServiceError &&
      error.code === "forbidden" &&
      error.message === "TikTok did not grant this statistic."
    ) {
      reauthorizationRequired = true;
      if (!missingScopes.includes("user.info.stats")) {
        missingScopes.push("user.info.stats");
      }
    } else {
      throw error;
    }
  }

  if (followers != null) {
    try {
      await persistFollowerSnapshot({
        clientId: options.clientId,
        businessBrandId: account.businessBrandId,
        socialAccountId: account.id,
        followers,
      });
    } catch (error) {
      console.error(
        "[social-tiktok] Follower snapshot could not be saved:",
        error instanceof Error ? error.name : "unknown",
      );
    }
  }

  let videos: LiveVideo[] = [];
  let videosConfirmed = false;
  let videosPartial = false;
  let notice: string | null = null;

  if (canListVideos && !missingScopes.includes("video.list")) {
    try {
      const listed = await listVideos(access.accessToken, options.start);
      videos = listed.videos;
      videosConfirmed = true;
      videosPartial = listed.partial;
      try {
        await persistVideos({
          clientId: options.clientId,
          businessBrandId: account.businessBrandId,
          socialAccountId: account.id,
          videos,
        });
      } catch (error) {
        console.error(
          "[social-tiktok] Video stats could not be saved:",
          error instanceof Error ? error.name : "unknown",
        );
      }
    } catch (error) {
      if (
        error instanceof ServiceError &&
        error.code === "forbidden" &&
        error.message === "TikTok did not grant this statistic."
      ) {
        reauthorizationRequired = true;
        if (!missingScopes.includes("video.list")) {
          missingScopes.push("video.list");
        }
        notice =
          "Reconnect TikTok to grant video statistics. Profile totals stay available.";
      } else if (
        error instanceof ServiceError &&
        error.status === 401
      ) {
        throw error;
      } else {
        notice = "TikTok videos could not be refreshed. You can retry.";
      }
    }
  } else if (!canListVideos) {
    notice =
      "Reconnect TikTok to grant video statistics. Follower totals stay available when that permission is included.";
  }

  const inRange = videos
    .filter(
      (video) =>
        video.publishedOn >= options.start && video.publishedOn <= options.end,
    )
    .sort((left, right) => (left.publishedAt < right.publishedAt ? 1 : -1));

  let zeroFillFrom: string | null = null;
  if (videosConfirmed && !videosPartial) {
    zeroFillFrom = options.start;
  } else if (videosConfirmed && videos.length) {
    const oldest = videos.reduce(
      (oldestDay, video) =>
        video.publishedOn < oldestDay ? video.publishedOn : oldestDay,
      videos[0].publishedOn,
    );
    zeroFillFrom = oldest > options.start ? oldest : options.start;
    notice =
      notice ??
      "TikTok returned the newest videos in this range. Older days are left blank.";
  }

  const snapshots = await readFollowerSnapshots({
    clientId: options.clientId,
    socialAccountId: account.id,
    start: options.start,
    end: options.end,
  });

  if (followers != null && !snapshots.some((row) => row.date === todayKey())) {
    const today = todayKey();
    if (today >= options.start && today <= options.end) {
      snapshots.push({ date: today, followers });
    }
  }

  const series = buildTikTokSeries({
    start: options.start,
    end: options.end,
    zeroFillFrom,
    posts: inRange.map((video) => ({
      publishedOn: video.publishedOn,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      shares: video.shares,
    })),
    followerSnapshots: snapshots,
  });

  return {
    account: {
      name: displayName ?? handle ?? "TikTok account",
      handle,
      avatarUrl,
    },
    followers,
    following,
    likes,
    videoCount,
    reauthorizationRequired,
    missingScopes,
    videosConfirmed,
    videosPartial,
    notice,
    posts: inRange.map(publicPost),
    points: series.points,
    totals: series.totals,
  };
}
