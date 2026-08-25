import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";

export const META_OAUTH_AUTHORIZE_HOST =
  "https://www.facebook.com";

export const META_OAUTH_CALLBACK_PATH =
  "/api/social/callback/facebook";

/** Connect + Page list + engagement read + insights (no publish/moderate). */
export const META_OAUTH_START_SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "read_insights",
] as const;

const DEFAULT_GRAPH_API_VERSION = "v21.0";

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/**
 * Exact Facebook OAuth callback URI for this environment.
 * Never derived from Host / X-Forwarded-* request headers.
 */
export function getMetaOAuthRedirectUri(): string {
  const explicit = trimEnv("META_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;

    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "Facebook authorization is not configured.",
        { status: 503 },
      );
    }

    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${META_OAUTH_CALLBACK_PATH}`;
}

export function getMetaAppId(): string {
  const appId = trimEnv("META_APP_ID");

  if (!appId) {
    throw new ServiceError(
      "unavailable",
      "Facebook authorization is not configured.",
      { status: 503 },
    );
  }

  return appId;
}

export function getMetaGraphApiVersion(): string {
  const configured = trimEnv("META_GRAPH_API_VERSION");

  if (!configured) {
    return DEFAULT_GRAPH_API_VERSION;
  }

  if (!/^v\d+\.\d+$/.test(configured)) {
    throw new ServiceError(
      "unavailable",
      "Facebook authorization is not configured.",
      { status: 503 },
    );
  }

  return configured;
}

/**
 * Build the Meta authorization URL on the server only.
 * Must not include the App Secret.
 */
export function buildMetaAuthorizationUrl(options: {
  state: string;
  codeChallenge: string;
}): string {
  if (!options.state.trim() || !options.codeChallenge.trim()) {
    throw new ServiceError(
      "unavailable",
      "The Facebook authorization request could not be prepared.",
      { status: 503 },
    );
  }

  const version = getMetaGraphApiVersion();
  const redirectUri = getMetaOAuthRedirectUri();
  const clientId = getMetaAppId();

  const url = new URL(
    `${META_OAUTH_AUTHORIZE_HOST}/${version}/dialog/oauth`,
  );

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", options.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    META_OAUTH_START_SCOPES.join(","),
  );
  url.searchParams.set(
    "code_challenge",
    options.codeChallenge,
  );
  url.searchParams.set(
    "code_challenge_method",
    "S256",
  );

  if (url.origin !== META_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Facebook authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function assertAbsoluteHttpsOrLocalhost(
  value: string,
): void {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new ServiceError(
      "unavailable",
      "Facebook authorization is not configured.",
      { status: 503 },
    );
  }

  const isLocalHttp =
    parsed.protocol === "http:" &&
    (parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1");

  const isHttps = parsed.protocol === "https:";

  if (!isHttps && !isLocalHttp) {
    throw new ServiceError(
      "unavailable",
      "Facebook authorization is not configured.",
      { status: 503 },
    );
  }
}
