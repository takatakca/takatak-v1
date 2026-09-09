import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";

export const TIKTOK_OAUTH_AUTHORIZE_HOST = "https://www.tiktok.com";

export const TIKTOK_OAUTH_CALLBACK_PATH = "/api/social/callback/tiktok";

/**
 * Login Kit identity + profile. Publishing and ads stay out of this start
 * request so a personal TikTok account can connect without extra products.
 */
export const TIKTOK_OAUTH_START_SCOPES = [
  "user.info.basic",
  "user.info.profile",
] as const;

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
      "TikTok authorization is not configured.",
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
      "TikTok authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getTikTokClientKey(): string {
  const key = trimEnv("TIKTOK_CLIENT_KEY");
  if (!key) {
    throw new ServiceError(
      "unavailable",
      "TikTok authorization is not configured.",
      { status: 503 },
    );
  }
  return key;
}

export function getTikTokOAuthRedirectUri(): string {
  const explicit = trimEnv("TIKTOK_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "TikTok authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${TIKTOK_OAUTH_CALLBACK_PATH}`;
}

export function buildTikTokAuthorizationUrl(options: {
  state: string;
}): string {
  if (!options.state.trim()) {
    throw new ServiceError(
      "unavailable",
      "The TikTok authorization request could not be prepared.",
      { status: 503 },
    );
  }

  const url = new URL(`${TIKTOK_OAUTH_AUTHORIZE_HOST}/v2/auth/authorize/`);
  url.searchParams.set("client_key", getTikTokClientKey());
  url.searchParams.set("redirect_uri", getTikTokOAuthRedirectUri());
  url.searchParams.set("state", options.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_OAUTH_START_SCOPES.join(","));

  if (url.origin !== TIKTOK_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The TikTok authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}
