import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { getGoogleSocialClientId } from "@/lib/social/providers/google-oauth";
import {
  getLookerStudioOAuthRedirectUri,
  LOOKER_STUDIO_API_HOST,
  LOOKER_STUDIO_OAUTH_SCOPE,
  LOOKER_STUDIO_OAUTH_START_SCOPES,
  LOOKER_STUDIO_REPORT_HOST,
} from "@/lib/social/providers/looker-studio-oauth";

const TOKEN_HOST = "https://oauth2.googleapis.com";
const USERINFO_HOST = "https://openidconnect.googleapis.com";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_REPORTS = 40;
const MAX_SEARCH_PAGES = 2;

const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,190}$/;

export type LookerStudioReportRecord = {
  externalAccountId: string;
  displayName: string;
  owner: string;
  reportUrl: string;
};

export type LookerStudioTokenResult = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
  externalSubjectId: string;
  displayName: string | null;
  reports: LookerStudioReportRecord[];
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
      "Looker Studio authorization is not configured.",
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
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseScopes(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseLookerStudioAssetId(value: string): string | null {
  const trimmed = value.trim().replace(/^assets\//, "");
  if (!ASSET_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}

export function lookerStudioReportUrl(assetId: string): string | null {
  const id = parseLookerStudioAssetId(assetId);
  if (!id) return null;
  const url = new URL(`${LOOKER_STUDIO_REPORT_HOST}/reporting/${id}`);
  if (url.origin !== LOOKER_STUDIO_REPORT_HOST) return null;
  if (url.pathname !== `/reporting/${id}`) return null;
  if (url.search || url.hash) return null;
  return url.href;
}

function cleanDisplayName(value: string | null): string {
  const cleaned = (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 120);
  return cleaned || "Looker Studio report";
}

function cleanOwner(value: string | null): string {
  const cleaned = (value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 254);
  return EMAIL_PATTERN.test(cleaned) ? cleaned : "Google account";
}

export function mapLookerStudioAssetFromRecord(
  value: unknown,
): LookerStudioReportRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (record.trashed === true) return null;

  const assetType = readString(record, "assetType");
  if (assetType && assetType !== "REPORT") return null;

  const externalAccountId = parseLookerStudioAssetId(
    readString(record, "name") ?? "",
  );
  if (!externalAccountId) return null;

  const reportUrl = lookerStudioReportUrl(externalAccountId);
  if (!reportUrl) return null;

  return {
    externalAccountId,
    displayName: cleanDisplayName(readString(record, "title")),
    owner: cleanOwner(readString(record, "owner")),
    reportUrl,
  };
}

export function assertLookerStudioReadScope(granted: readonly string[]): void {
  const allowed =
    granted.includes(LOOKER_STUDIO_OAUTH_SCOPE) ||
    granted.includes("https://www.googleapis.com/auth/datastudio");
  if (!allowed) {
    throw new ServiceError(
      "forbidden",
      "Looker Studio authorization is missing report access. Reconnect and allow Looker Studio access.",
    );
  }
}

async function fetchJson(
  url: string,
  init: RequestInit,
  stage: string,
): Promise<Record<string, unknown>> {
  const parsed = new URL(url);
  const allowed =
    parsed.origin === TOKEN_HOST ||
    parsed.origin === USERINFO_HOST ||
    parsed.origin === LOOKER_STUDIO_API_HOST;
  if (!allowed) {
    throw new ServiceError(
      "unavailable",
      "Looker Studio could not be reached.",
      { status: 503 },
    );
  }

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
      "Looker Studio could not be reached.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "Looker Studio returned an unexpected response.",
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Looker Studio returned an incomplete response.",
      { status: 503 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "Looker Studio returned an incomplete response.",
      { status: 503 },
    );
  }

  const record = body as Record<string, unknown>;
  if (!response.ok || record.error) {
    const errorCode = readString(record, "error");
    logSocialOAuthEvent("looker-studio-accounts", {
      stage,
      outcome:
        response.status === 401 || response.status === 403
          ? "forbidden"
          : "failed",
      provider: "looker_studio",
    });

    if (errorCode === "invalid_grant" || errorCode === "invalid_request") {
      throw new ServiceError(
        "invalid_input",
        "Looker Studio authorization expired. Start again.",
      );
    }

    if (
      stage === "list_reports" &&
      (response.status === 401 || response.status === 403)
    ) {
      throw new ServiceError(
        "forbidden",
        "Looker Studio access was denied. A Google Workspace admin must allow this app to read Looker Studio reports, then connect again.",
      );
    }

    if (stage === "code_exchange" || stage === "userinfo") {
      throw new ServiceError(
        "unavailable",
        "Looker Studio authorization could not be completed. You can retry.",
        { status: 503 },
      );
    }

    throw new ServiceError(
      "unavailable",
      "Looker Studio reports could not be loaded.",
      { status: 503 },
    );
  }

  return record;
}

function lookerStudioSearchUrl(pageToken: string | null): string {
  const url = new URL(`${LOOKER_STUDIO_API_HOST}/v1/assets:search`);
  if (url.origin !== LOOKER_STUDIO_API_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Looker Studio API host is invalid.",
      { status: 503 },
    );
  }
  url.searchParams.set("assetTypes", "REPORT");
  url.searchParams.set("pageSize", "40");
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }
  return url.toString();
}

export async function listLookerStudioReports(
  accessToken: string,
): Promise<LookerStudioReportRecord[]> {
  const reports: LookerStudioReportRecord[] = [];
  let pageToken: string | null = null;

  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const record = await fetchJson(
      lookerStudioSearchUrl(pageToken),
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      "list_reports",
    );

    const assets = record.assets;
    if (Array.isArray(assets)) {
      for (const asset of assets) {
        if (reports.length >= MAX_REPORTS) break;
        const mapped = mapLookerStudioAssetFromRecord(asset);
        if (!mapped) continue;
        if (
          reports.some(
            (item) => item.externalAccountId === mapped.externalAccountId,
          )
        ) {
          continue;
        }
        reports.push(mapped);
      }
    }

    if (reports.length >= MAX_REPORTS) break;

    const next = readString(record, "nextPageToken");
    if (!next || next.length > 512 || /[\s\u0000-\u001F]/.test(next)) break;
    if (next === pageToken) break;
    pageToken = next;
  }

  return reports;
}

export async function exchangeLookerStudioCode(options: {
  code: string;
  codeVerifier: string;
}): Promise<LookerStudioTokenResult> {
  const code = options.code.replace(/#_+$/, "").trim();
  const codeVerifier = options.codeVerifier.trim();
  if (!code || !codeVerifier) {
    throw new ServiceError(
      "invalid_input",
      "Looker Studio authorization did not return a usable code.",
    );
  }

  const form = new URLSearchParams();
  form.set("client_id", getGoogleSocialClientId());
  form.set("client_secret", getGoogleSocialClientSecret());
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", getLookerStudioOAuthRedirectUri());
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
  assertLookerStudioReadScope(scopes);

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

  const reports = await listLookerStudioReports(accessToken);
  const storedScopes = LOOKER_STUDIO_OAUTH_START_SCOPES.filter((scope) =>
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
    scopes:
      storedScopes.length > 0 ? [...storedScopes] : [LOOKER_STUDIO_OAUTH_SCOPE],
    externalSubjectId,
    displayName: readString(userinfo, "name") || readString(userinfo, "email"),
    reports,
  };
}
