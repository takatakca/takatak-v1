import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";
import { getMetaAppId } from "@/lib/social/providers/meta-oauth";

export const THREADS_OAUTH_AUTHORIZE_HOST = "https://www.threads.net";

export const THREADS_OAUTH_CALLBACK_PATH =
  "/api/social/callback/threads";

export const THREADS_OAUTH_START_SCOPES = [
  "threads_basic",
  "threads_manage_insights",
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
      "Threads authorization is not configured.",
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
      "Threads authorization is not configured.",
      { status: 503 },
    );
  }
}

export function getThreadsAppId(): string {
  return trimEnv("THREADS_APP_ID") || getMetaAppId();
}

export function getThreadsOAuthRedirectUri(): string {
  const explicit = trimEnv("THREADS_OAUTH_REDIRECT_URI");

  if (explicit) {
    let resolved: string;
    try {
      resolved = stripTrailingSlash(resolvePublicUrl(explicit).href);
    } catch {
      throw new ServiceError(
        "unavailable",
        "Threads authorization is not configured.",
        { status: 503 },
      );
    }
    assertAbsoluteHttpsOrLocalhost(resolved);
    return resolved;
  }

  const origin = getApplicationOrigin();
  assertAbsoluteHttpsOrLocalhost(origin);
  return `${origin}${THREADS_OAUTH_CALLBACK_PATH}`;
}

export function buildThreadsAuthorizationUrl(options: {
  state: string;
}): string {
  if (!options.state.trim()) {
    throw new ServiceError(
      "unavailable",
      "The Threads authorization request could not be prepared.",
      { status: 503 },
    );
  }

  const url = new URL(`${THREADS_OAUTH_AUTHORIZE_HOST}/oauth/authorize`);
  url.searchParams.set("client_id", getThreadsAppId());
  url.searchParams.set("redirect_uri", getThreadsOAuthRedirectUri());
  url.searchParams.set("state", options.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", THREADS_OAUTH_START_SCOPES.join(","));

  if (url.origin !== THREADS_OAUTH_AUTHORIZE_HOST) {
    throw new ServiceError(
      "unavailable",
      "The Threads authorization host is invalid.",
      { status: 503 },
    );
  }

  return url.toString();
}
