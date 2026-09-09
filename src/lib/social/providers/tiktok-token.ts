import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  getTikTokClientKey,
  getTikTokOAuthRedirectUri,
  TIKTOK_OAUTH_START_SCOPES,
} from "@/lib/social/providers/tiktok-oauth";

const TOKEN_HOST = "https://open.tiktokapis.com";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getTikTokClientSecret(): string {
  const secret = trimEnv("TIKTOK_CLIENT_SECRET");
  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "TikTok authorization is not configured.",
      { status: 503 },
    );
  }
  return secret;
}

export class TikTokTokenConsumedError extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "TikTokTokenConsumedError";
  }
}

export type TikTokTokenExchangeResult = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  refreshExpiresAt: Date | null;
  scopes: string[];
  externalSubjectId: string;
  displayName: string | null;
  handle: string | null;
  profileImageUrl: string | null;
};

function readString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function readPositiveSeconds(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function unwrapUserRecord(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const data = body.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }
  const user = (data as Record<string, unknown>).user;
  if (typeof user === "object" && user !== null && !Array.isArray(user)) {
    return user as Record<string, unknown>;
  }
  return data as Record<string, unknown>;
}

function tikTokErrorMessage(record: Record<string, unknown>): string {
  const nested =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;
  return (
    readString(nested ?? {}, "message") ??
    readString(record, "error_description") ??
    readString(record, "error") ??
    ""
  ).toLowerCase();
}

function tikTokErrorCode(record: Record<string, unknown>): string | null {
  const nested =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;
  return (
    readString(nested ?? {}, "code") ??
    (typeof record.error === "string" ? record.error.trim() : null)
  );
}

function isTikTokApiError(
  responseOk: boolean,
  record: Record<string, unknown>,
): boolean {
  if (!responseOk) return true;
  const code = tikTokErrorCode(record);
  if (!code) return Boolean(record.error);
  return code.toLowerCase() !== "ok";
}

async function fetchJson(
  url: string,
  init: RequestInit,
  stage: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TOKEN_REQUEST_TIMEOUT_MS,
  );

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
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ServiceError(
        "unavailable",
        "TikTok authorization timed out. You can retry.",
        { status: 503 },
      );
    }
    throw new ServiceError(
      "unavailable",
      "TikTok authorization could not be completed. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "TikTok returned an unexpected authorization response.",
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "TikTok returned an invalid authorization response.",
      { status: 502 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "TikTok returned an incomplete authorization response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;

  if (isTikTokApiError(response.ok, record)) {
    const message = tikTokErrorMessage(record);

    logSocialOAuthEvent("tiktok-token", {
      stage,
      outcome: "failed",
      provider: "tiktok",
    });

    if (
      message.includes("code") &&
      (message.includes("expired") ||
        message.includes("invalid") ||
        message.includes("used"))
    ) {
      throw new TikTokTokenConsumedError(
        "TikTok authorization code is no longer valid. Reconnect again.",
      );
    }

    throw new ServiceError(
      "unavailable",
      "TikTok authorization failed temporarily. You can retry.",
      { status: 503 },
    );
  }

  return record;
}

export function mapTikTokIdentityFromRecord(
  raw: Record<string, unknown>,
): {
  externalSubjectId: string;
  handle: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
} | null {
  const id = readString(raw, "open_id") || readString(raw, "union_id");
  if (!id) return null;
  const handle = readString(raw, "username");
  const name = readString(raw, "display_name");
  return {
    externalSubjectId: id,
    handle,
    displayName: name || handle,
    profileImageUrl: readString(raw, "avatar_url"),
  };
}

export async function exchangeTikTokCodeForStoredCredential(options: {
  code: string;
}): Promise<TikTokTokenExchangeResult> {
  const code = options.code.replace(/#_+$/, "").trim();
  if (!code) {
    throw new ServiceError(
      "invalid_input",
      "TikTok authorization did not return a usable code.",
    );
  }

  const form = new URLSearchParams();
  form.set("client_key", getTikTokClientKey());
  form.set("client_secret", getTikTokClientSecret());
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", getTikTokOAuthRedirectUri());
  form.set("code", code);

  const tokenRecord = await fetchJson(
    `${TOKEN_HOST}/v2/oauth/token/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
    "token",
  );

  const accessToken = readString(tokenRecord, "access_token");
  if (!accessToken) {
    throw new ServiceError(
      "unavailable",
      "TikTok did not return an access token.",
      { status: 502 },
    );
  }

  const expiresIn = readPositiveSeconds(tokenRecord, "expires_in");
  const refreshExpiresIn = readPositiveSeconds(
    tokenRecord,
    "refresh_expires_in",
  );
  const now = Date.now();

  const meUrl = new URL(`${TOKEN_HOST}/v2/user/info/`);
  meUrl.searchParams.set(
    "fields",
    "open_id,union_id,avatar_url,display_name,username",
  );

  const me = await fetchJson(
    meUrl.toString(),
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    "me",
  );

  const identity = mapTikTokIdentityFromRecord(unwrapUserRecord(me) ?? me);
  if (!identity) {
    throw new ServiceError(
      "unavailable",
      "TikTok did not return a usable account.",
      { status: 502 },
    );
  }

  const scope = readString(tokenRecord, "scope");
  const scopes = scope
    ? scope.split(/[,\s]+/).filter(Boolean)
    : [...TIKTOK_OAUTH_START_SCOPES];

  return {
    accessToken,
    refreshToken: readString(tokenRecord, "refresh_token"),
    tokenType: readString(tokenRecord, "token_type") || "Bearer",
    expiresAt: expiresIn ? new Date(now + expiresIn * 1000) : null,
    refreshExpiresAt: refreshExpiresIn
      ? new Date(now + refreshExpiresIn * 1000)
      : null,
    scopes,
    externalSubjectId: identity.externalSubjectId,
    displayName: identity.displayName,
    handle: identity.handle,
    profileImageUrl: identity.profileImageUrl,
  };
}
