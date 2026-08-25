import "server-only";

/**
 * Lightweight in-process rate limits for competitor add/refresh.
 * Not a substitute for Meta Graph rate limits — prevents abuse.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function take(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function assertCompetitorRateLimit(options: {
  profileId: string;
  clientId: string;
  businessBrandId: string;
  action: "add" | "refresh" | "list";
}): { ok: true } | { ok: false; message: string } {
  const windowMs = 60_000;
  const limits =
    options.action === "add"
      ? { user: 5, workspace: 20, brand: 10 }
      : options.action === "refresh"
        ? { user: 10, workspace: 30, brand: 20 }
        : { user: 60, workspace: 120, brand: 60 };

  if (
    !take(`u:${options.action}:${options.profileId}`, limits.user, windowMs) ||
    !take(`c:${options.action}:${options.clientId}`, limits.workspace, windowMs) ||
    !take(
      `b:${options.action}:${options.clientId}:${options.businessBrandId}`,
      limits.brand,
      windowMs,
    )
  ) {
    return {
      ok: false,
      message: "Too many competitor requests. Please wait a minute and try again.",
    };
  }
  return { ok: true };
}

/** Test-only reset. */
export function resetCompetitorRateLimitsForTests(): void {
  buckets.clear();
}
