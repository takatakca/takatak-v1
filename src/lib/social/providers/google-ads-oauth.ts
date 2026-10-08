import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";
import {
  getGoogleSocialClientId,
  GOOGLE_OAUTH_AUTHORIZE_HOST,
} from "@/lib/social/providers/google-oauth";

export const GOOGLE_ADS_OAUTH_CALLBACK_PATH =
  "/api/social/callback/google-ads";

/** Read-only Google Ads access. YouTube and Business Profile stay off this request. */
export const GOOGLE_ADS_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/adwords";

export const GOOGLE_ADS_OAUTH_START_SCOPES = [
  "openid",
  "email",
  "profile",
  GOOGLE_ADS_OAUTH_SCOPE,
] as const;

/**
 * v22 sunsets in October 2026. v23 remains available through February 2027.
 * Override with GOOGLE_ADS_API_VERSION when upgrading (major version only, such as v23).
 */
export const GOOGLE_ADS_API_VERSION_DEFAULT = "v23";

const GOOGLE_ADS_API_HOST = "https://googleads.googleapis.com";

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function assertAbsoluteHttpsOrLocalhost(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ServiceError(
      "unavailable",
      "Google Ads authorization is not configured.",
      { status: 503 },
    );
  }

  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
  const isHttps = parsed.protocol === "https:";

  if (!isHttps && !isLocalHttp) {
    throw new ServiceError(
      "unavailable",
      "Google Ads authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getGoogleAdsOAuthRedirectUri(): string {
  const explicit = trimEnv("GOOGLE_ADS_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "Google Ads authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${GOOGLE_ADS_OAUTH_CALLBACK_PATH}`;
}

export function getGoogleAdsApiVersion(): string {
  const version =
    trimEnv("GOOGLE_ADS_API_VERSION") ?? GOOGLE_ADS_API_VERSION_DEFAULT;
  if (!/^v(?:2[3-9]|[3-9]\d)$/.test(version)) {
    throw new ServiceError(
      "unavailable",
      "Google Ads authorization is not configured.",
      { status: 503 },
    );
  }
  return version;
}

export function getGoogleAdsDeveloperToken(): string | null {
  const token = trimEnv("GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!token) return null;
  if (token.length > 128 || /[\r\n]/.test(token)) {
    throw new ServiceError(
      "unavailable",
      "Google Ads authorization is not configured.",
      { status: 503 },
    );
  }
  return token;
}

export function googleAdsApiUrl(path: string): URL {
  const version = getGoogleAdsApiVersion();
  const url = new URL(`${GOOGLE_ADS_API_HOST}/${version}${path}`);
  if (url.origin !== GOOGLE_ADS_API_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Google Ads API host is invalid.",
      { status: 503 },
    );
  }
  return url;
}

export function buildGoogleAdsAuthorizationUrl(options: {
  state: string;
  codeChallenge: string;
}): string {
  if (!options.state.trim() || !options.codeChallenge.trim()) {
    throw new ServiceError(
      "unavailable",
      "The Google Ads authorization request could not be prepared.",
      { status: 503 },
    );
  }

  let clientId: string;
  try {
    clientId = getGoogleSocialClientId();
    getGoogleAdsDeveloperToken();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Google Ads authorization is not configured.",
      { status: 503 },
    );
  }

  const url = new URL(`${GOOGLE_OAUTH_AUTHORIZE_HOST}/o/oauth2/v2/auth`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getGoogleAdsOAuthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_ADS_OAUTH_START_SCOPES.join(" "));
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  if (url.origin !== GOOGLE_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Google authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}
