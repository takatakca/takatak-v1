import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  encryptSocialTokenPayload,
} from "@/lib/social/security/social-crypto";

const DATA_API = "https://www.googleapis.com/youtube/v3/channels";
const ANALYTICS_API = "https://youtubeanalytics.googleapis.com/v2/reports";
const TOKEN_API = "https://oauth2.googleapis.com/token";
const NON_MONETARY_SCOPE = "https://www.googleapis.com/auth/yt-analytics.readonly";
const MONETARY_SCOPE = "https://www.googleapis.com/auth/yt-analytics-monetary.readonly";
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export type YoutubeGrowthDay = {
  day: string;
  subscribers: number | null;
  views: number | null;
  revenue: number | null;
};

export type YoutubeCommunitySnapshot = {
  channel: {
    name: string;
    subscribers: number | null;
    videos: number | null;
  };
  totals: {
    subscriberChange: number | null;
    views: number | null;
    revenue: number | null;
  };
  currency: "CAD";
  range: { start: string; end: string };
  points: YoutubeGrowthDay[];
  retrievedAt: string;
  monetaryAuthorized: boolean;
};

type ProviderObject = Record<string, unknown>;
function record(value: unknown): ProviderObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as ProviderObject)
    : null;
}
function count(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}
function metric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export async function providerJson(url: URL, init: RequestInit): Promise<ProviderObject> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url.toString(), {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json", ...(init.headers ?? {}) },
    });
    const data = response.headers.get("content-type")?.includes("application/json")
      ? record(await response.json().catch(() => null))
      : null;
    if (response.status === 401) {
      throw new ServiceError("forbidden", "YouTube authorization has expired. Reconnect your channel.", { status: 401 });
    }
    if (response.status === 403) {
      throw new ServiceError("forbidden", "YouTube has not granted the required analytics permissions.", { status: 403 });
    }
    if (response.status === 429) {
      throw new ServiceError("unavailable", "YouTube rate limit reached. Please retry later.", { status: 503 });
    }
    if (!response.ok || !data) {
      throw new ServiceError("unavailable", "YouTube analytics is temporarily unavailable.", { status: 502 });
    }
    return data;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError("unavailable", "YouTube did not respond. Please retry.", { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}

function dates(days: number, endingAt = new Date()): { start: string; end: string } {
  // Reporting often lags behind the current UTC day. End on yesterday.
  const end = new Date(Date.UTC(endingAt.getUTCFullYear(), endingAt.getUTCMonth(), endingAt.getUTCDate() - 1));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export async function credentialToken(clientId: string, connectionId: string): Promise<{ token: string; scopes: string[] }> {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "Connection database unavailable.", { status: 503 });
  const connection = await prisma.socialProviderConnection.findFirst({
    where: { id: connectionId, clientId, provider: "google", status: "connected" },
    select: {
      id: true,
      credential: {
        select: { id: true, status: true, encryptedPayload: true, iv: true, authTag: true, keyVersion: true, tokenExpiresAt: true },
      },
    },
  });
  const credential = connection?.credential;
  if (!credential || credential.status !== "active") {
    throw new ServiceError("forbidden", "YouTube is not connected.", { status: 401 });
  }
  const aad = buildSocialCredentialAad({ clientId, connectionId, provider: "google" });
  let payload: ReturnType<typeof decryptSocialTokenPayload>;
  try {
    payload = decryptSocialTokenPayload({
      ciphertext: credential.encryptedPayload,
      iv: credential.iv,
      authTag: credential.authTag,
      keyVersion: credential.keyVersion,
    }, aad);
  } catch {
    throw new ServiceError("forbidden", "YouTube credentials must be renewed.", { status: 401 });
  }
  if (!payload.scopes?.includes(YOUTUBE_SCOPE) ||
      !(payload.scopes.includes(NON_MONETARY_SCOPE) || payload.scopes.includes(MONETARY_SCOPE))) {
    throw new ServiceError("forbidden", "YouTube Analytics permissions are missing. Reconnect to grant them.", { status: 403 });
  }
  if (credential.tokenExpiresAt && credential.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return { token: payload.accessToken, scopes: payload.scopes };
  }
  if (!payload.refreshToken) {
    throw new ServiceError("forbidden", "YouTube credentials have expired. Reconnect your account.", { status: 401 });
  }
  const client = process.env.GOOGLE_SOCIAL_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_SOCIAL_CLIENT_SECRET?.trim();
  if (!client || !secret) {
    throw new ServiceError("unavailable", "Google credentials are not configured.", { status: 503 });
  }
  const form = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: client,
    client_secret: secret,
    refresh_token: payload.refreshToken,
  });
  const tokenBody = await providerJson(new URL(TOKEN_API), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const accessToken = typeof tokenBody.access_token === "string" ? tokenBody.access_token : "";
  if (!accessToken) {
    throw new ServiceError("forbidden", "YouTube could not refresh your connection.", { status: 401 });
  }
  const lifetime = count(tokenBody.expires_in) ?? 3600;
  const expiresAt = new Date(Date.now() + lifetime * 1000);
  const encrypted = encryptSocialTokenPayload({
    ...payload, accessToken, issuedAt: new Date().toISOString(),
  }, aad);
  await prisma.$transaction([
    prisma.socialCredential.update({
      where: { id: credential.id },
      data: {
        encryptedPayload: encrypted.ciphertext,
        iv: encrypted.iv,
        authTag: encrypted.authTag,
        keyVersion: encrypted.keyVersion,
        tokenExpiresAt: expiresAt,
        lastValidatedAt: new Date(),
      },
    }),
    prisma.socialProviderConnection.update({
      where: { id: connectionId },
      data: { accessTokenExpiresAt: expiresAt, lastValidatedAt: new Date() },
    }),
  ]);
  return { token: accessToken, scopes: payload.scopes };
}

