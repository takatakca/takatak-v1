import type { User } from "@supabase/supabase-js";
import { cookieUserMatchesAccessToken } from "@/lib/security/authenticated-identity";

export const AUTH_STATUS_HEADER = "x-takatak-auth-status";
export const AUTH_USER_ID_HEADER = "x-takatak-auth-user-id";
export const PATHNAME_HEADER = "x-takatak-pathname";

export const INTERNAL_AUTH_HEADER_NAMES = [
  AUTH_STATUS_HEADER,
  AUTH_USER_ID_HEADER,
  PATHNAME_HEADER,
] as const;

type HeaderMutator = {
  delete: (name: string) => void;
  set: (name: string, value: string) => void;
  get?: (name: string) => string | null;
};

export function stripInternalAuthHeaders(headers: HeaderMutator): void {
  for (const name of INTERNAL_AUTH_HEADER_NAMES) {
    headers.delete(name);
  }
}

export function applyTrustedAuthRequestHeaders(
  headers: HeaderMutator,
  input: {
    status: AuthStatus;
    pathname: string;
    userId?: string | null;
  },
): void {
  stripInternalAuthHeaders(headers);
  headers.set(AUTH_STATUS_HEADER, input.status);
  headers.set(PATHNAME_HEADER, input.pathname);
  const userId = input.userId?.trim() ?? "";
  if (userId) {
    headers.set(AUTH_USER_ID_HEADER, userId);
  }
}

export type AuthStatus =
  | "authenticated"
  | "anonymous"
  | "expired"
  | "network";

export type AuthResolution =
  | { status: "authenticated"; user: User }
  | { status: "anonymous" }
  | { status: "expired" }
  | { status: "network" };

/** Minimal auth surface shared by the proxy and the server cookie client. */
export type AuthUserClient = {
  auth: {
    getUser: () => Promise<{
      data: { user: User | null };
      error: { message?: string; code?: string; name?: string; status?: number } | null;
    }>;
    signOut: (options?: {
      scope?: "global" | "local" | "others";
    }) => Promise<unknown>;
  };
};

const STALE_SESSION_CODES = new Set([
  "refresh_token_not_found",
  "refresh_token_already_used",
  "session_not_found",
]);

const AUTH_LOOKUP_TIMEOUT_MS = 4_000;

export function hasSupabaseAuthCookie(
  cookies: Array<{ name: string; value?: string }>,
): boolean {
  return cookies.some(
    (cookie) =>
      cookie.name.includes("-auth-token") && Boolean(cookie.value),
  );
}

/**
 * True when the Auth API rejected the stored refresh token.
 * These cookies can never recover — the user must sign in again.
 */
export function isStaleAuthSessionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  if (STALE_SESSION_CODES.has(code)) return true;

  const message =
    error instanceof Error
      ? error.message
      : "message" in error && typeof error.message === "string"
        ? error.message
        : "";

  return /invalid refresh token|refresh token not found|refresh token already used/i.test(
    message,
  );
}

export function isAuthNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  if (name === "AuthRetryableFetchError") return true;

  const status = "status" in error && typeof error.status === "number" ? error.status : null;
  if (status === 0) return true;

  const message =
    error instanceof Error
      ? error.message
      : "message" in error && typeof error.message === "string"
        ? error.message
        : "";

  return /fetch failed|failed to fetch|networkerror|network request failed|load failed|aborted|timeout|econnreset|enotfound|etimedout/i.test(
    message,
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("fetch failed");
      error.name = "AuthRetryableFetchError";
      reject(error);
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const base64 = `${padded}${"=".repeat(padLength)}`;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf8");
  }
  const binary = atob(base64);
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
}

function parseJsonText(raw: string): unknown {
  const candidates = [raw];
  try {
    candidates.push(decodeURIComponent(raw));
  } catch {
    // Cookie values from Next are usually already decoded.
  }

  for (const candidate of candidates) {
    const jsonText = candidate.startsWith("base64-")
      ? decodeBase64Url(candidate.slice("base64-".length))
      : candidate;
    try {
      return JSON.parse(jsonText);
    } catch {
      // Try the next encoding.
    }
  }

  return null;
}

function authStorageKey(name: string): string | null {
  if (!name.includes("-auth-token") || name.includes("code-verifier")) {
    return null;
  }
  return name.replace(/\.\d+$/, "");
}

