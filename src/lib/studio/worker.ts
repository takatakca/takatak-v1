import type { StudioGenerationRequest } from "./production";

/** Coordinates existing Job records only; never reclaims a running/billable task for a second provider call. */
export interface StudioWorkerJob {
  id: string;
  clientId: string | null;
  attempts: number;
  maxAttempts: number;
  metadata: unknown;
}
export interface StudioExpiredJob extends StudioWorkerJob {
  status: string;
  leaseOwner: string | null;
  leaseExpiresAt: Date | string | null;
}
export interface StudioWorkerTask {
  projectId: string;
  actorId: string;
  track: "video" | "book" | "music" | "social";
  engine: "auto" | "ollama";
  creditCeiling: number;
}
type GenerationResult = { ok: true; text: string; savedId: string | null; linked: boolean } |
  { ok: false; code: string };
export interface StudioWorkerOutcome {
  status: "completed" | "failed";
  errorMessage: string | null;
  metadata: Record<string, unknown>;
}
export interface StudioWorkerDependencies {
  source: string;
  findDue(): Promise<StudioWorkerJob | null>;
  claim(job: StudioWorkerJob): Promise<string | null>;
  actorAllowed(clientId: string, actorId: string): Promise<boolean>;
  currentPrice(): number | null;
  /** Persist dispatchedAt on the running job BEFORE the provider call; false means the lease was lost. */
  markDispatched(job: StudioWorkerJob, lease: string, metadata: Record<string, unknown>): Promise<boolean>;
  generate(clientId: string, input: StudioGenerationRequest): Promise<GenerationResult>;
  finish(job: StudioWorkerJob, lease: string, outcome: StudioWorkerOutcome): Promise<boolean>;
  /** Optional lease recovery: running jobs whose lease (plus grace) has expired. */
  findExpired?(): Promise<StudioExpiredJob[]>;
  recover?(job: StudioExpiredJob, outcome: StudioWorkerOutcome): Promise<boolean>;
  now?(): number;
}
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function iso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}
/**
 * TAK-TAK refusals returned BEFORE any credit debit (routing, key, balance,
 * project lookup). Nothing was billed, so they must not block the production.
 * Relay failures after a debit (timeout, network, provider_error, empty,
 * rate_limited, auth, unsupported) are refunded by the engine but the refund
 * itself can fail, so they stay reconciliation-required, as do replay codes.
 */
export const STUDIO_NON_BILLABLE_REFUSALS: readonly string[] = [
  "no_engine_connected", "unknown_engine", "engine_mode_mismatch", "unknown_mode", "mode_not_inline",
  "insufficient_credits", "project_not_found", "brief_too_large_for_engine",
];
export function refusalRequiresReconciliation(code: unknown): boolean {
  return !(typeof code === "string" && STUDIO_NON_BILLABLE_REFUSALS.includes(code));
}
export const STUDIO_LEASE_MS = 120_000;
/** Grace after lease expiry before recovery, so a slow finish() is not raced. */
export const STUDIO_LEASE_GRACE_MS = 60_000;
export type StudioLeaseRecovery = {
  status: "failed";
  errorMessage: "lease_expired_after_dispatch" | "lease_expired_before_dispatch";
  metadata: Record<string, unknown>;
};
/**
 * A running job whose lease expired is finalized without another provider
 * call. If the worker recorded dispatchedAt before calling the engine, a
 * debit may exist and the production stays blocked for reconciliation.
 * Otherwise nothing was billed and the production is released.
 */
export function recoverExpiredStudioLease(job: { status: string; leaseExpiresAt: unknown; metadata: unknown }, nowMs: number): StudioLeaseRecovery | null {
  const expires = iso(job.leaseExpiresAt);
  if (job.status !== "running" || !expires || Date.parse(expires) + STUDIO_LEASE_GRACE_MS > nowMs) return null;
  const metadata = record(job.metadata);
  const dispatched = typeof metadata.dispatchedAt === "string" && metadata.dispatchedAt.length > 0;
  return {
    status: "failed",
    errorMessage: dispatched ? "lease_expired_after_dispatch" : "lease_expired_before_dispatch",
    metadata: { ...metadata, reconciliationRequired: dispatched, leaseRecoveredAt: new Date(nowMs).toISOString() },
  };
}
export function parseStudioWorkerTask(value: unknown, source: string): StudioWorkerTask | null {
  const m = record(value);
  if (m.source !== source || m.version !== 1 || typeof m.operation !== "string" || !UUID.test(m.operation) ||
      typeof m.fingerprint !== "string" || !/^[a-f0-9]{64}$/i.test(m.fingerprint) ||
      typeof m.projectId !== "string" || !UUID.test(m.projectId) || typeof m.actorId !== "string" || !UUID.test(m.actorId) ||
      (typeof m.track !== "string" || !["video", "book", "music", "social"].includes(m.track)) ||
      (m.engine !== "auto" && m.engine !== "ollama") ||
      typeof m.day !== "number" || !Number.isInteger(m.day) || m.day < 0 || m.day > 6 ||
      typeof m.creditCeiling !== "number" || !Number.isSafeInteger(m.creditCeiling) || m.creditCeiling < 1 ||
      typeof m.budgetCredits !== "number" || !Number.isSafeInteger(m.budgetCredits) || m.budgetCredits < m.creditCeiling || m.budgetCredits > 1000) return null;
  return { projectId: m.projectId, actorId: m.actorId, track: m.track as StudioWorkerTask["track"],
    engine: m.engine, creditCeiling: m.creditCeiling };
}
/**
 * Finalize running jobs whose lease expired long ago (killed function, failed
 * finish). Never calls the provider. Returns how many were recovered.
 */
