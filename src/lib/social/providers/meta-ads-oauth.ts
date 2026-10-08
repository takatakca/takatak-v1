import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";
import {
  getMetaAppId,
  getMetaGraphApiVersion,
  META_OAUTH_AUTHORIZE_HOST,
} from "@/lib/social/providers/meta-oauth";

export const META_ADS_OAUTH_CALLBACK_PATH = "/api/social/callback/meta-ads";

/**
 * Read ad accounts and business access.
 * Page publishing, Instagram, and ads management stay off this request.
 */
export const META_ADS_OAUTH_START_SCOPES = [
  "ads_read",
  "business_management",
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
      "Meta Ads authorization is not configured.",
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
      "Meta Ads authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getMetaAdsOAuthRedirectUri(): string {
  const explicit = trimEnv("META_ADS_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "Meta Ads authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${META_ADS_OAUTH_CALLBACK_PATH}`;
}

export function buildMetaAdsAuthorizationUrl(options: {
  state: string;
  codeChallenge: string;
}): string {
  if (!options.state.trim() || !options.codeChallenge.trim()) {
    throw new ServiceError(
      "unavailable",
      "The Meta Ads authorization request could not be prepared.",
      { status: 503 },
    );
  }

  let clientId: string;
  try {
    clientId = getMetaAppId();
  } catch {
    throw new ServiceError(
      "unavailable",
      "Meta Ads authorization is not configured.",
      { status: 503 },
    );
  }

  const version = getMetaGraphApiVersion();
  const url = new URL(
    `${META_OAUTH_AUTHORIZE_HOST}/${version}/dialog/oauth`,
  );

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getMetaAdsOAuthRedirectUri());
  url.searchParams.set("state", options.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_ADS_OAUTH_START_SCOPES.join(","));
  url.searchParams.set("code_challenge", options.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (url.origin !== META_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Facebook authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}
