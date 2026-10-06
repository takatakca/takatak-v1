import "server-only";

import { createFixedWindowLimiter, hashedClientKey } from "@/lib/security/fixed-window-limiter";

const limiter = createFixedWindowLimiter({ windowMs: 10 * 60_000, max: 8 });

export function clientKeyFromHeaders(headers: Headers): string {
  return hashedClientKey(headers, "review-form");
}

export function allowPublicReviewSubmit(key: string, now = Date.now()): boolean {
  return limiter.allow(key, now);
}
