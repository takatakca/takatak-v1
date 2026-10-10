import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  encryptSocialTokenPayload,
  type SocialTokenPayload,
} from "@/lib/social/security/social-crypto";

const PERFORMANCE_API =
  "https://businessprofileperformance.googleapis.com/v1";

const TOKEN_API =
  "https://oauth2.googleapis.com/token";

const REQUEST_TIMEOUT_MS = 20_000;

const DAILY_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "WEBSITE_CLICKS",
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
] as const;

type DailyMetric = (typeof DAILY_METRICS)[number];

type DateParts = {
  year: number;
  month: number;
  day: number;
};

export type GoogleBusinessAnalyticsPoint = {
  date: string;
  maps: number | null;
  search: number | null;
  website: number | null;
  phone: number | null;
  directions: number | null;
};

export type GoogleBusinessKeyword = {
  keyword: string;
  impressions: number | null;
  threshold: number | null;
};

export type GoogleBusinessAnalyticsResult = {
  range: {
    start: string;
    end: string;
  };
  totals: {
    maps: number | null;
    search: number | null;
    reach: number | null;
    website: number | null;
    phone: number | null;
    directions: number | null;
    clicks: number | null;
  };
  points: GoogleBusinessAnalyticsPoint[];
  keywords: GoogleBusinessKeyword[];
  dataAvailable: boolean;
};

type StoredCredential = {
  id: string;
  connectionId: string;
  encryptedPayload: string;
  iv: string;
  authTag: string;
  keyVersion: number;
  tokenExpiresAt: Date | null;
};

function object(
  value: unknown,
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(
  value: unknown,
): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

function integer(
  value: unknown,
): number | null {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return Math.max(0, Math.trunc(value));
  }

  if (
    typeof value === "string" &&
    /^\d+$/.test(value)
  ) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed)
      ? parsed
      : null;
  }

  return null;
}

function env(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ServiceError(
      "unavailable",
      "Google authorization is not configured.",
      { status: 503 },
    );
  }

  return value;
}

function isoDate(parts: DateParts): string {
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}

function parseIsoDate(
  value: string,
): DateParts {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new ServiceError(
      "invalid_input",
      "The analytics date range is invalid.",
      { status: 400 },
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new ServiceError(
      "invalid_input",
      "The analytics date range is invalid.",
      { status: 400 },
    );
  }

  return { year, month, day };
}

