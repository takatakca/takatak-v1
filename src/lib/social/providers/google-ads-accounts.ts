import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { getGoogleSocialClientId } from "@/lib/social/providers/google-oauth";
import {
  getGoogleAdsDeveloperToken,
  getGoogleAdsOAuthRedirectUri,
  GOOGLE_ADS_OAUTH_SCOPE,
  GOOGLE_ADS_OAUTH_START_SCOPES,
  googleAdsApiUrl,
} from "@/lib/social/providers/google-ads-oauth";

const TOKEN_HOST = "https://oauth2.googleapis.com";
const USERINFO_HOST = "https://openidconnect.googleapis.com";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ACCESSIBLE_CUSTOMERS = 25;
const MAX_ACCOUNTS = 40;
const MAX_MANAGER_DEPTH = 2;
const MAX_SEARCH_PAGES = 2;

export type GoogleAdAccountRecord = {
  externalAccountId: string;
  displayName: string;
  currency: string;
  timezone: string;
  testAccount: boolean;
};

export type GoogleAdsCustomerView = GoogleAdAccountRecord & {
  manager: boolean;
};

export type GoogleAdsTokenResult = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
  externalSubjectId: string;
  displayName: string | null;
  adAccounts: GoogleAdAccountRecord[];
};

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getGoogleSocialClientSecret(): string {
  const secret = trimEnv("GOOGLE_SOCIAL_CLIENT_SECRET");
  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "Google Ads authorization is not configured.",
      { status: 503 },
    );
  }
  return secret;
}

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return null;
}

function readBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | null {
  const value = record[key];
  return typeof value === "boolean" ? value : null;
}

function parseScopes(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseGoogleAdsCustomerId(value: string): string | null {
  const trimmed = value.trim();
  const fromResource = /^customers\/([0-9]{7,10})$/.exec(trimmed);
  if (fromResource) return fromResource[1] ?? null;
  if (/^[0-9]{7,10}$/.test(trimmed)) return trimmed;
  return null;
}

function cleanDisplayName(value: string | null, externalAccountId: string): string {
  const cleaned = (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 120);
  const dashed = externalAccountId.replace(
    /^(\d{3})(\d{3})(\d{4})$/,
    "$1-$2-$3",
  );
  if (
    !cleaned ||
    cleaned === externalAccountId ||
    cleaned === dashed ||
    cleaned.replace(/-/g, "") === externalAccountId
  ) {
    return "Google Ads account";
  }
  return cleaned;
}

function readCustomerId(record: Record<string, unknown>): string | null {
  const resourceName = readString(record, "resourceName");
  if (resourceName) {
    const parsed = parseGoogleAdsCustomerId(resourceName);
    if (parsed) return parsed;
  }
  const id = readString(record, "id");
  return id ? parseGoogleAdsCustomerId(id) : null;
}

function readAccountFields(
  record: Record<string, unknown>,
): GoogleAdAccountRecord | null {
  const externalAccountId = readCustomerId(record);
  if (!externalAccountId) return null;

  if (readString(record, "status") !== "ENABLED") return null;

  const currencyRaw = readString(record, "currencyCode");
  const currency =
    currencyRaw && /^[A-Z]{3}$/.test(currencyRaw) ? currencyRaw : "CAD";
  const timezoneRaw = readString(record, "timeZone");
  const timezone =
    timezoneRaw && /^[A-Za-z0-9_/+-]{1,64}$/.test(timezoneRaw)
      ? timezoneRaw
      : "UTC";

  return {
    externalAccountId,
    displayName: cleanDisplayName(
      readString(record, "descriptiveName"),
      externalAccountId,
    ),
    currency,
    timezone,
    testAccount: readBoolean(record, "testAccount") === true,
  };
}

export function mapGoogleAdsCustomerFromRecord(
  value: unknown,
): GoogleAdsCustomerView | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const wrapper = value as Record<string, unknown>;
  const nested = wrapper.customer;
  const record =
    typeof nested === "object" && nested !== null && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : wrapper;

  const account = readAccountFields(record);
  if (!account) return null;

  const manager = readBoolean(record, "manager");
  if (manager === null) return null;

  return { ...account, manager };
}

export function selectableGoogleAdAccount(
  view: GoogleAdsCustomerView,
): GoogleAdAccountRecord | null {
  if (view.manager) return null;
  return {
    externalAccountId: view.externalAccountId,
    displayName: view.displayName,
    currency: view.currency,
    timezone: view.timezone,
    testAccount: view.testAccount,
  };
}

export function mapGoogleAdsClientFromRecord(
  value: unknown,
): GoogleAdAccountRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const wrapper = value as Record<string, unknown>;
  const nested = wrapper.customerClient;
  const record =
    typeof nested === "object" && nested !== null && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : wrapper;

  if (readBoolean(record, "hidden") === true) return null;
  if (readBoolean(record, "manager") !== false) return null;

  const levelRaw = record.level;
  const level =
    typeof levelRaw === "number"
      ? levelRaw
      : typeof levelRaw === "string"
        ? Number.parseInt(levelRaw, 10)
        : 1;
  if (!Number.isInteger(level) || level <= 0) return null;

  return readAccountFields(record);
}

