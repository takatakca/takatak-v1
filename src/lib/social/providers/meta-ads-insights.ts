import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { ServiceError } from "@/lib/services/service-error";
import { getMetaGraphApiVersion } from "@/lib/social/providers/meta-oauth";
import {
  buildSocialCredentialAad,
  decryptSocialTokenPayload,
  type SocialTokenPayload,
} from "@/lib/social/security/social-crypto";

const GRAPH_HOST = "https://graph.facebook.com";
const LIVE_STATUSES = ["connected", "authorized", "reauthorization_required"] as const;

export type MetaAdsDailyPoint = {
  date: string;
  impressions: number | null;
  reach: number | null;
  spend: number | null;
  clicks: number | null;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
};

export type MetaAdsCampaignRow = {
  id: string;
  name: string;
  status: string | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  spend: number | null;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
};

export type MetaAdsAccountAnalytics = {
  accountName: string;
  currency: string;
  impressions: number | null;
  reach: number | null;
  spend: number | null;
  clicks: number | null;
  cpm: number | null;
  cpc: number | null;
  ctr: number | null;
  points: MetaAdsDailyPoint[];
  campaigns: MetaAdsCampaignRow[];
  campaignsConfirmed: boolean;
  notice: string | null;
};

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

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function readPagingNext(body: Record<string, unknown>): string | null {
  const paging = body.paging;
  if (typeof paging !== "object" || paging === null || Array.isArray(paging)) return null;
  const next = (paging as Record<string, unknown>).next;
  return typeof next === "string" && next.startsWith(`${GRAPH_HOST}/`) ? next : null;
}

async function graphFetch(
  url: string,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown>; denied: boolean }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("meta-ads-timeout"));
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
    const error =
      typeof body.error === "object" && body.error !== null && !Array.isArray(body.error)
        ? (body.error as Record<string, unknown>)
        : null;
    const code = typeof error?.code === "number" ? error.code : null;
    const denied = code === 10 || code === 190 || code === 200 || response.status === 401;
    return { status: response.status, body, denied };
  } catch {
    return { status: 504, body: {}, denied: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function graphGet(
  path: string,
  accessToken: string,
): Promise<{ status: number; body: Record<string, unknown>; denied: boolean }> {
  const version = getMetaGraphApiVersion().replace(/^\/+/, "");
  return graphFetch(`${GRAPH_HOST}/${version}${path}`, accessToken);
}

async function loadAccessToken(options: {
  clientId: string;
  connectionId: string;
}): Promise<string> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "The social connection database is unavailable.", {
      status: 503,
    });
  }
  const connection = await prisma.socialProviderConnection.findFirst({
    where: {
      id: options.connectionId,
      clientId: options.clientId,
      provider: "meta_ads",
      status: { in: [...LIVE_STATUSES] },
    },
    select: {
      credential: {
        select: {
          encryptedPayload: true,
          iv: true,
          authTag: true,
          keyVersion: true,
          status: true,
          tokenExpiresAt: true,
        },
      },
    },
  });
  if (!connection?.credential || connection.credential.status !== "active") {
    throw new ServiceError("forbidden", "Meta Ads is not connected.", { status: 401 });
  }
  if (
    connection.credential.tokenExpiresAt &&
    connection.credential.tokenExpiresAt.getTime() <= Date.now()
  ) {
    throw new ServiceError("forbidden", "Meta Ads authorization has expired. Reconnect the account.", {
      status: 401,
    });
  }
  try {
    const payload: SocialTokenPayload = decryptSocialTokenPayload(
      {
        ciphertext: connection.credential.encryptedPayload,
        iv: connection.credential.iv,
        authTag: connection.credential.authTag,
        keyVersion: connection.credential.keyVersion,
      },
      buildSocialCredentialAad({
        clientId: options.clientId,
        connectionId: options.connectionId,
        provider: "meta_ads",
      }),
    );
    if (!payload.accessToken) {
      throw new Error("missing");
    }
    return payload.accessToken;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      "forbidden",
      "The Meta Ads credential could not be read. Reconnect the account.",
      { status: 401 },
    );
  }
}

