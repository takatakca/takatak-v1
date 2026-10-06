// Soft, process-local limiter for public website requests. It is a first
// line of defence only: the database-level flood guard in store.ts is the
// authoritative cap because several app processes may run in parallel.

import { createHash } from "node:crypto";

export const PER_SOURCE_LIMIT = 5;
export const PER_SOURCE_WINDOW_MS = 10 * 60 * 1000;
const MAX_TRACKED_SOURCES = 5_000;

const hits = new Map<string, number[]>();

/** Hash the caller address so raw IPs are never stored or logged. */
export function hashRequestSource(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(`website-leads:${address}`).digest("hex").slice(0, 32);
}

export function allowRequest(sourceHash: string, now = Date.now()): boolean {
  const windowStart = now - PER_SOURCE_WINDOW_MS;
  const recent = (hits.get(sourceHash) ?? []).filter((t) => t > windowStart);
  if (recent.length >= PER_SOURCE_LIMIT) {
    hits.set(sourceHash, recent);
    return false;
  }
  recent.push(now);
  hits.delete(sourceHash);
  hits.set(sourceHash, recent);
  if (hits.size > MAX_TRACKED_SOURCES) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }
  return true;
}

export function resetRateLimitForTests(): void {
  hits.clear();
}