export function assertGoogleAdsReadScope(granted: readonly string[]): void {
  if (!granted.includes(GOOGLE_ADS_OAUTH_SCOPE)) {
    throw new ServiceError(
      "forbidden",
      "Google Ads authorization is missing ad account access. Reconnect and allow Google Ads access.",
    );
  }
}

async function fetchJson(
  url: string,
  init: RequestInit,
  stage: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ServiceError(
      "unavailable",
      "Google Ads could not be reached.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "Google Ads returned an unexpected response.",
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Google Ads returned an incomplete response.",
      { status: 503 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "Google Ads returned an incomplete response.",
      { status: 503 },
    );
  }

  const record = body as Record<string, unknown>;
  if (!response.ok || record.error) {
    console.error("[google-ads-api-error]", JSON.stringify({ stage, status: response.status, body: record }, null, 2));
    const errorCode = readString(record, "error");
    logSocialOAuthEvent("google-ads-accounts", {
      stage,
      outcome:
        response.status === 401 || response.status === 403
          ? "forbidden"
          : "failed",
      provider: "google_ads",
    });

    if (errorCode === "invalid_grant" || errorCode === "invalid_request") {
      throw new ServiceError(
        "invalid_input",
        "Google Ads authorization expired. Start again.",
      );
    }

    if (
      stage === "list_accessible" &&
      (response.status === 401 || response.status === 403)
    ) {
      throw new ServiceError(
        "forbidden",
        "Google Ads authorization is missing ad account access. Reconnect and allow Google Ads access.",
      );
    }

    if (stage === "code_exchange" || stage === "userinfo") {
      throw new ServiceError(
        "unavailable",
        "Google Ads authorization could not be completed. You can retry.",
        { status: 503 },
      );
    }

    throw new ServiceError(
      "unavailable",
      "Google Ads accounts could not be loaded.",
      { status: 503 },
    );
  }

  return record;
}

function googleAdsRequestHeaders(accessToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  const developerToken = getGoogleAdsDeveloperToken();
  if (developerToken) headers["developer-token"] = developerToken;
  return headers;
}

async function searchGoogleAds(options: {
  accessToken: string;
  customerId: string;
  loginCustomerId: string | null;
  query: string;
}): Promise<Record<string, unknown>[]> {
  const customerId = parseGoogleAdsCustomerId(options.customerId);
  if (!customerId) {
    throw new ServiceError(
      "unavailable",
      "Google Ads accounts could not be loaded.",
      { status: 503 },
    );
  }

  const rows: Record<string, unknown>[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const url = googleAdsApiUrl(`/customers/${customerId}/googleAds:search`);
    const headers: Record<string, string> = {
      ...googleAdsRequestHeaders(options.accessToken),
      "Content-Type": "application/json",
    };
    if (options.loginCustomerId) {
      headers["login-customer-id"] = options.loginCustomerId;
    }

    const record = await fetchJson(
      url.toString(),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: options.query,
          ...(pageToken ? { pageToken } : {}),
        }),
      },
      "search",
    );

    const results = record.results;
    if (Array.isArray(results)) {
      for (const entry of results) {
        if (
          typeof entry === "object" &&
          entry !== null &&
          !Array.isArray(entry)
        ) {
          rows.push(entry as Record<string, unknown>);
        }
      }
    }

    const next = readString(record, "nextPageToken");
    if (!next || next.length > 512 || next === pageToken) break;
    pageToken = next;
  }

  return rows;
}

async function listAccessibleCustomerIds(
  accessToken: string,
): Promise<string[]> {
  const url = googleAdsApiUrl("/customers:listAccessibleCustomers");
  const record = await fetchJson(
    url.toString(),
    {
      method: "GET",
      headers: googleAdsRequestHeaders(accessToken),
    },
    "list_accessible",
  );

  const names = record.resourceNames;
  if (!Array.isArray(names)) return [];

  const ids: string[] = [];
  for (const name of names) {
    if (typeof name !== "string") continue;
    const id = parseGoogleAdsCustomerId(name);
    if (!id || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= MAX_ACCESSIBLE_CUSTOMERS) break;
  }
  return ids;
}

const CUSTOMER_QUERY =
  "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.status, customer.test_account FROM customer LIMIT 1";

const CLIENT_QUERY =
  "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.status, customer_client.hidden, customer_client.level, customer_client.test_account FROM customer_client WHERE customer_client.level <= 1";

function pushAccount(
  accounts: GoogleAdAccountRecord[],
  account: GoogleAdAccountRecord,
): void {
  if (accounts.length >= MAX_ACCOUNTS) return;
  if (accounts.some((item) => item.externalAccountId === account.externalAccountId)) {
    return;
  }
  accounts.push(account);
}