function rowsOf(body: Record<string, unknown>): Array<Record<string, unknown>> {
  if (!Array.isArray(body.data)) return [];
  return body.data.filter(
    (item): item is Record<string, unknown> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}

function readId(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === "string" && /^[0-9]{1,32}$/.test(value)) return value;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return String(value);
  return null;
}

function readName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 180);
  return cleaned || null;
}

function readStatus(record: Record<string, unknown>): string | null {
  const value = record.effective_status;
  return typeof value === "string" && /^[A-Z_]{1,40}$/.test(value) ? value : null;
}

async function followPages(
  first: { status: number; body: Record<string, unknown>; denied: boolean },
  accessToken: string,
  started: number,
): Promise<{
  denied: boolean;
  status: number;
  complete: boolean;
  rows: Array<Record<string, unknown>>;
}> {
  const rows = rowsOf(first.body);
  let denied = first.denied;
  let status = first.status;
  let nextPage = readPagingNext(first.body);
  while (nextPage && !denied && status < 400 && Date.now() - started < 12_000) {
    const page = await graphFetch(nextPage, accessToken);
    if (page.denied) {
      denied = true;
      break;
    }
    if (page.status >= 400) {
      status = page.status;
      break;
    }
    rows.push(...rowsOf(page.body));
    nextPage = readPagingNext(page.body);
  }
  return {
    denied,
    status,
    complete: !denied && status < 400 && nextPage == null,
    rows,
  };
}

