import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { logSocialOAuthEvent } from "@/lib/social/connections/social-oauth-log";
import {
  getGoogleOAuthRedirectUri,
  getGoogleSocialClientId,
} from "@/lib/social/providers/google-oauth";

const TOKEN_HOST = "https://oauth2.googleapis.com";
const USERINFO_HOST = "https://openidconnect.googleapis.com";
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function getGoogleSocialClientSecret(): string {
  const secret = trimEnv("GOOGLE_SOCIAL_CLIENT_SECRET");
  if (!secret) {
    throw new ServiceError(
      "unavailable",
      "Google authorization is not configured.",
      { status: 503 },
    );
  }
  return secret;
}

export class GoogleTokenConsumedError extends Error {
  readonly retryable = false;
  constructor(message: string) {
    super(message);
    this.name = "GoogleTokenConsumedError";
  }
}

export type GoogleTokenExchangeResult = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
  externalSubjectId: string;
  displayName: string | null;
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

function parseScopes(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchJson(
  url: string,
  init: RequestInit,
  stage: string,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TOKEN_REQUEST_TIMEOUT_MS);

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
        "Google authorization timed out. You can retry.",
        { status: 503 },
      );
    }
    throw new ServiceError(
      "unavailable",
      "Google authorization could not be completed. You can retry.",
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ServiceError(
      "unavailable",
      "Google returned an unexpected authorization response.",
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Google returned an invalid authorization response.",
      { status: 502 },
    );
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ServiceError(
      "unavailable",
      "Google returned an incomplete authorization response.",
      { status: 502 },
    );
  }

  const record = body as Record<string, unknown>;

  if (!response.ok || record.error) {
    const errorCode =
      readString(record, "error") ??
      (typeof record.error === "object" && record.error !== null
        ? readString(record.error as Record<string, unknown>, "status")
        : null);

    logSocialOAuthEvent("google-token", {
      stage,
      outcome: "failed",
      provider: "google",
    });

    if (
      errorCode === "invalid_grant" ||
      errorCode === "invalid_request"
    ) {
      throw new GoogleTokenConsumedError(
        "Google authorization code is no longer valid. Reconnect again.",
      );
    }

    throw new ServiceError(
      "unavailable",
      "Google authorization failed temporarily. You can retry.",
      { status: 503 },
    );
  }

  return record;
}

export async function exchangeGoogleCodeForStoredCredential(options: {
  code: string;
  codeVerifier: string;
}): Promise<GoogleTokenExchangeResult> {
  const code = options.code.replace(/#_+$/, "").trim();
  const codeVerifier = options.codeVerifier.trim();
  if (!code || !codeVerifier) {
    throw new ServiceError(
      "invalid_input",
      "Google authorization did not return a usable code.",
    );
  }

  const form = new URLSearchParams();
  form.set("client_id", getGoogleSocialClientId());
  form.set("client_secret", getGoogleSocialClientSecret());
  form.set("grant_type", "authorization_code");
  form.set("redirect_uri", getGoogleOAuthRedirectUri());
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

  return {
    accessToken,
    refreshToken: readString(tokenRecord, "refresh_token"),
    tokenType: readString(tokenRecord, "token_type"),
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
    scopes: parseScopes(readString(tokenRecord, "scope")),
    externalSubjectId,
    displayName: readString(userinfo, "name") || readString(userinfo, "email"),
    profileImageUrl: readString(userinfo, "picture"),
  };
}
