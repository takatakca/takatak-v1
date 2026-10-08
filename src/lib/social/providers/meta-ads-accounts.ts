import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import {
  getMetaAdsOAuthRedirectUri,
  META_ADS_OAUTH_START_SCOPES,
} from "@/lib/social/providers/meta-ads-oauth";
import { getMetaGraphApiVersion } from "@/lib/social/providers/meta-oauth";
import {
  exchangeMetaAuthorizationCode,
  exchangeMetaLongLivedUserToken,
  fetchMetaAuthorizedUser,
  fetchMetaGrantedPermissions,
} from "@/lib/social/providers/meta-token";

const META_GRAPH_HOST = "https://graph.facebook.com";
const GRAPH_TIMEOUT_MS = 15_000;
const MAX_AD_ACCOUNT_PAGES = 4;

/** Closed, disabled, or pending-closure accounts are not offered for connection. */
const UNUSABLE_ACCOUNT_STATUSES = new Set([2, 100, 101, 202]);

export type MetaAdAccountRecord = {
  externalAccountId: string;
  displayName: string;
  currency: string;
  timezone: string;
  accountStatus: number;
};

export type MetaAdsTokenResult = {
  accessToken: string;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
  externalSubjectId: string;
  displayName: string | null;
  adAccounts: MetaAdAccountRecord[];
};

function graphUrl(path: string): URL {
  const version = getMetaGraphApiVersion();
  const url = new URL(`${META_GRAPH_HOST}/${version}${path}`);
  if (url.origin !== META_GRAPH_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Facebook Graph host is invalid.",
      { status: 503 },
    );
  }
  return url;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanDisplayName(value: string | null, externalAccountId: string): string {
  const cleaned = (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 120);
  if (!cleaned || cleaned === externalAccountId) {
    return "Meta ad account";
  }
  return cleaned;
}

export function mapMetaAdAccountFromRecord(
  value: unknown,
): MetaAdAccountRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const externalAccountId = readString(record, "id");
  if (!externalAccountId || !/^act_[0-9]{1,32}$/.test(externalAccountId)) {
    return null;
  }

  const statusRaw = record.account_status;
  const accountStatus =
    typeof statusRaw === "number" && Number.isInteger(statusRaw)
      ? statusRaw
      : 1;
  if (UNUSABLE_ACCOUNT_STATUSES.has(accountStatus)) {
    return null;
  }

  const currencyRaw = readString(record, "currency");
  const currency =
    currencyRaw && /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : "CAD";

  const timezoneRaw = readString(record, "timezone_name");
  const timezone =
    timezoneRaw && /^[A-Za-z0-9_/+-]{1,64}$/.test(timezoneRaw)
      ? timezoneRaw
      : "UTC";

  return {
    externalAccountId,
    displayName: cleanDisplayName(readString(record, "name"), externalAccountId),
    currency,
    timezone,
    accountStatus,
  };
}

export function assertMetaAdsReadScope(granted: readonly string[]): void {
  if (!granted.includes("ads_read")) {
    throw new ServiceError(
      "forbidden",
      "Meta Ads authorization is missing ad account access. Reconnect and allow ads access.",
    );
  }
}

async function fetchGraphPage(
  accessToken: string,
  after: string | null,
): Promise<Record<string, unknown>> {
  const url = graphUrl("/me/adaccounts");
  url.searchParams.set(
    "fields",
    "id,name,currency,timezone_name,account_status",
  );
  url.searchParams.set("limit", "50");
  if (after) {
    url.searchParams.set("after", after);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch {
    throw new ServiceError(
      "unavailable",
      "Meta Ads could not be reached.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "Meta Ads returned an unexpected response.",
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Meta Ads returned an incomplete response.",
      { status: 503 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "Meta Ads returned an incomplete response.",
      { status: 503 },
    );
  }

  const record = body as Record<string, unknown>;
  if (!response.ok || record.error) {
    const errorObj =
      typeof record.error === "object" &&
      record.error !== null &&
      !Array.isArray(record.error)
        ? (record.error as Record<string, unknown>)
        : null;
    const code = typeof errorObj?.code === "number" ? errorObj.code : null;
    if (code === 10 || code === 200 || code === 190) {
      throw new ServiceError(
        "forbidden",
        "Meta Ads authorization is missing ad account access. Reconnect and allow ads access.",
      );
    }
    throw new ServiceError(
      "unavailable",
      "Meta ad accounts could not be loaded.",
      { status: 503 },
    );
  }

  return record;
}

export async function listMetaAdAccounts(
  accessToken: string,
): Promise<MetaAdAccountRecord[]> {
  const accounts: MetaAdAccountRecord[] = [];
  const seenCursors = new Set<string>();
  let after: string | null = null;

  for (let page = 0; page < MAX_AD_ACCOUNT_PAGES; page += 1) {
    const record = await fetchGraphPage(accessToken, after);
    const data = record.data;
    if (Array.isArray(data)) {
      for (const entry of data) {
        const mapped = mapMetaAdAccountFromRecord(entry);
        if (!mapped) continue;
        if (accounts.some((item) => item.externalAccountId === mapped.externalAccountId)) {
          continue;
        }
        accounts.push(mapped);
      }
    }

    const paging =
      typeof record.paging === "object" &&
      record.paging !== null &&
      !Array.isArray(record.paging)
        ? (record.paging as Record<string, unknown>)
        : null;
    const cursors =
      paging &&
      typeof paging.cursors === "object" &&
      paging.cursors !== null &&
      !Array.isArray(paging.cursors)
        ? (paging.cursors as Record<string, unknown>)
        : null;
    const nextAfter = cursors ? readString(cursors, "after") : null;
    const hasNext = paging ? typeof paging.next === "string" : false;

    if (
      !hasNext ||
      !nextAfter ||
      nextAfter.length > 512 ||
      seenCursors.has(nextAfter)
    ) {
      break;
    }
    seenCursors.add(nextAfter);
    after = nextAfter;
  }

  return accounts;
}

export async function exchangeMetaAdsCode(options: {
  code: string;
  codeVerifier: string;
}): Promise<MetaAdsTokenResult> {
  const redirectUri = getMetaAdsOAuthRedirectUri();
  const shortLived = await exchangeMetaAuthorizationCode({
    code: options.code,
    codeVerifier: options.codeVerifier,
    redirectUri,
  });
  const longLived = await exchangeMetaLongLivedUserToken({
    shortLivedToken: shortLived.accessToken,
  });
  const accessToken = longLived.accessToken;
  const [user, granted] = await Promise.all([
    fetchMetaAuthorizedUser({ accessToken }),
    fetchMetaGrantedPermissions({ accessToken }),
  ]);

  assertMetaAdsReadScope(granted);
  const adAccounts = await listMetaAdAccounts(accessToken);

  const scopes = META_ADS_OAUTH_START_SCOPES.filter((scope) =>
    granted.includes(scope),
  );

  return {
    accessToken,
    tokenType: longLived.tokenType ?? shortLived.tokenType,
    expiresAt: longLived.expiresAt ?? shortLived.expiresAt,
    scopes: scopes.length > 0 ? [...scopes] : ["ads_read"],
    externalSubjectId: user.externalSubjectId,
    displayName: user.displayName,
    adAccounts,
  };
}
