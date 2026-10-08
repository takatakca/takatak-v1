import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import { isTwitchHostedImageUrl } from "@/lib/social/media/remote-image";
import {
  getTwitchClientId,
  getTwitchOauthRedirectUri,
  TWITCH_OAUTH_START_SCOPES,
} from "@/lib/social/providers/twitch-oauth";

const TOKEN_HOST = "https://id.twitch.tv";
const HELIX_HOST = "https://api.twitch.tv";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getTwitchClientSecret(): string {
  const secret = trimEnv("TWITCH_CLIENT_SECRET");
  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "Twitch authorization is not configured.",
      { status: 503 },
    );
  }
  return secret;
}

export type TwitchTokenExchangeResult = {
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

function twitchErrorCode(record: Record<string, unknown>): string | null {
  return readString(record, "error");
}

function twitchErrorMessage(record: Record<string, unknown>): string {
  return (
    readString(record, "message") ??
    readString(record, "error_description") ??
    readString(record, "error") ??
    ""
  ).toLowerCase();
}

function readScopes(record: Record<string, unknown>): string[] {
  const scope = record.scope;
  if (Array.isArray(scope)) {
    return scope
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof scope === "string" && scope.trim()) {
    return scope.split(/[,\s]+/).filter(Boolean);
  }
  return [...TWITCH_OAUTH_START_SCOPES];
}

function safeProfileImage(value: string | null): string | null {
  if (!value || !isTwitchHostedImageUrl(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
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
        "Twitch authorization timed out. You can retry.",
        { status: 503 },
      );
    }
    throw new ServiceError(
      "unavailable",
      "Twitch authorization could not be completed. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "Twitch returned an unexpected authorization response.",
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Twitch returned an invalid authorization response.",
      { status: 502 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "Twitch returned an incomplete authorization response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;
  const errorCode = twitchErrorCode(record);
  const message = twitchErrorMessage(record);

  if (!response.ok || errorCode) {
    logSocialOAuthEvent("twitch-token", {
      stage,
      outcome: "failed",
      provider: "twitch",
    });

    if (
      errorCode === "invalid_grant" ||
      errorCode === "invalid_request" ||
      (message.includes("code") &&
        (message.includes("expired") ||
          message.includes("invalid") ||
          message.includes("used")))
    ) {
      throw new ServiceError(
        "invalid_input",
        "Twitch authorization code is no longer valid. Reconnect again.",
      );
    }

    throw new ServiceError(
      "unavailable",
      "Twitch authorization failed temporarily. You can retry.",
      { status: 503 },
    );
  }

  return record;
}

export function mapTwitchIdentityFromRecord(
  raw: Record<string, unknown>,
): {
  externalSubjectId: string;
  handle: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
} | null {
  const id = readString(raw, "id");
  if (!id) return null;
  const handle = readString(raw, "login");
  const name = readString(raw, "display_name");
  return {
    externalSubjectId: id,
    handle,
    displayName: name || handle,
    profileImageUrl: safeProfileImage(readString(raw, "profile_image_url")),
  };
}

function firstHelixUser(
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const data = body.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  if (typeof first !== "object" || first === null || Array.isArray(first)) {
    return null;
  }
  return first as Record<string, unknown>;
}

export async function refreshTwitchAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
}> {
  const form = new URLSearchParams();
  form.set("client_id", getTwitchClientId());
  form.set("client_secret", getTwitchClientSecret());
  form.set("grant_type", "refresh_token");
  form.set("refresh_token", refreshToken);

  const tokenRecord = await fetchJson(
    `${TOKEN_HOST}/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    },
    "refresh",
  );

  const accessToken = readString(tokenRecord, "access_token");
  if (!accessToken) {
    throw new ServiceError(
      "forbidden",
      "Twitch authorization has expired. Reconnect the channel.",
      { status: 401 },
    );
  }

  const expiresIn = readPositiveSeconds(tokenRecord, "expires_in");
  return {
    accessToken,
    refreshToken: readString(tokenRecord, "refresh_token"),
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
    scopes: readScopes(tokenRecord),
  };
}

export async function exchangeTwitchCodeForStoredCredential(options: {
  code: string;
  codeVerifier: string;
}): Promise<TwitchTokenExchangeResult> {
  const code = options.code.replace(/#_+$/, "").trim();
  const codeVerifier = options.codeVerifier.trim();
  if (!code || !codeVerifier) {
    throw new ServiceError(
      "invalid_input",
      "Twitch authorization did not return a usable code.",
    );
  }

  const form = new URLSearchParams();
  form.set("client_id", getTwitchClientId());
  form.set("client_secret", getTwitchClientSecret());
  form.set("code", code);
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", getTwitchOauthRedirectUri());
  form.set("code_verifier", codeVerifier);

  const tokenRecord = await fetchJson(
    `${TOKEN_HOST}/oauth2/token`,
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
      "Twitch did not return an access token.",
      { status: 502 },
    );
  }

  const expiresIn = readPositiveSeconds(tokenRecord, "expires_in");
  const now = Date.now();

  const userRecord = await fetchJson(
    `${HELIX_HOST}/helix/users`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": getTwitchClientId(),
      },
    },
    "users",
  );

  const identity = mapTwitchIdentityFromRecord(
    firstHelixUser(userRecord) ?? {},
  );
  if (!identity) {
    throw new ServiceError(
      "unavailable",
      "Twitch did not return a usable channel.",
      { status: 502 },
    );
  }

  return {
    accessToken,
    refreshToken: readString(tokenRecord, "refresh_token"),
    tokenType: readString(tokenRecord, "token_type") || "bearer",
    expiresAt: expiresIn ? new Date(now + expiresIn * 1000) : null,
    refreshExpiresAt: null,
    scopes: readScopes(tokenRecord),
    externalSubjectId: identity.externalSubjectId,
    displayName: identity.displayName,
    handle: identity.handle,
    profileImageUrl: identity.profileImageUrl,
  };
}