export function supabaseAuthStorageKeyFromUrl(
  url: string | null | undefined,
): string | null {
  const raw = url?.trim() ?? "";
  if (!raw) return null;
  try {
    const host = new URL(raw).hostname;
    const ref = host.split(".")[0]?.trim();
    if (!ref) return null;
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
}

function preferredAuthStorageKey(): string | null {
  return supabaseAuthStorageKeyFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

function jwtIssuedAt(accessToken: string): number {
  const parts = accessToken.split(".");
  if (parts.length < 2) return 0;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as {
      iat?: unknown;
    };
    return typeof payload.iat === "number" ? payload.iat : 0;
  } catch {
    return 0;
  }
}

function sessionIssuedAt(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const record = value as {
    access_token?: unknown;
  };
  if (typeof record.access_token === "string") {
    return jwtIssuedAt(record.access_token);
  }
  return 0;
}

function cookiePresent(byName: Map<string, string>, name: string): boolean {
  return (byName.get(name) ?? "").length > 0;
}

function existingStorageKeyCookieNames(
  byName: Map<string, string>,
  key: string,
): string[] {
  const names: string[] = [];
  if (cookiePresent(byName, key)) names.push(key);
  for (let index = 0; index < 10; index += 1) {
    const name = `${key}.${index}`;
    if (cookiePresent(byName, name)) names.push(name);
  }
  return names;
}

function rawSessionForStorageKey(
  byName: Map<string, string>,
  key: string,
): { raw: string; issuedAt: number } | null {
  const candidates: string[] = [];
  const whole = byName.get(key);
  if (whole) candidates.push(whole);

  const parts: string[] = [];
  for (let index = 0; ; index += 1) {
    const part = byName.get(`${key}.${index}`);
    if (!part) break;
    parts.push(part);
    const joined = parts.join("");
    const parsed = parseJsonText(joined);
    if (parsed) candidates.push(joined);
  }

  let bestRaw: string | null = null;
  let bestIssuedAt = -1;
  for (const raw of candidates) {
    const parsed = parseJsonText(raw);
    const issuedAt = sessionIssuedAt(parsed);
    if (issuedAt >= bestIssuedAt) {
      bestIssuedAt = issuedAt;
      bestRaw = raw;
    }
  }

  return bestRaw ? { raw: bestRaw, issuedAt: bestIssuedAt } : null;
}

function authStorageKeys(
  cookies: Array<{ name: string; value?: string }>,
): string[] {
  const keys = new Set<string>();
  for (const cookie of cookies) {
    const key = authStorageKey(cookie.name);
    if (key && cookie.value) keys.add(key);
  }
  return [...keys];
}

function combineAuthCookieValue(
  cookies: Array<{ name: string; value?: string }>,
): string | null {
  const byName = new Map(
    cookies.map((cookie) => [cookie.name, cookie.value ?? ""]),
  );
  const keys = authStorageKeys(cookies);
  const preferred = preferredAuthStorageKey();
  const eligible =
    preferred && keys.includes(preferred)
      ? [preferred]
      : preferred
        ? []
        : keys;

  let bestRaw: string | null = null;
  let bestIssuedAt = -1;

  for (const key of eligible) {
    const selected = rawSessionForStorageKey(byName, key);
    if (!selected) continue;
    if (selected.issuedAt >= bestIssuedAt) {
      bestIssuedAt = selected.issuedAt;
      bestRaw = selected.raw;
    }
  }

  return bestRaw;
}

export function authCookieNamesToDiscard(
  cookies: Array<{ name: string; value?: string }>,
  keepUserId: string,
): string[] {
  const keep = keepUserId.trim();
  if (!keep) return [];

  const byName = new Map(
    cookies.map((cookie) => [cookie.name, cookie.value ?? ""]),
  );
  const preferred = preferredAuthStorageKey();
  const names = new Set<string>();

  for (const key of authStorageKeys(cookies)) {
    if (preferred && key !== preferred) {
      for (const name of existingStorageKeyCookieNames(byName, key)) {
        names.add(name);
      }
      continue;
    }

    const whole = byName.get(key) ?? "";
    const wholeUser = whole
      ? userFromSessionPayload(parseJsonText(whole))
      : null;
    const selected = rawSessionForStorageKey(byName, key);
    const selectedUser = selected
      ? userFromSessionPayload(parseJsonText(selected.raw))
      : null;

    if (wholeUser?.id === keep) {
      for (const name of existingStorageKeyCookieNames(byName, key)) {
        if (name !== key) names.add(name);
      }
      continue;
    }

    if (wholeUser && wholeUser.id !== keep) {
      names.add(key);
    }

    if (selectedUser && selectedUser.id !== keep && wholeUser?.id !== keep) {
      for (const name of existingStorageKeyCookieNames(byName, key)) {
        names.add(name);
      }
    }
  }

  return [...names];
}

function userFromJwtPayload(payload: Record<string, unknown>): User | null {
  const id = payload.sub;
  if (typeof id !== "string" || !id) return null;

  const email = typeof payload.email === "string" ? payload.email : undefined;
  const metadata =
    payload.user_metadata && typeof payload.user_metadata === "object"
      ? (payload.user_metadata as Record<string, unknown>)
      : {};
  const appMetadata =
    payload.app_metadata && typeof payload.app_metadata === "object"
      ? (payload.app_metadata as Record<string, unknown>)
      : {};

  const confirmedAt =
    typeof payload.email_confirmed_at === "string"
      ? payload.email_confirmed_at
      : payload.email_verified === true
        ? typeof payload.iat === "number"
          ? new Date(payload.iat * 1000).toISOString()
          : "1970-01-01T00:00:00.000Z"
        : undefined;

  return {
    id,
    aud: typeof payload.aud === "string" ? payload.aud : "authenticated",
    role: typeof payload.role === "string" ? payload.role : "authenticated",
    email,
    email_confirmed_at: confirmedAt,
    phone: typeof payload.phone === "string" ? payload.phone : "",
    app_metadata: appMetadata,
    user_metadata: metadata,
    identities: [],
    created_at: "",
    updated_at: "",
    is_anonymous: payload.is_anonymous === true,
  } as User;
}

function userFromSessionPayload(value: unknown): User | null {
  if (!value || typeof value !== "object") return null;
  const record = value as {
    user?: unknown;
    access_token?: unknown;
  };

  if (typeof record.access_token !== "string") {
    return null;
  }

  const parts = record.access_token.split(".");
  if (parts.length < 2) {
    return null;
  }

  let jwtUser: User | null = null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as Record<
      string,
      unknown
    >;
    jwtUser = userFromJwtPayload(payload);
  } catch {
    return null;
  }

  if (!jwtUser) {
    return null;
  }

  const stored = record.user;
  if (stored && typeof stored === "object") {
    const cookieUser = stored as { id?: unknown; email?: unknown };
    if (
      !cookieUserMatchesAccessToken({
        accessTokenUserId: jwtUser.id,
        accessTokenEmail: jwtUser.email,
        cookieUserId: typeof cookieUser.id === "string" ? cookieUser.id : null,
        cookieUserEmail:
          typeof cookieUser.email === "string" ? cookieUser.email : null,
      })
    ) {
      return null;
    }
  }

  return jwtUser;
}

