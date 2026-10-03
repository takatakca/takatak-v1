import "server-only";

import {
  HOCKEY_GOOGLE_SCOPES,
  getHockeyGoogleClientId,
  getHockeyGoogleClientSecret,
  getHockeyGoogleRedirectUri,
} from "./google-config";
import { ServiceError } from "@/lib/services/service-error";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const TIMEOUT_MS = 15_000;

export type HockeyGoogleTokenResult = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
  externalAccountId: string | null;
  displayName: string | null;
};

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseScopes(value: string | null): string[] {
  if (!value) return [...HOCKEY_GOOGLE_SCOPES];
  return value
    .split(/[\s,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
    });

    const type = response.headers.get("content-type") ?? "";
    if (!type.includes("application/json")) {
      throw new ServiceError(
        "unavailable",
        "Google Calendar returned an unexpected response.",
      );
    }

    const body = (await response.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ServiceError(
        "unavailable",
        "Google Calendar returned an invalid response.",
      );
    }

    const record = body as Record<string, unknown>;
    if (!response.ok || record.error) {
      throw new ServiceError(
        "unavailable",
        "Google Calendar authorization could not be completed.",
      );
    }

    return record;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      "unavailable",
      "Google Calendar is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function readUserInfo(
  accessToken: string,
): Promise<{ id: string | null; name: string | null }> {
  try {
    const record = await fetchJson(USERINFO_ENDPOINT, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return {
      id: readString(record, "sub") || readString(record, "email"),
      name: readString(record, "name") || readString(record, "email"),
    };
  } catch {
    return { id: null, name: null };
  }
}

export async function exchangeHockeyGoogleCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<HockeyGoogleTokenResult> {
  const form = new URLSearchParams({
    client_id: getHockeyGoogleClientId(),
    client_secret: getHockeyGoogleClientSecret(),
    redirect_uri: getHockeyGoogleRedirectUri(),
    grant_type: "authorization_code",
    code: input.code.trim(),
    code_verifier: input.codeVerifier.trim(),
  });

  const record = await fetchJson(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const accessToken = readString(record, "access_token");
  if (!accessToken) {
    throw new ServiceError(
      "unavailable",
      "Google Calendar did not return an access token.",
    );
  }

  const expiresRaw = record.expires_in;
  const expiresIn =
    typeof expiresRaw === "number"
      ? expiresRaw
      : typeof expiresRaw === "string"
        ? Number.parseInt(expiresRaw, 10)
        : Number.NaN;

  const user = await readUserInfo(accessToken);

  return {
    accessToken,
    refreshToken: readString(record, "refresh_token"),
    tokenType: readString(record, "token_type"),
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
    scopes: parseScopes(readString(record, "scope")),
    externalAccountId: user.id,
    displayName: user.name,
  };
}

export async function refreshHockeyGoogleToken(
  refreshToken: string,
): Promise<{
  accessToken: string;
  tokenType: string | null;
  expiresAt: Date | null;
  scopes: string[];
}> {
  const form = new URLSearchParams({
    client_id: getHockeyGoogleClientId(),
    client_secret: getHockeyGoogleClientSecret(),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const record = await fetchJson(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const accessToken = readString(record, "access_token");
  if (!accessToken) {
    throw new ServiceError(
      "unavailable",
      "Google Calendar token refresh failed.",
    );
  }

  const expiresRaw = record.expires_in;
  const expiresIn =
    typeof expiresRaw === "number"
      ? expiresRaw
      : typeof expiresRaw === "string"
        ? Number.parseInt(expiresRaw, 10)
        : Number.NaN;

  return {
    accessToken,
    tokenType: readString(record, "token_type"),
    expiresAt:
      Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
    scopes: parseScopes(readString(record, "scope")),
  };
}