async function dailyReport(options: {
  token: string;
  channelId: string;
  start: string;
  end: string;
  metrics: string;
}): Promise<Map<string, number[]>> {
  const url = new URL(ANALYTICS_API);
  url.searchParams.set("ids", "channel==" + options.channelId);
  url.searchParams.set("dimensions", "day");
  url.searchParams.set("startDate", options.start);
  url.searchParams.set("endDate", options.end);
  url.searchParams.set("metrics", options.metrics);
  url.searchParams.set("sort", "day");
  if (options.metrics === "estimatedRevenue") url.searchParams.set("currency", "CAD");
  const body = await providerJson(url, { headers: { Authorization: "Bearer " + options.token } });
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const result = new Map<string, number[]>();
  for (const raw of rows) {
    if (!Array.isArray(raw) || typeof raw[0] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw[0])) continue;
    const numbers = raw.slice(1).map(metric);
    if (numbers.some((value) => value === null)) continue;
    result.set(raw[0], numbers as number[]);
  }
  return result;
}

/**
 * Reuses the selected canonical YouTube account, never a channel ID supplied
 * by the browser. All credential and account reads are tenant-scoped.
 */
export async function getYoutubeCommunitySnapshot(options: {
  clientId: string;
  businessBrandId: string;
  connectionId: string;
  socialAccountId: string;
  days: 7 | 30 | 90 | 365;
  previousPeriod?: boolean;
}): Promise<YoutubeCommunitySnapshot> {
  const prisma = getPrisma();
  if (!prisma) throw new ServiceError("unavailable", "Analytics database unavailable.", { status: 503 });
  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId,
      clientId: options.clientId,
      businessBrandId: options.businessBrandId,
      providerConnectionId: options.connectionId,
      platform: "youtube",
      status: "connected",
      accessStatus: "selected",
    },
    select: { externalAccountId: true, displayName: true },
  });
  const channelId = account?.externalAccountId;
  if (!channelId || !/^UC[A-Za-z0-9_-]{22}$/.test(channelId)) {
    throw new ServiceError("not_found", "Select a connected YouTube channel first.", { status: 404 });
  }
  const { token, scopes } = await credentialToken(options.clientId, options.connectionId);
  const monetaryAuthorized = scopes.includes(MONETARY_SCOPE);
  const baseEnd = options.previousPeriod
    ? new Date(Date.now() - options.days * 86_400_000)
    : new Date();
  const range = dates(options.days, baseEnd);
  const channelUrl = new URL(DATA_API);
  channelUrl.searchParams.set("part", "statistics,snippet");
  channelUrl.searchParams.set("mine", "true");
  channelUrl.searchParams.set("maxResults", "50");
  const [channelResponse, activity] = await Promise.all([
    providerJson(channelUrl, { headers: { Authorization: "Bearer " + token } }),
    dailyReport({ token, channelId, ...range, metrics: "views,subscribersGained,subscribersLost" }),
  ]);
  const channels = Array.isArray(channelResponse.items) ? channelResponse.items : [];
  const actualChannel = channels.map(record).find((item) => item?.id === channelId);
  if (!actualChannel) {
    throw new ServiceError("forbidden", "This Google account no longer grants access to the selected YouTube channel.", { status: 403 });
  }
  const stats = record(actualChannel.statistics);
  const profile = record(actualChannel.snippet);
  const name = typeof profile?.title === "string" ? profile.title : account.displayName || "YouTube channel";
  const revenueRows = monetaryAuthorized
    ? await dailyReport({ token, channelId, ...range, metrics: "estimatedRevenue" }).catch(() => null)
    : null;
  const points: YoutubeGrowthDay[] = [];
  const endDate = new Date(range.end + "T00:00:00.000Z");
  const startDate = new Date(range.start + "T00:00:00.000Z");
  for (let day = new Date(startDate); day <= endDate; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = day.toISOString().slice(0, 10);
    const row = activity.get(key);
    const revenue = revenueRows?.get(key);
    points.push({
      day: key,
      views: row ? row[0] : null,
      subscribers: row ? row[1] - row[2] : null,
      revenue: revenue ? revenue[0] : null,
    });
  }
  function sumPresent(key: "views" | "subscribers" | "revenue"): number | null {
    const values = points.map((point) => point[key]).filter((value): value is number => value !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  }
  return {
    channel: {
      name,
      subscribers: stats?.hiddenSubscriberCount === true ? null : count(stats?.subscriberCount),
      videos: count(stats?.videoCount),
    },
    totals: {
      subscriberChange: sumPresent("subscribers"),
      views: sumPresent("views"),
      revenue: sumPresent("revenue"),
    },
    currency: "CAD",
    range,
    points,
    retrievedAt: new Date().toISOString(),
    monetaryAuthorized,
  };
}
