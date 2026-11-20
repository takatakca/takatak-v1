/**
 * Pure per-workspace Studio limits. Credits remain the central ledger's
 * authority; these caps only bound how much work a workspace can queue.
 */
export const STUDIO_MAX_OPEN_PLANS = 2;
export const STUDIO_MAX_PROJECTS_PER_DAY = 50;
export const STUDIO_GENERATE_PER_MINUTE = 6;
export const DAY_MS = 24 * 60 * 60 * 1000;
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
/** Distinct plan operations still queued/running for a workspace. A job without an operation counts on its own. */
export function openStudioPlanCount(jobs: readonly { id?: string; status: string; metadata: unknown }[]): number {
  const operations = new Set<string>();
  for (const job of jobs) {
    if (job.status !== "queued" && job.status !== "running") continue;
    const operation = record(job.metadata).operation;
    operations.add(typeof operation === "string" ? `op:${operation}` : `job:${job.id ?? operations.size}`);
  }
  return operations.size;
}
export type StudioQueueDecision = { ok: true } | { ok: false; code: "plan_limit" | "insufficient_credits" | "balance_unavailable" };
export function canQueueStudioPlan(input: { openPlans: number; balance: number | null; firstTaskPrice: number }): StudioQueueDecision {
  if (!Number.isSafeInteger(input.openPlans) || input.openPlans >= STUDIO_MAX_OPEN_PLANS) return { ok: false, code: "plan_limit" };
  if (input.balance === null || !Number.isFinite(input.balance)) return { ok: false, code: "balance_unavailable" };
  if (!Number.isSafeInteger(input.firstTaskPrice) || input.firstTaskPrice < 1 || input.balance < input.firstTaskPrice) return { ok: false, code: "insufficient_credits" };
  return { ok: true };
}
export function canCreateStudioProject(createdLast24h: number): boolean {
  return Number.isSafeInteger(createdLast24h) && createdLast24h >= 0 && createdLast24h < STUDIO_MAX_PROJECTS_PER_DAY;
}
/**
 * Fixed-window in-memory limiter, one counter per key (workspace). It lives in
 * one process: each instance counts separately and a restart resets it. It is a
 * burst brake on top of the credit balance, not a billing control.
 */
export function createStudioRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number; now?: () => number }) {
  const limit = options.limit, windowMs = options.windowMs, maxKeys = options.maxKeys ?? 10_000, now = options.now ?? Date.now;
  const windows = new Map<string, { startedAt: number; count: number }>();
  function sweep(at: number) {
    for (const [key, w] of windows) if (at - w.startedAt >= windowMs) windows.delete(key);
    if (windows.size > maxKeys) windows.clear();
  }
  return {
    take(key: string): { ok: true; remaining: number } | { ok: false; retryAfterMs: number } {
      const at = now();
      if (windows.size >= maxKeys) sweep(at);
      const w = windows.get(key);
      if (!w || at - w.startedAt >= windowMs) { windows.set(key, { startedAt: at, count: 1 }); return { ok: true, remaining: limit - 1 }; }
      if (w.count >= limit) return { ok: false, retryAfterMs: Math.max(1, w.startedAt + windowMs - at) };
      w.count += 1;
      return { ok: true, remaining: limit - w.count };
    },
    size(): number { return windows.size; },
  };
}
