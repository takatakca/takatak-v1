import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";

export const TWITCH_OAUTH_AUTHORIZE_HOST = "https://id.twitch.tv";

export const TWITCH_OAUTH_CALLBACK_PATH = "/api/social/callback/twitch";

/**
 * Channel identity plus read-only audience scopes.
 * Chat, stream keys, and publishing stay out of this start request.
 */
export const TWITCH_OAUTH_START_SCOPES = [
  "user:read:email",
  "moderator:read:followers",
  "channel:read:subscriptions",
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
      "Twitch authorization is not configured.",
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
      "Twitch authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getTwitchClientId(): string {
  const clientId = trimEnv("TWITCH_CLIENT_ID");
  if (!clientId) {
    throw new ServiceError(
      "unavailable",
      "Twitch authorization is not configured.",
      { status: 503 },
    );
  }
  return clientId;
}

export function getTwitchOauthRedirectUri(): string {
  const explicit = trimEnv("TWITCH_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "Twitch authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${TWITCH_OAUTH_CALLBACK_PATH}`;
}

export function buildTwitchAuthorizationUrl(options: {
  state: string;
  codeChallenge: string;
}): string {
  if (!options.state.trim() || !options.codeChallenge.trim()) {
    throw new ServiceError(
      "unavailable",
      "The Twitch authorization request could not be prepared.",
      { status: 503 },
    );
  }

  const url = new URL(`${TWITCH_OAUTH_AUTHORIZE_HOST}/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", getTwitchClientId());
  url.searchParams.set("redirect_uri", getTwitchOauthRedirectUri());
  url.searchParams.set("scope", TWITCH_OAUTH_START_SCOPES.join(" "));
  url.searchParams.set("state", options.state);
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("force_verify", "true");

  if (url.origin !== TWITCH_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Twitch authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}
