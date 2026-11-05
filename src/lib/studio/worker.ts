import type { StudioGenerationRequest } from "./production";

/** Coordinates existing Job records only; never reclaims a running/billable task. */
export interface StudioWorkerJob {
  id: string;
  clientId: string | null;
  attempts: number;
  maxAttempts: number;
  metadata: unknown;
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
  generate(clientId: string, input: StudioGenerationRequest): Promise<GenerationResult>;
  finish(job: StudioWorkerJob, lease: string, outcome: StudioWorkerOutcome): Promise<boolean>;
}
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
/** Only one generation after an atomic single-attempt claim. Failures always require an operator. */
export async function processStudioAgentTick(deps: StudioWorkerDependencies) {
  const job = await deps.findDue();
  if (!job) return { state: "idle" as const };
  // A reset status must never grant another billable attempt.
  if (!job.clientId || job.attempts !== 0 || job.maxAttempts !== 1) return { state: "needs_attention" as const };
  const lease = await deps.claim(job);
  if (!lease) return { state: "contended" as const };
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
      generationStarted = true;
      const result = await deps.generate(job.clientId, { projectId: task.projectId, track: task.track, requestId: job.id, engine: task.engine });
      if (!result.ok) {
        // The central engine owns debits/refunds. A refusal is retained, never automatically replayed.
        outcome = { status: "failed", errorMessage: result.code, metadata: { ...metadata, reconciliationRequired: true } };
      } else {
        const linked = Boolean(result.savedId && result.linked);
        outcome = { status: "completed", errorMessage: linked ? null : "output_link_requires_reconciliation",
          metadata: { ...metadata, outputId: result.savedId, linked, published: false, reconciliationRequired: !linked,
            ...(!result.savedId ? { recoveryText: result.text.slice(0, 20000) } : {}) } };
      }
    }
  } catch {
    outcome = { status: "failed", errorMessage: generationStarted ? "requires_reconciliation" : "preflight_unavailable",
      metadata: { ...metadata, reconciliationRequired: generationStarted } };
  }
  try {
    // A stale lease or an uncertain write cannot be reported as completed and must not re-run generation.
    const finalized = await deps.finish(job, lease, outcome);
    return { state: finalized && outcome.status === "completed" && !outcome.metadata.reconciliationRequired ? "draft_ready" as const : "needs_attention" as const };
  } catch {
    // Keep the running claim held if storage is unavailable. Reconcile the stable request ID manually.
    return { state: "needs_attention" as const };
  }
}
