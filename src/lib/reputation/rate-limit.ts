import "server-only";

import { createHash } from "node:crypto";

// Per-process fixed-window limiter for the public review form. Keys are hashed
// client addresses that live only in memory; nothing is persisted. With several
// processes this is a soft limit, which is acceptable for a spam brake.

const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 8;
const MAX_KEYS = 5_000;

const hits = new Map<string, { count: number; resetAt: number }>();

export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`review-form:${ip}`).digest("hex").slice(0, 32);
}

export function allowPublicReviewSubmit(key: string, now = Date.now()): boolean {
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    if (hits.size >= MAX_KEYS) {
      for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      if (hits.size >= MAX_KEYS) hits.delete(hits.keys().next().value as string);
    }
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}
