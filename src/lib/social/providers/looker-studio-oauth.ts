import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";
import {
  getGoogleSocialClientId,
  GOOGLE_OAUTH_AUTHORIZE_HOST,
} from "@/lib/social/providers/google-oauth";

export const LOOKER_STUDIO_OAUTH_CALLBACK_PATH =
  "/api/social/callback/looker-studio";

/** Read-only Looker Studio reports. YouTube, Business Profile, and Ads stay off this request. */
export const LOOKER_STUDIO_OAUTH_SCOPE =
  "https://www.googleapis.com/auth/datastudio.readonly";

export const LOOKER_STUDIO_OAUTH_START_SCOPES = [
  "openid",
  "email",
  "profile",
  LOOKER_STUDIO_OAUTH_SCOPE,
] as const;

export const LOOKER_STUDIO_API_HOST = "https://datastudio.googleapis.com";
export const LOOKER_STUDIO_REPORT_HOST = "https://lookerstudio.google.com";

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
      "Looker Studio authorization is not configured.",
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
      "Looker Studio authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getLookerStudioOAuthRedirectUri(): string {
  const explicit = trimEnv("LOOKER_STUDIO_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "Looker Studio authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${LOOKER_STUDIO_OAUTH_CALLBACK_PATH}`;
}

export function buildLookerStudioAuthorizationUrl(options: {
  state: string;
  codeChallenge: string;
}): string {
  if (!options.state.trim() || !options.codeChallenge.trim()) {
    throw new ServiceError(
      "unavailable",
      "The Looker Studio authorization request could not be prepared.",
      { status: 503 },
    );
  }

  let clientId: string;
  try {
    clientId = getGoogleSocialClientId();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Looker Studio authorization is not configured.",
      { status: 503 },
    );
  }

  const url = new URL(`${GOOGLE_OAUTH_AUTHORIZE_HOST}/o/oauth2/v2/auth`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getLookerStudioOAuthRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", LOOKER_STUDIO_OAUTH_START_SCOPES.join(" "));
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
