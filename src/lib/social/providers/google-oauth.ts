import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";

export const GOOGLE_OAUTH_AUTHORIZE_HOST = "https://accounts.google.com";

export const GOOGLE_OAUTH_CALLBACK_PATH = "/api/social/callback/google";

/** YouTube identity + analytics. Business Profile is not requested until GBP API access is approved. */
export const GOOGLE_OAUTH_YOUTUBE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
] as const;

export const GOOGLE_OAUTH_START_SCOPES = GOOGLE_OAUTH_YOUTUBE_SCOPES;

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
      "Google authorization is not configured.",
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
      "Google authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getGoogleSocialClientId(): string {
  const clientId = trimEnv("GOOGLE_SOCIAL_CLIENT_ID");
  if (!clientId) {
    throw new ServiceError(
      "unavailable",
      "Google authorization is not configured.",
      { status: 503 },
    );
  }
  return clientId;
}

export function getGoogleOAuthRedirectUri(): string {
  const explicit = trimEnv("GOOGLE_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "Google authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

export function buildGoogleAuthorizationUrl(options: {
  state: string;
  codeChallenge: string;
}): string {
  if (!options.state.trim() || !options.codeChallenge.trim()) {
    throw new ServiceError(
      "unavailable",
      "The Google authorization request could not be prepared.",
      { status: 503 },
    );
  }

  const url = new URL(`${GOOGLE_OAUTH_AUTHORIZE_HOST}/o/oauth2/v2/auth`);
  url.searchParams.set("client_id", getGoogleSocialClientId());
  url.searchParams.set("redirect_uri", getGoogleOAuthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_OAUTH_START_SCOPES.join(" "));
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");

  if (url.origin !== GOOGLE_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Google authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}
