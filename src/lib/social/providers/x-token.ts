import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  getXClientId,
  getXOauthRedirectUri,
  X_OAUTH_START_SCOPES,
} from "@/lib/social/providers/x-oauth";

const TOKEN_HOST = "https://api.twitter.com";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getXClientSecret(): string {
  const secret = trimEnv("X_CLIENT_SECRET");
  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "X authorization is not configured.",
      { status: 503 },
    );
  }
  return secret;
}

function confidentialClientAuthorization(): string {
  const credentials = `${getXClientId()}:${getXClientSecret()}`;
  return `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;
}

export class XTokenConsumedError extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "XTokenConsumedError";
  }
}

export type XTokenExchangeResult = {
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
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    return data as Record<string, unknown>;
  }
  return null;
}

function xErrorCode(record: Record<string, unknown>): string | null {
  return (
    readString(record, "error") ??
    (typeof record.error === "object" && record.error !== null
      ? readString(record.error as Record<string, unknown>, "error")
      : null)
  );
}

function xErrorMessage(record: Record<string, unknown>): string {
  const nested =
    typeof record.error === "object" && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;
  return (
    readString(record, "error_description") ??
    readString(nested ?? {}, "message") ??
    readString(record, "error") ??
    ""
  ).toLowerCase();
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
        "X authorization timed out. You can retry.",
        { status: 503 },
      );
    }
    throw new ServiceError(
      "unavailable",
      "X authorization could not be completed. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "X returned an unexpected authorization response.",
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "X returned an invalid authorization response.",
      { status: 502 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "X returned an incomplete authorization response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;

  if (!response.ok || record.error) {
    const errorCode = xErrorCode(record);
    const message = xErrorMessage(record);

    logSocialOAuthEvent("x-token", {
      stage,
      outcome: "failed",
      provider: "x",
    });

    if (
      errorCode === "invalid_grant" ||
      errorCode === "invalid_request" ||
      (message.includes("code") &&
        (message.includes("expired") ||
          message.includes("invalid") ||
          message.includes("used")))
    ) {
      throw new XTokenConsumedError(
        "X authorization code is no longer valid. Reconnect again.",
      );
    }

    throw new ServiceError(
      "unavailable",
      "X authorization failed temporarily. You can retry.",
      { status: 503 },
    );
  }

  return record;
}

export function mapXIdentityFromRecord(
  raw: Record<string, unknown>,
): {
  externalSubjectId: string;
  handle: string | null;
  displayName: string | null;
  profileImageUrl: string | null;
} | null {
  const id = readString(raw, "id");
  if (!id) return null;
  const handle = readString(raw, "username");
  const name = readString(raw, "name");
  return {
    externalSubjectId: id,
    handle,
    displayName: name || handle,
    profileImageUrl: readString(raw, "profile_image_url"),
  };
}

export async function exchangeXCodeForStoredCredential(options: {
  code: string;
  codeVerifier: string;
}): Promise<XTokenExchangeResult> {
  const code = options.code.replace(/#_+$/, "").trim();
  const codeVerifier = options.codeVerifier.trim();
  if (!code || !codeVerifier) {
    throw new ServiceError(
      "invalid_input",
      "X authorization did not return a usable code.",
    );
  }

  const form = new URLSearchParams();
  form.set("grant_type", "authorization_code");
  form.set("code", code);
  form.set("redirect_uri", getXOauthRedirectUri());
  form.set("code_verifier", codeVerifier);
  form.set("client_id", getXClientId());

  const tokenRecord = await fetchJson(
    `${TOKEN_HOST}/2/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: confidentialClientAuthorization(),
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
      "X did not return an access token.",
      { status: 502 },
    );
  }

  const expiresIn = readPositiveSeconds(tokenRecord, "expires_in");
  const now = Date.now();

  const meUrl = new URL(`${TOKEN_HOST}/2/users/me`);
  meUrl.searchParams.set(
    "user.fields",
    "id,name,username,profile_image_url",
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

  const identity = mapXIdentityFromRecord(unwrapUserRecord(me) ?? me);
  if (!identity) {
    throw new ServiceError(
      "unavailable",
      "X did not return a usable account.",
      { status: 502 },
    );
  }

  const scope = readString(tokenRecord, "scope");
  const scopes = scope
    ? scope.split(/[,\s]+/).filter(Boolean)
    : [...X_OAUTH_START_SCOPES];

  return {
    accessToken,
    refreshToken: readString(tokenRecord, "refresh_token"),
    tokenType: readString(tokenRecord, "token_type") || "Bearer",
    expiresAt: expiresIn ? new Date(now + expiresIn * 1000) : null,
    refreshExpiresAt: null,
    scopes,
    externalSubjectId: identity.externalSubjectId,
    displayName: identity.displayName,
    handle: identity.handle,
    profileImageUrl: identity.profileImageUrl,
  };
}
