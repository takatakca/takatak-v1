import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";

export const X_OAUTH_AUTHORIZE_HOST = "https://twitter.com";

export const X_OAUTH_CALLBACK_PATH = "/api/social/callback/x";

/**
 * OAuth 2.0 identity + refresh. Publishing (tweet.write) stays out of this
 * start request so an X account can connect without extra product access.
 */
export const X_OAUTH_START_SCOPES = [
  "tweet.read",
  "users.read",
  "offline.access",
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
      "X authorization is not configured.",
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
      "X authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getXClientId(): string {
  const clientId = trimEnv("X_CLIENT_ID");
  if (!clientId) {
    throw new ServiceError(
      "unavailable",
      "X authorization is not configured.",
      { status: 503 },
    );
  }
  return clientId;
}

export function getXOauthRedirectUri(): string {
  const explicit = trimEnv("X_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "X authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${X_OAUTH_CALLBACK_PATH}`;
}

export function buildXAuthorizationUrl(options: {
  state: string;
  codeChallenge: string;
}): string {
  if (!options.state.trim() || !options.codeChallenge.trim()) {
    throw new ServiceError(
      "unavailable",
      "The X authorization request could not be prepared.",
      { status: 503 },
    );
  }

  const url = new URL(`${X_OAUTH_AUTHORIZE_HOST}/i/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", getXClientId());
  url.searchParams.set("redirect_uri", getXOauthRedirectUri());
  url.searchParams.set("scope", X_OAUTH_START_SCOPES.join(" "));
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (url.origin !== X_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The X authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}
