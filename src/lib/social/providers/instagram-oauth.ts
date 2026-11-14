import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";
import { getMetaGraphApiVersion } from "@/lib/social/providers/meta-oauth";

export const INSTAGRAM_OAUTH_AUTHORIZE_HOST =
  "https://www.instagram.com";

export const INSTAGRAM_OAUTH_CALLBACK_PATH =
  "/api/social/callback/instagram";

/** Default scopes for a new Instagram Login connection (identity + insights). */
export const INSTAGRAM_OAUTH_START_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_insights",
] as const;

/** Scope that lets TAKATAK publish media on the professional account. */
export const INSTAGRAM_OAUTH_PERMISSION_PUBLISH =
  "instagram_business_content_publish" as const;

/**
 * Scopes requested by the "Grant publishing" action on an existing
 * connection (incremental authorization). Instagram re-issues a token that
 * carries the union of granted permissions, so the basic scopes stay listed.
 */
export const INSTAGRAM_OAUTH_PUBLISHING_SCOPES = [
  ...INSTAGRAM_OAUTH_START_SCOPES,
  INSTAGRAM_OAUTH_PERMISSION_PUBLISH,
] as const;

/**
 * `instagram_basic_insights` is the default for every new connection and must
 * stay so until the owner confirms Meta app review approved
 * `instagram_business_content_publish`; `instagram_publishing` is only used
 * by the explicit Grant publishing action on an existing connection.
 */
export type InstagramOAuthScopeSet =
  | "instagram_basic_insights"
  | "instagram_publishing";

export function resolveInstagramOAuthScopes(
  scopeSet: InstagramOAuthScopeSet = "instagram_basic_insights",
): readonly string[] {
  if (scopeSet === "instagram_publishing") {
    return INSTAGRAM_OAUTH_PUBLISHING_SCOPES;
  }
  return INSTAGRAM_OAUTH_START_SCOPES;
}

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
      "Instagram authorization is not configured.",
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
      "Instagram authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getInstagramAppId(): string {
  const appId = trimEnv("INSTAGRAM_APP_ID");

  if (!appId) {
    throw new ServiceError(
      "unavailable",
      "Direct Instagram authorization is not configured. Connect Instagram through Facebook, or ask an administrator to configure Instagram Login.",
      { status: 503 },
    );
  }

  return appId;
}

export function getInstagramOAuthRedirectUri(): string {
  const explicit = trimEnv("INSTAGRAM_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "Instagram authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${INSTAGRAM_OAUTH_CALLBACK_PATH}`;
}

export function getInstagramGraphApiVersion(): string {
  return getMetaGraphApiVersion();
}

export function buildInstagramAuthorizationUrl(options: {
  state: string;
  scopeSet?: InstagramOAuthScopeSet;
}): string {
  if (!options.state.trim()) {
    throw new ServiceError(
      "unavailable",
      "The Instagram authorization request could not be prepared.",
      { status: 503 },
    );
  }

  const url = new URL(`${INSTAGRAM_OAUTH_AUTHORIZE_HOST}/oauth/authorize`);
  url.searchParams.set("client_id", getInstagramAppId());
  url.searchParams.set("redirect_uri", getInstagramOAuthRedirectUri());
  url.searchParams.set("state", options.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    resolveInstagramOAuthScopes(options.scopeSet).join(","),
  );

  if (url.origin !== INSTAGRAM_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Instagram authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}