export async function recoverStudioLeases(deps: StudioWorkerDependencies): Promise<{ recovered: number; blocked: number }> {
  if (!deps.findExpired || !deps.recover) return { recovered: 0, blocked: 0 };
  const nowMs = (deps.now ?? Date.now)();
  let recovered = 0, blocked = 0;
  for (const job of await deps.findExpired()) {
    const outcome = recoverExpiredStudioLease(job, nowMs);
    if (!outcome) continue;
    try {
      if (await deps.recover(job, outcome)) { recovered += 1; if (outcome.metadata.reconciliationRequired === true) blocked += 1; }
    } catch { /* storage unavailable: the next tick retries recovery */ }
  }
  return { recovered, blocked };
}
/** Only one generation after an atomic single-attempt claim. Failures always require an operator or a new plan. */
export async function processStudioAgentTick(deps: StudioWorkerDependencies) {
  const leases = await recoverStudioLeases(deps);
  const job = await deps.findDue();
  if (!job) return { state: "idle" as const, leases };
  // A reset status must never grant another billable attempt.
  if (!job.clientId || job.attempts !== 0 || job.maxAttempts !== 1) return { state: "needs_attention" as const, leases };
  const lease = await deps.claim(job);
  if (!lease) return { state: "contended" as const, leases };
  const metadata = record(job.metadata);
  let generationStarted = false;
  let outcome: StudioWorkerOutcome;
  try {
    const task = parseStudioWorkerTask(metadata, deps.source);
    if (!task) {
      outcome = { status: "failed", errorMessage: "invalid_task", metadata: { ...metadata, reconciliationRequired: false } };
    } else if (!await deps.actorAllowed(job.clientId, task.actorId)) {
      outcome = { status: "failed", errorMessage: "authorization_changed", metadata: { ...metadata, reconciliationRequired: false } };
    } else if (deps.currentPrice() !== task.creditCeiling) {
      outcome = { status: "failed", errorMessage: "credit_price_changed", metadata: { ...metadata, reconciliationRequired: false } };
    } else {
      const dispatchedAt = new Date((deps.now ?? Date.now)()).toISOString();
      // Record the dispatch first: a job killed after this point is recovered as possibly billed.
      if (!await deps.markDispatched(job, lease, { ...metadata, dispatchedAt })) return { state: "contended" as const, leases };
      generationStarted = true;
      const result = await deps.generate(job.clientId, { projectId: task.projectId, track: task.track, requestId: job.id, engine: task.engine });
      if (!result.ok) {
        // The central engine owns debits/refunds. A refusal is retained, never automatically replayed.
        // Refusals returned before any debit release the production; post-debit failures stay held.
        outcome = { status: "failed", errorMessage: result.code, metadata: { ...metadata, dispatchedAt, reconciliationRequired: refusalRequiresReconciliation(result.code) } };
      } else {
        const linked = Boolean(result.savedId && result.linked);
        outcome = { status: "completed", errorMessage: linked ? null : "output_link_requires_reconciliation",
          metadata: { ...metadata, dispatchedAt, outputId: result.savedId, linked, published: false, reconciliationRequired: !linked,
            ...(!result.savedId ? { recoveryText: result.text.slice(0, 20000) } : {}) } };
      }
    }
  } catch {
    outcome = { status: "failed", errorMessage: generationStarted ? "requires_reconciliation" : "preflight_unavailable",
      metadata: { ...metadata, ...(generationStarted ? { dispatchedAt: new Date((deps.now ?? Date.now)()).toISOString() } : {}), reconciliationRequired: generationStarted } };
  }
  try {
    // A stale lease or an uncertain write cannot be reported as completed and must not re-run generation.
    const finalized = await deps.finish(job, lease, outcome);
    return { state: finalized && outcome.status === "completed" && !outcome.metadata.reconciliationRequired ? "draft_ready" as const : "needs_attention" as const, leases };
  } catch {
    // Storage unavailable: the running claim stays held; the lease recovery pass finalizes it after expiry + grace.
    return { state: "needs_attention" as const, leases };
  }
}
