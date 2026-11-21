// Claude (Anthropic) · 2026-11-21 — store reviewer access for the native app (Google Play / Amazon / Apple ask for
// a working sign-in). Off unless both TAKATAK_MOBILE_REVIEW_EMAIL and TAKATAK_MOBILE_REVIEW_CODE (6 digits) are set
// on the server; the owner types them there and in the store console, never in the repository.
// A reviewer sign-in never reaches Supabase or the database: the phone gets a "review" session that no real
// /api/mobile/v1 route accepts (it is not a JWT), and the app then shows only its built-in fictitious data.
import { createHash, timingSafeEqual } from "node:crypto";

export const REVIEW_TOKEN = "review";
export const REVIEW_SESSION_SECONDS = 30 * 24 * 3600;

type ReviewConfig = { email: string; code: string };

export function reviewAccessConfig(env: Record<string, string | undefined> = process.env): ReviewConfig | null {
  const email = env.TAKATAK_MOBILE_REVIEW_EMAIL?.trim().toLowerCase() ?? "";
  const code = env.TAKATAK_MOBILE_REVIEW_CODE?.trim() ?? "";
  if (!email.includes("@") || !/^\d{6}$/.test(code)) return null;
  return { email, code };
}

export function isReviewEmail(email: string, config = reviewAccessConfig()): boolean {
  return Boolean(config) && email.trim().toLowerCase() === config!.email;
}

const digest = (value: string) => createHash("sha256").update(value).digest();

export function isReviewCode(code: string, config = reviewAccessConfig()): boolean {
  if (!config) return false;
  return timingSafeEqual(digest(code), digest(config.code));
}

export function reviewSession(nowSeconds = Math.floor(Date.now() / 1000)) {
  return { accessToken: REVIEW_TOKEN, refreshToken: REVIEW_TOKEN, expiresAt: nowSeconds + REVIEW_SESSION_SECONDS };
}