export async function fetchMetaAdsAccountAnalytics(options: {
  clientId: string;
  connectionId: string;
  socialAccountId: string;
  start: string;
  end: string;
}): Promise<MetaAdsAccountAnalytics> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new ServiceError("unavailable", "The social connection database is unavailable.", {
      status: 503,
    });
  }
  const account = await prisma.socialAccount.findFirst({
    where: {
      id: options.socialAccountId,
      clientId: options.clientId,
      providerConnectionId: options.connectionId,
      platform: "meta_ads",
    },
    select: {
      displayName: true,
      externalAccountId: true,
      metadata: true,
    },
  });
  const adAccountId = account?.externalAccountId ?? "";
  if (!account || !/^act_[0-9]{1,32}$/.test(adAccountId)) {
    throw new ServiceError("not_found", "No connected Meta ad account is selected.", {
      status: 404,
    });
  }
  const currency =
    typeof account.metadata === "object" &&
    account.metadata !== null &&
    !Array.isArray(account.metadata) &&
    typeof (account.metadata as Record<string, unknown>).currency === "string"
      ? ((account.metadata as Record<string, unknown>).currency as string)
      : "CAD";

  const accessToken = await loadAccessToken({
    clientId: options.clientId,
    connectionId: options.connectionId,
  });
  const fields = "impressions,reach,spend,clicks,cpm,cpc,ctr";
  const timeRange = encodeURIComponent(
    JSON.stringify({ since: options.start, until: options.end }),
  );
  const base = `/${adAccountId}/insights?fields=${fields}&time_range=${timeRange}&level=account`;

  const started = Date.now();
  const campaignFields = "campaign_id,campaign_name,impressions,reach,spend,clicks,cpm,cpc,ctr";
  const [totalsResult, firstDaily, campaignListResult, campaignInsightResult] = await Promise.all([
    graphGet(base, accessToken),
    graphGet(`${base}&time_increment=1&limit=100`, accessToken),
    graphGet(
      `/${adAccountId}/campaigns?fields=id,name,effective_status&limit=100`,
      accessToken,
    ),
    graphGet(
      `/${adAccountId}/insights?fields=${campaignFields}&level=campaign&time_range=${timeRange}&limit=100`,
      accessToken,
    ),
  ]);
  const dailyPages = await followPages(firstDaily, accessToken, started);
  const campaignList = await followPages(campaignListResult, accessToken, started);
  const campaignInsights = await followPages(campaignInsightResult, accessToken, started);
  const dailyRows = new Map(
    dailyPages.rows.map((row) => [String(row.date_start ?? "").slice(0, 10), row]),
  );
  const dailyDenied = dailyPages.denied;
  const dailyStatus = dailyPages.status;
  const nextPage = dailyPages.complete ? null : "partial";

  if (totalsResult.denied || dailyDenied) {
    return {
      accountName: account.displayName ?? "Meta ad account",
      currency,
      impressions: null,
      reach: null,
      spend: null,
      clicks: null,
      cpm: null,
      cpc: null,
      ctr: null,
      points: dateKeys(options.start, options.end).map((date) => ({
        date,
        impressions: null,
        reach: null,
        spend: null,
        clicks: null,
        cpm: null,
        cpc: null,
        ctr: null,
      })),
      campaigns: [],
      campaignsConfirmed: false,
      notice:
        "Reconnect Meta Ads to grant ads read access. This page only shows numbers Meta returns.",
    };
  }

  const failed = totalsResult.status >= 400 && dailyStatus >= 400;
  const dailyOk = dailyStatus < 400;
  const confirmed = dailyOk && !nextPage;
  const points = dateKeys(options.start, options.end).map((date) => {
    const row = dailyRows.get(date);
    if (!dailyOk) {
      return {
        date,
        impressions: null,
        reach: null,
        spend: null,
        clicks: null,
        cpm: null,
        cpc: null,
        ctr: null,
      };
    }
    if (!row) {
      return confirmed
        ? {
            date,
            impressions: 0,
            reach: null,
            spend: 0,
            clicks: 0,
            cpm: null,
            cpc: null,
            ctr: null,
          }
        : {
            date,
            impressions: null,
            reach: null,
            spend: null,
            clicks: null,
            cpm: null,
            cpc: null,
            ctr: null,
          };
    }
    return {
      date,
      impressions: readNumber(row, "impressions") ?? 0,
      reach: readNumber(row, "reach"),
      spend: readNumber(row, "spend") ?? 0,
      clicks: readNumber(row, "clicks") ?? 0,
      cpm: readNumber(row, "cpm"),
      cpc: readNumber(row, "cpc"),
      ctr: readNumber(row, "ctr"),
    };
  });

  const statusById = new Map<string, string | null>();
  if (!campaignList.denied && campaignList.status < 400) {
    for (const row of campaignList.rows) {
      const id = readId(row, "id");
      if (id) statusById.set(id, readStatus(row));
    }
  }
  const campaigns: MetaAdsCampaignRow[] = [];
  if (!campaignInsights.denied && campaignInsights.status < 400) {
    for (const row of campaignInsights.rows) {
      const id = readId(row, "campaign_id");
      if (!id) continue;
      campaigns.push({
        id,
        name: readName(row.campaign_name) ?? "Campaign",
        status: statusById.get(id) ?? null,
        impressions: readNumber(row, "impressions") ?? 0,
        reach: readNumber(row, "reach"),
        clicks: readNumber(row, "clicks") ?? 0,
        spend: readNumber(row, "spend") ?? 0,
        cpm: readNumber(row, "cpm"),
        cpc: readNumber(row, "cpc"),
        ctr: readNumber(row, "ctr"),
      });
    }
  }
  const campaignsConfirmed =
    !campaignInsights.denied && campaignInsights.status < 400 && campaignInsights.complete;

  const total = rowsOf(totalsResult.body)[0];
  const sum = (key: "impressions" | "spend" | "clicks") =>
    confirmed ? points.reduce((totalValue, point) => totalValue + (point[key] ?? 0), 0) : null;

  return {
    accountName: account.displayName ?? "Meta ad account",
    currency,
    impressions: total ? (readNumber(total, "impressions") ?? sum("impressions")) : sum("impressions"),
    reach: total ? readNumber(total, "reach") : null,
    spend: total ? (readNumber(total, "spend") ?? sum("spend")) : sum("spend"),
    clicks: total ? (readNumber(total, "clicks") ?? sum("clicks")) : sum("clicks"),
    cpm: total ? readNumber(total, "cpm") : null,
    cpc: total ? readNumber(total, "cpc") : null,
    ctr: total ? readNumber(total, "ctr") : null,
    points,
    campaigns,
    campaignsConfirmed,
    notice: failed
      ? "Meta Ads did not return account insights for this period."
      : nextPage || !campaignInsights.complete
        ? "Meta returned only part of this period."
        : null,
  };
}
