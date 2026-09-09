export const AUTH_IDENTITY_COOKIE = "takatak_auth_identity";
export const AUTH_VERIFIED_AT_COOKIE = "takatak_auth_verified_at";
export const AUTH_VERIFIED_MAX_AGE_MS = 5 * 60 * 1000;

export function normalizeIdentityEmail(
  value: string | null | undefined,
): string {
  return (value ?? "").trim().toLowerCase();
}

export function sessionMatchesProfile(input: {
  sessionUserId: string | null | undefined;
  sessionEmail: string | null | undefined;
  profileAuthUserId: string | null | undefined;
  profileEmail: string | null | undefined;
}): boolean {
  const sessionUserId = input.sessionUserId?.trim() ?? "";
  const profileAuthUserId = input.profileAuthUserId?.trim() ?? "";
  const sessionEmail = normalizeIdentityEmail(input.sessionEmail);
  const profileEmail = normalizeIdentityEmail(input.profileEmail);

  return (
    sessionUserId.length > 0 &&
    profileAuthUserId.length > 0 &&
    sessionUserId === profileAuthUserId &&
    sessionEmail.length > 0 &&
    profileEmail.length > 0 &&
    sessionEmail === profileEmail
  );
}

export function cookieUserMatchesAccessToken(input: {
  accessTokenUserId: string | null | undefined;
  accessTokenEmail: string | null | undefined;
  cookieUserId: string | null | undefined;
  cookieUserEmail: string | null | undefined;
}): boolean {
  const tokenUserId = input.accessTokenUserId?.trim() ?? "";
  if (!tokenUserId) {
    return false;
  }

  const cookieUserId = input.cookieUserId?.trim() ?? "";
  if (cookieUserId && cookieUserId !== tokenUserId) {
    return false;
  }

  const tokenEmail = normalizeIdentityEmail(input.accessTokenEmail);
  const cookieEmail = normalizeIdentityEmail(input.cookieUserEmail);
  if (cookieEmail && tokenEmail && cookieEmail !== tokenEmail) {
    return false;
  }

  return true;
}

export function localIdentityAgrees(input: {
  sessionUserId: string | null | undefined;
  identityCookie: string | null | undefined;
}): boolean {
  const sessionUserId = input.sessionUserId?.trim() ?? "";
  const identityCookie = input.identityCookie?.trim() ?? "";
  if (!sessionUserId) {
    return false;
  }
  if (!identityCookie) {
    return false;
  }
  return identityCookie === sessionUserId;
}

export function isAuthVerificationFresh(
  verifiedAtMs: number | null | undefined,
  now = Date.now(),
  maxAgeMs = AUTH_VERIFIED_MAX_AGE_MS,
): boolean {
  if (typeof verifiedAtMs !== "number" || !Number.isFinite(verifiedAtMs)) {
    return false;
  }
  return now - verifiedAtMs >= 0 && now - verifiedAtMs <= maxAgeMs;
}

export function shouldSkipAuthLookup(input: {
  hasLocalUser: boolean;
  sessionUserId: string | null | undefined;
  identityCookie: string | null | undefined;
  verifiedAtMs: number | null | undefined;
  tokenIsFresh: boolean;
  now?: number;
}): boolean {
  if (!input.hasLocalUser || !input.tokenIsFresh) {
    return false;
  }

  return (
    localIdentityAgrees({
      sessionUserId: input.sessionUserId,
      identityCookie: input.identityCookie,
    }) && isAuthVerificationFresh(input.verifiedAtMs, input.now)
  );
}

export function bindActiveClientCookie(
  authUserId: string,
  clientId: string,
): string {
  return `${authUserId.trim()}:${clientId.trim()}`;
}

export function parseBoundClientCookie(
  raw: string | null | undefined,
  authUserId: string | null | undefined,
  identityCookie?: string | null,
): string | null {
  const userId = authUserId?.trim() ?? "";
  const value = raw?.trim() ?? "";
  if (!userId || !value) {
    return null;
  }

  const identity = identityCookie?.trim() ?? "";
  if (identity && identity !== userId) {
    return null;
  }

  const separator = value.indexOf(":");
  if (separator <= 0) {
    return value;
  }

  const cookieUserId = value.slice(0, separator);
  const clientId = value.slice(separator + 1).trim();
  if (cookieUserId !== userId || !clientId) {
    return null;
  }

  return clientId;
}

export function staleActiveClientCookie(input: {
  requestedClientId: string | null | undefined;
  access: {
    mode: string;
    allowedClientIds?: string[] | "all";
    activeClientId?: string;
  };
}): boolean {
  const requested = input.requestedClientId?.trim() ?? "";
  if (!requested) {
    return false;
  }

  if (input.access.mode === "client_scoped") {
    const allowed = input.access.allowedClientIds;
    if (!Array.isArray(allowed) || allowed.length === 0) {
      return true;
    }
    return !allowed.includes(requested);
  }

  return true;
}

export function staleActiveBrandCookie(input: {
  requestedBrandId: string | null | undefined;
  availableBrandIds: string[];
  activeClientId: string | null | undefined;
}): boolean {
  const requested = input.requestedBrandId?.trim() ?? "";
  if (!requested) {
    return false;
  }
  if (!input.activeClientId) {
    return true;
  }
  return !input.availableBrandIds.includes(requested);
}

export function brandSelectorCacheKey(
  profileId: string,
  clientId: string,
): string {
  return `${profileId.trim()}::${clientId.trim()}`;
}

export function dashboardLoaderScopeKey(input: {
  profileId: string;
  clientId: string | null;
  authUserId: string;
}): string {
  return [input.authUserId, input.profileId, input.clientId ?? "none"].join(
    "::",
  );
}

export function ordinaryUserCannotUsePlatformScope(input: {
  platformRole: string;
  accessMode: string;
}): boolean {
  const elevated =
    input.platformRole === "owner" || input.platformRole === "admin";
  if (!elevated && input.accessMode === "platform_admin") {
    return false;
  }
  return true;
}

export const HIGH_RISK_PATH_PREFIXES = [
  "/api/billing",
  "/api/account",
  "/api/team",
  "/api/admin",
  "/dashboard/admin",
  "/dashboard/billing",
  "/dashboard/team",
  "/dashboard/users",
  "/dashboard/profile",
] as const;

export function isHighRiskPath(pathname: string | null | undefined): boolean {
  if (!pathname) {
    return false;
  }
  return HIGH_RISK_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function mayUseCachedLocalSession(input: {
  pathname?: string | null;
  hasLocalUser: boolean;
  sessionUserId: string | null | undefined;
  identityCookie: string | null | undefined;
  verifiedAtMs: number | null | undefined;
  tokenIsFresh: boolean;
  now?: number;
}): boolean {
  if (isHighRiskPath(input.pathname)) {
    return false;
  }
  return shouldSkipAuthLookup(input);
}
