import "server-only";

import { ServiceError } from "@/lib/services/service-error";
import { getPinterestClientId, getPinterestRedirectUri, PINTEREST_OAUTH_START_SCOPES } from "@/lib/social/providers/pinterest-oauth";

const API = "https://api.pinterest.com/v5";
function clientAuthorization(): string {
  const secret = process.env.PINTEREST_APP_SECRET?.trim();
  if (!secret) throw new ServiceError("unavailable", "Pinterest authorization is not configured.", { status: 503 });
  return "Basic " + Buffer.from(`${getPinterestClientId()}:${secret}`, "utf8").toString("base64");
}
async function requestJson(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...init, redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { Accept: "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch {
    throw new ServiceError("unavailable", "Pinterest API could not be reached. Retry authorization.", { status: 503 });
  }
  let data: unknown;
  try { data = await response.json(); } catch {
    throw new ServiceError("unavailable", "Pinterest returned an invalid response.", { status: 502 });
  }
  if (!response.ok || !data || typeof data !== "object" || Array.isArray(data)) {
    throw new ServiceError("unavailable", "Pinterest authorization was rejected. Check app permissions and reconnect.", { status: 502 });
  }
  return data as Record<string, unknown>;
}
function str(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function seconds(o: Record<string, unknown>, key: string): number | null {
  const value = Number(o[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
}
function scopes(o: Record<string, unknown>): string[] {
  const value = o.scope;
  if (typeof value === "string") return value.split(/[ ,]+/).filter(Boolean);
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [...PINTEREST_OAUTH_START_SCOPES];
}
function tokenBody(options: Record<string, string>): URLSearchParams {
  return new URLSearchParams(options);
}
async function exchange(body: URLSearchParams): Promise<Record<string, unknown>> {
  return requestJson("/oauth/token", {
    method: "POST",
    headers: {
      Authorization: clientAuthorization(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
}
export async function refreshPinterestAccessToken(refreshToken: string): Promise<{
  accessToken: string; refreshToken: string | null; expiresAt: Date | null; scopes: string[];
}> {
  const result = await exchange(tokenBody({grant_type:"refresh_token",refresh_token:refreshToken}));
  const accessToken = str(result, "access_token");
  if (!accessToken) throw new ServiceError("unavailable", "Pinterest token refresh failed.", { status: 502 });
  const ttl = seconds(result, "expires_in");
  return { accessToken, refreshToken: str(result, "refresh_token"), expiresAt: ttl ? new Date(Date.now()+ttl*1000) : null, scopes: scopes(result) };
}
export async function exchangePinterestCodeForStoredCredential(options: {
  code: string; codeVerifier: string;
}) {
  if (!options.code.trim()) throw new ServiceError("invalid_input", "Pinterest did not return an authorization code.");
  // Pinterest uses OAuth authorization-code with confidential client Basic auth.
  // Code verifier belongs to TAKATAK's existing encrypted state lifecycle; Pinterest
  // does not currently require a PKCE parameter for this confidential-client flow.
  const result = await exchange(tokenBody({
    grant_type: "authorization_code",
    code: options.code.trim(),
    redirect_uri: getPinterestRedirectUri(),
  }));
  const accessToken = str(result, "access_token");
  if (!accessToken) throw new ServiceError("unavailable", "Pinterest did not return an access token.", { status: 502 });
  const user = await requestJson("/user_account", { headers: {Authorization: `Bearer ${accessToken}`} });
  const username = str(user, "username");
  const id = str(user, "id") ?? username;
  if (!id) throw new ServiceError("unavailable", "Pinterest did not return an account identity.", {status:502});
  const expiry = seconds(result, "expires_in");
  const refreshExpiry = seconds(result, "refresh_token_expires_in");
  const image = str(user, "profile_image");
  return {
    accessToken,
    refreshToken: str(result, "refresh_token"),
    tokenType: str(result, "token_type") ?? "bearer",
    expiresAt: expiry ? new Date(Date.now()+expiry*1000) : null,
    refreshExpiresAt: refreshExpiry ? new Date(Date.now()+refreshExpiry*1000) : null,
    scopes: scopes(result),
    externalSubjectId: id,
    displayName: str(user, "business_name") ?? username,
    handle: username,
    profileImageUrl: image && /^https:\/\//i.test(image) ? image : null,
  };
}
