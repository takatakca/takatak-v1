// Claude (Anthropic) · 2026-11-21 — pure helpers for the native TAKATAK app API (/api/mobile/v1).
// The phone app signs in with the same email code as the website, then keeps the Supabase access and
// refresh tokens in the phone's secure storage (Keychain / Keystore) and sends the access token as
// "Authorization: Bearer". No cookie is involved, so the browser session rules stay untouched.

/** Supabase access tokens are three base64url parts. Anything else is refused before any network call. */
const JWT_SHAPE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

export function readBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1]!;
  if (token.length > 8192 || !JWT_SHAPE.test(token)) return null;
  return token;
}

/** Workspace ids are UUIDs. A malformed header is ignored and the default workspace is used. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readWorkspaceHeader(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return UUID.test(trimmed) ? trimmed.toLowerCase() : null;
}

export type MobileSession = {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
};

/** Keep only the three fields the app needs. The provider token and raw user object never leave the server. */
export function toMobileSession(session: {
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
  expires_in?: number | null;
} | null | undefined, nowSeconds = Math.floor(Date.now() / 1000)): MobileSession | null {
  if (!session?.access_token || !session.refresh_token) return null;
  const expiresAt =
    typeof session.expires_at === "number" && Number.isFinite(session.expires_at)
      ? session.expires_at
      : nowSeconds + (typeof session.expires_in === "number" ? session.expires_in : 3600);
  return { accessToken: session.access_token, refreshToken: session.refresh_token, expiresAt };
}

/** Email codes are 6 to 10 digits (Supabase setting). */
export function normalizeEmailCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/\s+/g, "");
  return /^\d{6,10}$/.test(digits) ? digits : null;
}

/** Refresh tokens are short opaque strings. */
export function normalizeRefreshToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const token = value.trim();
  return token.length >= 8 && token.length <= 512 && /^[A-Za-z0-9_.-]+$/.test(token) ? token : null;
}

/** Lists sent to the phone are capped; the full list stays on the website. */
export const MOBILE_LIST_LIMIT = 200;
