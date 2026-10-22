import "server-only";

import { getApplicationOrigin } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";

export const PINTEREST_OAUTH_CALLBACK_PATH = "/api/social/callback/pinterest";
export const PINTEREST_OAUTH_START_SCOPES = [
  "user_accounts:read",
  "boards:read",
  "pins:read",
  "pins:write",
] as const;

export function getPinterestClientId(): string {
  const id = process.env.PINTEREST_APP_ID?.trim();
  if (!id) throw new ServiceError("unavailable", "Pinterest authorization is not configured.", { status: 503 });
  return id;
}

export function getPinterestRedirectUri(): string {
  // Never derive a production redirect from the callback request's Host header.
  const origin = getApplicationOrigin();
  if (process.env.NODE_ENV === "production" && new URL(origin).protocol !== "https:") {
    throw new ServiceError("unavailable", "Pinterest requires a secure public application origin.", { status: 503 });
  }
  return `${origin}${PINTEREST_OAUTH_CALLBACK_PATH}`;
}

export function buildPinterestAuthorizationUrl(options: { state: string }): string {
  if (!options.state.trim()) throw new ServiceError("invalid_input", "Missing Pinterest OAuth state.");
  const url = new URL("https://www.pinterest.com/oauth/");
  url.searchParams.set("client_id", getPinterestClientId());
  url.searchParams.set("redirect_uri", getPinterestRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", PINTEREST_OAUTH_START_SCOPES.join(","));
  url.searchParams.set("state", options.state);
  return url.toString();
}