function dateToParts(date: Date): DateParts {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function enumerateDates(
  start: string,
  end: string,
): string[] {
  const startParts = parseIsoDate(start);
  const endParts = parseIsoDate(end);

  const cursor = new Date(
    Date.UTC(
      startParts.year,
      startParts.month - 1,
      startParts.day,
    ),
  );

  const finalDate = new Date(
    Date.UTC(
      endParts.year,
      endParts.month - 1,
      endParts.day,
    ),
  );

  if (cursor.getTime() > finalDate.getTime()) {
    throw new ServiceError(
      "invalid_input",
      "The analytics start date must be before the end date.",
      { status: 400 },
    );
  }

  const difference =
    Math.floor(
      (finalDate.getTime() - cursor.getTime()) /
        86_400_000,
    ) + 1;

  if (difference > 90) {
    throw new ServiceError(
      "invalid_input",
      "Google Business analytics supports a maximum range of 90 days.",
      { status: 400 },
    );
  }

  const dates: string[] = [];

  while (cursor.getTime() <= finalDate.getTime()) {
    dates.push(isoDate(dateToParts(cursor)));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

async function requestJson(
  url: URL,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    const contentType =
      response.headers.get("content-type") ?? "";

    const body = contentType.includes(
      "application/json",
    )
      ? await response.json().catch(() => null)
      : null;

    const record = object(body);

    if (!response.ok || !record) {
      if (
        response.status === 401 ||
        response.status === 403
      ) {
        throw new ServiceError(
          "forbidden",
          "Google Business Profile authorization must be renewed.",
          { status: 401 },
        );
      }

      if (response.status === 429) {
        throw new ServiceError(
          "unavailable",
          "Google Business Profile is temporarily rate limited. Retry shortly.",
          { status: 503 },
        );
      }

      throw new ServiceError(
        "unavailable",
        "Google Business Profile analytics could not be loaded.",
        { status: 502 },
      );
    }

    return record;
  } catch (error) {
    if (error instanceof ServiceError) {
      throw error;
    }

    throw new ServiceError(
      "unavailable",
      error instanceof Error &&
        error.name === "AbortError"
        ? "Google Business Profile analytics timed out."
        : "Google Business Profile analytics could not be loaded.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const form = new URLSearchParams();

  form.set(
    "client_id",
    env("GOOGLE_SOCIAL_CLIENT_ID"),
  );
  form.set(
    "client_secret",
    env("GOOGLE_SOCIAL_CLIENT_SECRET"),
  );
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", refreshToken);

  const body = await requestJson(
    new URL(TOKEN_API),
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
  );

  const accessToken = text(body.access_token);
  const expiresIn =
    integer(body.expires_in) ?? 3600;

  if (!accessToken) {
    throw new ServiceError(
      "forbidden",
      "Google Business Profile authorization must be renewed.",
      { status: 401 },
    );
  }

  return {
    accessToken,
    expiresAt: new Date(
      Date.now() + expiresIn * 1000,
    ),
  };
}

export async function loadGoogleAccessToken(options: {
  clientId: string;
  connectionId: string;
}): Promise<string> {
  const prisma = getPrisma();

  if (!prisma) {
    throw new ServiceError(
      "unavailable",
      "The social connection database is unavailable.",
      { status: 503 },
    );
  }

  const connection =
    await prisma.socialProviderConnection.findFirst({
      where: {
        id: options.connectionId,
        clientId: options.clientId,
        provider: "google_business",
        status: "connected",
      },
      select: {
        id: true,
        provider: true,
        credential: {
          select: {
            id: true,
            connectionId: true,
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

  if (
    !connection ||
    !connection.credential ||
    connection.credential.status !== "active"
  ) {
    throw new ServiceError(
      "forbidden",
      "Google Business Profile is not connected.",
      { status: 401 },
    );
  }

  const credential =
    connection.credential as StoredCredential;

  const aad = buildSocialCredentialAad({
    clientId: options.clientId,
    connectionId: options.connectionId,
    provider: "google_business",
  });

  let payload: SocialTokenPayload;

  try {
    payload = decryptSocialTokenPayload(
      {
        ciphertext:
          credential.encryptedPayload,
        iv: credential.iv,
        authTag: credential.authTag,
        keyVersion: credential.keyVersion,
      },
      aad,
    );
  } catch {
    throw new ServiceError(
      "forbidden",
      "The Google Business Profile credential could not be read. Reconnect the account.",
      { status: 401 },
    );
  }

  const expiresSoon =
    !credential.tokenExpiresAt ||
    credential.tokenExpiresAt.getTime() <=
      Date.now() + 60_000;

  if (!expiresSoon && payload.accessToken) {
    return payload.accessToken;
  }

  if (!payload.refreshToken) {
    throw new ServiceError(
      "forbidden",
      "Google Business Profile authorization has expired. Reconnect the account.",
      { status: 401 },
    );
  }

  const refreshed =
    await refreshGoogleAccessToken(
      payload.refreshToken,
    );

  const refreshedPayload: SocialTokenPayload = {
    ...payload,
    accessToken: refreshed.accessToken,
    issuedAt: new Date().toISOString(),
  };

  const encrypted = encryptSocialTokenPayload(
    refreshedPayload,
    aad,
  );

  await prisma.$transaction([
    prisma.socialCredential.update({
      where: {
        id: credential.id,
      },
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
      where: {
        id: options.connectionId,
      },
      data: {
        accessTokenExpiresAt:
          refreshed.expiresAt,
        lastValidatedAt: new Date(),
        lastErrorCode: null,
        lastErrorMessage: null,
        lastErrorAt: null,
      },
    }),
  ]);

  return refreshed.accessToken;
}

function addDateQuery(
  url: URL,
  prefix: string,
  date: DateParts,
): void {
  url.searchParams.set(
    `${prefix}.year`,
    String(date.year),
  );
  url.searchParams.set(
    `${prefix}.month`,
    String(date.month),
  );
  url.searchParams.set(
    `${prefix}.day`,
    String(date.day),
  );
}

function readDatedValues(
  body: Record<string, unknown>,
): Map<string, Map<DailyMetric, number>> {
  const result =
    new Map<string, Map<DailyMetric, number>>();

  const seriesList =
    Array.isArray(
      body.multiDailyMetricTimeSeries,
    )
      ? body.multiDailyMetricTimeSeries
      : [];

  for (const seriesValue of seriesList) {
    const series = object(seriesValue);
    const metric = text(series?.dailyMetric);

    if (
      !metric ||
      !DAILY_METRICS.includes(
        metric as DailyMetric,
      )
    ) {
      continue;
    }

    const timeSeries = object(
      series?.timeSeries,
    );

    const datedValues =
      Array.isArray(timeSeries?.datedValues)
        ? timeSeries.datedValues
        : [];

    for (const datedValue of datedValues) {
      const record = object(datedValue);
      const date = object(record?.date);

      const year = integer(date?.year);
      const month = integer(date?.month);
      const day = integer(date?.day);

      if (!year || !month || !day) {
        continue;
      }

      const dateKey = isoDate({
        year,
        month,
        day,
      });

      const value = integer(record?.value);

      if (value === null) {
        continue;
      }

      const values =
        result.get(dateKey) ??
        new Map<DailyMetric, number>();

      values.set(metric as DailyMetric, value);
      result.set(dateKey, values);
    }
  }

  return result;
}

function metricValue(
  values: Map<DailyMetric, number>,
  metric: DailyMetric,
): number | null {
  return values.has(metric)
    ? values.get(metric) ?? null
    : null;
}

function sumKnown(
  values: Array<number | null>,
): number | null {
  const known = values.filter(
    (value): value is number =>
      typeof value === "number",
  );

  return known.length > 0
    ? known.reduce(
        (total, value) => total + value,
        0,
      )
    : null;
}

function readInsightsValue(
  raw: unknown,
): {
  value: number | null;
  threshold: number | null;
} {
  const record = object(raw);

  if (!record) {
    return {
      value: integer(raw),
      threshold: null,
    };
  }

  return {
    value: integer(record.value),
    threshold: integer(record.threshold),
  };
}

async function fetchKeywords(options: {
  locationName: string;
  accessToken: string;
  start: DateParts;
  end: DateParts;
}): Promise<GoogleBusinessKeyword[]> {
  const byKeyword =
    new Map<string, GoogleBusinessKeyword>();

  let pageToken: string | null = null;

  do {
    const url = new URL(
      `${PERFORMANCE_API}/${options.locationName}/searchkeywords/impressions/monthly`,
    );

    url.searchParams.set("pageSize", "100");

    url.searchParams.set(
      "monthlyRange.startMonth.year",
      String(options.start.year),
    );
    url.searchParams.set(
      "monthlyRange.startMonth.month",
      String(options.start.month),
    );
    url.searchParams.set(
      "monthlyRange.endMonth.year",
      String(options.end.year),
    );
    url.searchParams.set(
      "monthlyRange.endMonth.month",
      String(options.end.month),
    );

    if (pageToken) {
      url.searchParams.set(
        "pageToken",
        pageToken,
      );
    }

    const body = await requestJson(url, {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${options.accessToken}`,
      },
    });

    const rows =
      Array.isArray(body.searchKeywordsCounts)
        ? body.searchKeywordsCounts
        : [];

    for (const rowValue of rows) {
      const row = object(rowValue);
      const keyword = text(
        row?.searchKeyword,
      );

      if (!keyword) {
        continue;
      }

      const insights =
        readInsightsValue(row?.insightsValue);

      const existing =
        byKeyword.get(keyword);

      byKeyword.set(keyword, {
        keyword,
        impressions: sumKnown([
          existing?.impressions ?? null,
          insights.value,
        ]),
        threshold:
          insights.threshold ??
          existing?.threshold ??
          null,
      });
    }

    pageToken = text(body.nextPageToken);
  } while (pageToken);

  return Array.from(byKeyword.values())
    .sort((left, right) => {
      const rightValue =
        right.impressions ??
        right.threshold ??
        -1;
      const leftValue =
        left.impressions ??
        left.threshold ??
        -1;

      return rightValue - leftValue;
    })
    .slice(0, 100);
}

export async function fetchGoogleBusinessAnalytics(
  options: {
    clientId: string;
    connectionId: string;
    locationName: string;
    start: string;
    end: string;
  },
): Promise<GoogleBusinessAnalyticsResult> {
  if (
    !/^locations\/[^/]+$/.test(
      options.locationName,
    )
  ) {
    throw new ServiceError(
      "invalid_input",
      "The selected Google Business Profile location is invalid.",
      { status: 400 },
    );
  }

  const dates = enumerateDates(
    options.start,
    options.end,
  );

  const start = parseIsoDate(options.start);
  const end = parseIsoDate(options.end);

  const accessToken =
    await loadGoogleAccessToken({
      clientId: options.clientId,
      connectionId: options.connectionId,
    });

  const url = new URL(
    `${PERFORMANCE_API}/${options.locationName}:fetchMultiDailyMetricsTimeSeries`,
  );

  for (const metric of DAILY_METRICS) {
    url.searchParams.append(
      "dailyMetrics",
      metric,
    );
  }

  addDateQuery(
    url,
    "dailyRange.startDate",
    start,
  );

  addDateQuery(
    url,
    "dailyRange.endDate",
    end,
  );

  const body = await requestJson(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const valuesByDate = readDatedValues(body);

  const points = dates.map(
    (
      date,
    ): GoogleBusinessAnalyticsPoint => {
      const values =
        valuesByDate.get(date) ??
        new Map<DailyMetric, number>();

      const maps = sumKnown([
        metricValue(
          values,
          "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
        ),
        metricValue(
          values,
          "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
        ),
      ]);

      const search = sumKnown([
        metricValue(
          values,
          "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
        ),
        metricValue(
          values,
          "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
        ),
      ]);

      return {
        date,
        maps,
        search,
        website: metricValue(
          values,
          "WEBSITE_CLICKS",
        ),
        phone: metricValue(
          values,
          "CALL_CLICKS",
        ),
        directions: metricValue(
          values,
          "BUSINESS_DIRECTION_REQUESTS",
        ),
      };
    },
  );

  const keywords = await fetchKeywords({
    locationName: options.locationName,
    accessToken,
    start,
    end,
  });

  const maps = sumKnown(
    points.map((point) => point.maps),
  );

  const search = sumKnown(
    points.map((point) => point.search),
  );

  const website = sumKnown(
    points.map((point) => point.website),
  );

  const phone = sumKnown(
    points.map((point) => point.phone),
  );

  const directions = sumKnown(
    points.map((point) => point.directions),
  );

  return {
    range: {
      start: options.start,
      end: options.end,
    },
    totals: {
      maps,
      search,
      reach: sumKnown([maps, search]),
      website,
      phone,
      directions,
      clicks: sumKnown([
        website,
        phone,
        directions,
      ]),
    },
    points,
    keywords,
    dataAvailable:
      points.some((point) =>
        [
          point.maps,
          point.search,
          point.website,
          point.phone,
          point.directions,
        ].some(
          (value) =>
            typeof value === "number",
        ),
      ) || keywords.length > 0,
  };
}

const REVIEW_STARS: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export type GoogleBusinessReviewItem = {
  id: string;
  author: string;
  message: string;
  createdAt: string;
  rating: number | null;
  replied: boolean;
};

export type GoogleBusinessReviewsResult = {
  averageRating: number | null;
  total: number;
  items: GoogleBusinessReviewItem[];
};

function reviewDay(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function fetchGoogleBusinessReviews(options: {
  clientId: string;
  connectionId: string;
  socialAccountId: string;
  locationName: string;
  start: string;
  end: string;
}): Promise<GoogleBusinessReviewsResult> {
  const empty: GoogleBusinessReviewsResult = {
    averageRating: null,
    total: 0,
    items: [],
  };

  if (!/^locations\/[^/]+$/.test(options.locationName)) {
    return empty;
  }

  const prisma = getPrisma();
  if (!prisma) return empty;

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId,
      clientId: options.clientId,
      platform: "google_business",
    },
    select: { metadata: true },
  });

  const metadata = object(account?.metadata);
  const accountName = text(metadata?.googleAccountName);
  if (!accountName || !/^accounts\/[^/]+$/.test(accountName)) {
    return empty;
  }

  const accessToken = await loadGoogleAccessToken({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });

  const items: GoogleBusinessReviewItem[] = [];
  let pageToken: string | null = null;
  let pages = 0;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/${accountName}/${options.locationName}/reviews`,
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const body = await requestJson(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const rows = Array.isArray(body.reviews) ? body.reviews : [];
    for (const rowValue of rows) {
      const row = object(rowValue);
      if (!row) continue;
      const createdAt = text(row.createTime) ?? text(row.updateTime);
      const day = createdAt ? reviewDay(createdAt) : null;
      if (!createdAt || !day || day < options.start || day > options.end) {
        continue;
      }
      const reviewer = object(row.reviewer);
      const rating =
        REVIEW_STARS[text(row.starRating) ?? ""] ?? null;
      items.push({
        id: text(row.reviewId) ?? text(row.name) ?? `${createdAt}-${items.length}`,
        author: text(reviewer?.displayName) ?? "Google user",
        message: text(row.comment) ?? "",
        createdAt,
        rating,
        replied: object(row.reviewReply) !== null,
      });
    }

    pageToken = text(body.nextPageToken);
    pages += 1;
  } while (pageToken && pages < 4);

  items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const rated = items
    .map((item) => item.rating)
    .filter((value): value is number => value !== null);
  const averageRating = rated.length
    ? Math.round((rated.reduce((sum, value) => sum + value, 0) / rated.length) * 10) / 10
    : null;

  return {
    averageRating,
    total: items.length,
    items,
  };
}

export type GoogleBusinessMediaItem = {
  id: string;
  createdAt: string;
  views: number | null;
  type: "Photo" | "Video";
};

export type GoogleBusinessMediaResult = {
  total: number;
  items: GoogleBusinessMediaItem[];
};

export async function fetchGoogleBusinessMedia(options: {
  clientId: string;
  connectionId: string;
  socialAccountId: string;
  locationName: string;
  start: string;
  end: string;
}): Promise<GoogleBusinessMediaResult> {
  const empty: GoogleBusinessMediaResult = { total: 0, items: [] };

  if (!/^locations\/[^/]+$/.test(options.locationName)) {
    return empty;
  }

  const prisma = getPrisma();
  if (!prisma) return empty;

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId,
      clientId: options.clientId,
      platform: "google_business",
    },
    select: { metadata: true },
  });

  const metadata = object(account?.metadata);
  const accountName = text(metadata?.googleAccountName);
  if (!accountName || !/^accounts\/[^/]+$/.test(accountName)) {
    return empty;
  }

  const accessToken = await loadGoogleAccessToken({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });

  const items: GoogleBusinessMediaItem[] = [];
  let pageToken: string | null = null;
  let pages = 0;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/${accountName}/${options.locationName}/media`,
    );
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const body = await requestJson(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const rows = Array.isArray(body.mediaItems) ? body.mediaItems : [];
    for (const rowValue of rows) {
      const row = object(rowValue);
      if (!row) continue;
      const createdAt = text(row.createTime);
      const day = createdAt ? reviewDay(createdAt) : null;
      if (!createdAt || !day || day < options.start || day > options.end) {
        continue;
      }
      const format = text(row.mediaFormat);
      const insights = object(row.insights);
      items.push({
        id: text(row.name) ?? `${createdAt}-${items.length}`,
        createdAt,
        views: integer(insights?.viewCount),
        type: format === "VIDEO" ? "Video" : "Photo",
      });
    }

    pageToken = text(body.nextPageToken);
    pages += 1;
  } while (pageToken && pages < 4);

  items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return { total: items.length, items };
}

export type GoogleBusinessPostItem = {
  id: string;
  createdAt: string;
  visits: number | null;
  type: string;
  summary: string;
};

export type GoogleBusinessPostsResult = {
  total: number;
  items: GoogleBusinessPostItem[];
};

export async function fetchGoogleBusinessPosts(options: {
  clientId: string;
  connectionId: string;
  socialAccountId: string;
  locationName: string;
  start: string;
  end: string;
}): Promise<GoogleBusinessPostsResult> {
  const empty: GoogleBusinessPostsResult = { total: 0, items: [] };

  if (!/^locations\/[^/]+$/.test(options.locationName)) {
    return empty;
  }

  const prisma = getPrisma();
  if (!prisma) return empty;

  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId,
      clientId: options.clientId,
      platform: "google_business",
    },
    select: { metadata: true },
  });

  const metadata = object(account?.metadata);
  const accountName = text(metadata?.googleAccountName);
  if (!accountName || !/^accounts\/[^/]+$/.test(accountName)) {
    return empty;
  }

  const accessToken = await loadGoogleAccessToken({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });

  const items: GoogleBusinessPostItem[] = [];
  let pageToken: string | null = null;
  let pages = 0;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/${accountName}/${options.locationName}/localPosts`,
    );
    url.searchParams.set("pageSize", "100");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const body = await requestJson(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const rows = Array.isArray(body.localPosts) ? body.localPosts : [];
    for (const rowValue of rows) {
      const row = object(rowValue);
      if (!row) continue;
      const createdAt = text(row.createTime) ?? text(row.updateTime);
      const day = createdAt ? reviewDay(createdAt) : null;
      if (!createdAt || !day || day < options.start || day > options.end) {
        continue;
      }
      const media = Array.isArray(row.media) ? row.media : [];
      const formats = media
        .map((entry) => text(object(entry)?.mediaFormat))
        .filter((value): value is string => value !== null);
      const type = formats.includes("VIDEO")
        ? "Video"
        : formats.includes("PHOTO")
          ? "Photo"
          : "Post";
      items.push({
        id: text(row.name) ?? `${createdAt}-${items.length}`,
        createdAt,
        visits: integer(object(row.insights)?.viewCount),
        type,
        summary: text(row.summary) ?? "",
      });
    }

    pageToken = text(body.nextPageToken);
    pages += 1;
  } while (pageToken && pages < 4);

  items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return { total: items.length, items };
}