async function expandManager(options: {
  accessToken: string;
  managerId: string;
  loginCustomerId: string;
  depth: number;
  accounts: GoogleAdAccountRecord[];
}): Promise<void> {
  if (options.depth <= 0 || options.accounts.length >= MAX_ACCOUNTS) return;

  const rows = await searchGoogleAds({
    accessToken: options.accessToken,
    customerId: options.managerId,
    loginCustomerId: options.loginCustomerId,
    query: CLIENT_QUERY,
  });

  const nestedManagers: string[] = [];
  for (const row of rows) {
    const client = mapGoogleAdsClientFromRecord(row);
    if (client) {
      pushAccount(options.accounts, client);
      continue;
    }

    const nested = row.customerClient;
    if (typeof nested !== "object" || nested === null || Array.isArray(nested)) {
      continue;
    }
    const record = nested as Record<string, unknown>;
    if (readBoolean(record, "manager") !== true) continue;
    if (readBoolean(record, "hidden") === true) continue;
    if (readString(record, "status") !== "ENABLED") continue;
    const id = readCustomerId(record);
    if (!id || id === options.managerId || nestedManagers.includes(id)) continue;
    nestedManagers.push(id);
  }

  for (const nestedId of nestedManagers) {
    await expandManager({
      accessToken: options.accessToken,
      managerId: nestedId,
      loginCustomerId: options.loginCustomerId,
      depth: options.depth - 1,
      accounts: options.accounts,
    });
  }
}

export async function listGoogleAdAccounts(
  accessToken: string,
): Promise<GoogleAdAccountRecord[]> {
  const accessible = await listAccessibleCustomerIds(accessToken);
  const accounts: GoogleAdAccountRecord[] = [];
  let failures = 0;

  for (const customerId of accessible) {
    try {
      const rows = await searchGoogleAds({
        accessToken,
        customerId,
        loginCustomerId: null,
        query: CUSTOMER_QUERY,
      });
      const view = rows.length > 0 ? mapGoogleAdsCustomerFromRecord(rows[0]) : null;
      if (!view) continue;

      const selectable = selectableGoogleAdAccount(view);
      if (selectable) {
        pushAccount(accounts, selectable);
        continue;
      }

      await expandManager({
        accessToken,
        managerId: customerId,
        loginCustomerId: customerId,
        depth: MAX_MANAGER_DEPTH,
        accounts,
      });
    } catch {
      failures += 1;
    }
  }

  if (accounts.length === 0 && failures > 0 && failures === accessible.length) {
    throw new ServiceError(
      "unavailable",
      "Google Ads accounts could not be loaded.",
      { status: 503 },
    );
  }

  return accounts;
}

export async function exchangeGoogleAdsCode(options: {
  code: string;
  codeVerifier: string;
}): Promise<GoogleAdsTokenResult> {
  const code = options.code.replace(/#_+$/, "").trim();
  const codeVerifier = options.codeVerifier.trim();
  if (!code || !codeVerifier) {
    throw new ServiceError(
      "invalid_input",
      "Google Ads authorization did not return a usable code.",
    );
  }

  const form = new URLSearchParams();
  form.set("client_id", getGoogleSocialClientId());
  form.set("client_secret", getGoogleSocialClientSecret());
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", getGoogleAdsOAuthRedirectUri());
  form.set("code", code);
  form.set("code_verifier", codeVerifier);

  const tokenRecord = await fetchJson(
    `${TOKEN_HOST}/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
    "code_exchange",
  );

  const accessToken = readString(tokenRecord, "access_token");
  if (!accessToken) {
    throw new ServiceError(
      "unavailable",
      "Google did not return an access token.",
      { status: 502 },
    );
  }

  const scopes = parseScopes(readString(tokenRecord, "scope"));
  assertGoogleAdsReadScope(scopes);

  const expiresInRaw = tokenRecord.expires_in;
  const expiresIn =
    typeof expiresInRaw === "number" && Number.isFinite(expiresInRaw)
      ? expiresInRaw
      : typeof expiresInRaw === "string"
        ? Number.parseInt(expiresInRaw, 10)
        : NaN;

  const userinfo = await fetchJson(
    `${USERINFO_HOST}/v1/userinfo`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    "userinfo",
  );

  const externalSubjectId = readString(userinfo, "sub");
  if (!externalSubjectId) {
    throw new ServiceError(
      "unavailable",
      "Google did not return an account identity.",
      { status: 502 },
    );
  }

  const adAccounts = await listGoogleAdAccounts(accessToken);
  const storedScopes = GOOGLE_ADS_OAUTH_START_SCOPES.filter((scope) =>
    scopes.includes(scope),
  );

  return {
    accessToken,
    refreshToken: readString(tokenRecord, "refresh_token"),
    tokenType: readString(tokenRecord, "token_type"),
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
    scopes: storedScopes.length > 0 ? [...storedScopes] : [GOOGLE_ADS_OAUTH_SCOPE],
    externalSubjectId,
    displayName: readString(userinfo, "name") || readString(userinfo, "email"),
    adAccounts,
  };
}
