import "server-only";

import { createHash } from "node:crypto";

// Per-process fixed-window limiter for anonymous public endpoints. Keys are
// hashed and live only in memory. With several processes it is a soft limit,
// which is acceptable as a spam brake (not as a security boundary).

export interface FixedWindowLimiter {
  allow(key: string, now?: number): boolean;
}

export function createFixedWindowLimiter(options: { windowMs: number; max: number; maxKeys?: number }): FixedWindowLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  const maxKeys = options.maxKeys ?? 5_000;
  return {
    allow(key: string, now = Date.now()): boolean {
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value as string);
        }
        hits.set(key, { count: 1, resetAt: now + options.windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= options.max;
    },
  };
}

export function hashedClientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`${scope}:${ip}`).digest("hex").slice(0, 32);
}