/**
 * Read the JWT already on the request cookies. This does not call Auth
 * and does not use getSession(), which warns when session.user is accessed.
 */
export function readLocalSessionUser(
  cookies: Array<{ name: string; value?: string }>,
): User | null {
  try {
    const raw = combineAuthCookieValue(cookies);
    if (!raw) return null;
    return userFromSessionPayload(parseJsonText(raw));
  } catch {
    return null;
  }
}

/**
 * True when the cookie JWT is still valid long enough that the proxy can
 * skip getUser(). Near-expiry tokens still go through Auth so cookies refresh.
 */
export function isLocalAccessTokenFresh(
  cookies: Array<{ name: string; value?: string }>,
  skewMs = 60_000,
): boolean {
  try {
    const raw = combineAuthCookieValue(cookies);
    if (!raw) return false;
    const parsed = parseJsonText(raw);
    if (!parsed || typeof parsed !== "object") return false;
    const token = (parsed as { access_token?: unknown }).access_token;
    if (typeof token !== "string") return false;
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const payload = JSON.parse(decodeBase64Url(parts[1])) as {
      exp?: unknown;
    };
    if (typeof payload.exp !== "number") return true;
    return payload.exp * 1000 > Date.now() + skewMs;
  } catch {
    return false;
  }
}

/**
 * Resolve the current user without throwing.
 * Stale sessions are cleared. Network failures are not treated as sign-out.
 */
export async function resolveAuthUser(
  supabase: AuthUserClient,
  options?: { hasAuthCookie?: boolean; timeoutMs?: number },
): Promise<AuthResolution> {
  if (options?.hasAuthCookie === false) {
    return { status: "anonymous" };
  }

  try {
    const lookup = supabase.auth.getUser();
    void lookup.catch(() => undefined);
    const {
      data: { user },
      error,
    } = await withTimeout(lookup, options?.timeoutMs ?? AUTH_LOOKUP_TIMEOUT_MS);

    if (error && isStaleAuthSessionError(error)) {
      await signOutLocal(supabase);
      return { status: "expired" };
    }

    if (error && isAuthNetworkError(error)) {
      return { status: "network" };
    }

    if (error || !user) {
      if (options?.hasAuthCookie) {
        await signOutLocal(supabase);
        return { status: "expired" };
      }
      return { status: "anonymous" };
    }

    return { status: "authenticated", user };
  } catch (error) {
    if (isStaleAuthSessionError(error)) {
      await signOutLocal(supabase);
      return { status: "expired" };
    }
    if (isAuthNetworkError(error)) {
      return { status: "network" };
    }
    return { status: options?.hasAuthCookie ? "expired" : "anonymous" };
  }
}

async function signOutLocal(supabase: AuthUserClient): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Cookie writes can fail in Server Components; the proxy is the
    // path that actually persists the cleared session.
  }
}
