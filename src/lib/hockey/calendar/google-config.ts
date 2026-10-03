import "server-only";

import { getApplicationOrigin, resolvePublicUrl } from "@/lib/config/app-origin";
import { ServiceError } from "@/lib/services/service-error";

export const HOCKEY_GOOGLE_CALLBACK_PATH =
  "/api/hockey/calendar/google/callback";

export const HOCKEY_GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

function trimEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getHockeyGoogleClientId(): string {
  const value = trimEnv("GOOGLE_HOCKEY_CLIENT_ID");
  if (!value) {
    throw new ServiceError("unavailable", "Google Calendar is not configured.");
  }
  return value;
}

export function getHockeyGoogleClientSecret(): string {
  const value = trimEnv("GOOGLE_HOCKEY_CLIENT_SECRET");
  if (!value) {
    throw new ServiceError("unavailable", "Google Calendar is not configured.");
  }
  return value;
}

export function getHockeyGoogleRedirectUri(): string {
  const explicit = trimEnv("GOOGLE_HOCKEY_REDIRECT_URI");
  if (explicit) {
    let url: URL;
    try {
      url = resolvePublicUrl(explicit);
    } catch {
      throw new ServiceError("unavailable", "Google Calendar redirect is invalid.");
    }
    const local =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !local) {
      throw new ServiceError("unavailable", "Google Calendar redirect must use HTTPS.");
    }
    return url.toString().replace(/\/$/, "");
  }

  return `${getApplicationOrigin()}${HOCKEY_GOOGLE_CALLBACK_PATH}`;
}

export function buildHockeyGoogleAuthorizationUrl(input: {
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getHockeyGoogleClientId());
  url.searchParams.set("redirect_uri", getHockeyGoogleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", HOCKEY_GOOGLE_SCOPES.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  return url.toString();
}

export function isHockeyGoogleCalendarEnabled(): boolean {
  return process.env.HOCKEY_GOOGLE_CALENDAR_ENABLED === "true";
}
