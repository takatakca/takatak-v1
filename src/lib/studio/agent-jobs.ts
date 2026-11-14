/**
 * Pure Studio agent-job policy: what a workspace member may see about a job,
 * which provider refusals debited nothing, and how an expired lease is
 * recovered. No I/O. The worker and routes call these; they never bypass them.
 */
export type StudioJobView = {
  id: string;
  status: string;
  scheduledFor: string | null;
  errorMessage: string | null;
  projectId: string | null;
  track: string | null;
  day: number | null;
  reconciliationRequired: boolean;
  /** Derived flag only: the held text itself is never listed. */
  hasRecoveryText: boolean;
};
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const TRACKS = ["video", "book", "music", "social"];
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function iso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}
/**
 * Whitelist for GET /api/studio/projects. Never returns operation, fingerprint,
 * actorId, engine, budgets, lease tokens or recoveryText.
 */
export function sanitizeStudioAgentJob(job: { id: string; status: string; scheduledFor?: unknown; errorMessage?: unknown; metadata?: unknown }): StudioJobView {
  const m = record(job.metadata);
  return {
    id: job.id,
    status: typeof job.status === "string" ? job.status : "unknown",
    scheduledFor: iso(job.scheduledFor),
    errorMessage: typeof job.errorMessage === "string" && job.errorMessage.length <= 80 && /^[a-z_]+$/.test(job.errorMessage) ? job.errorMessage : null,
    projectId: typeof m.projectId === "string" && UUID.test(m.projectId) ? m.projectId : null,
    track: typeof m.track === "string" && TRACKS.includes(m.track) ? m.track : null,
    day: typeof m.day === "number" && Number.isInteger(m.day) && m.day >= 0 && m.day <= 6 ? m.day : null,
    reconciliationRequired: m.reconciliationRequired === true,
    hasRecoveryText: typeof m.recoveryText === "string" && m.recoveryText.length > 0,
  };
}
/** Failed codes that keep a production blocked until an operator reconciles. */
export const STUDIO_BLOCKING_FAILURES: readonly string[] = [
  "requires_reconciliation", "timeout", "network", "provider_error", "empty", "rate_limited", "auth", "unsupported",
  "already_processed", "idempotency_conflict", "lease_expired_after_dispatch",
];
/** Operator clearance keeps the audit trail on the job itself; no second attempt is granted. */
export function reconcileStudioJobMetadata(metadata: unknown, operatorId: string, note: string, nowMs: number): Record<string, unknown> | null {
  if (!UUID.test(operatorId) || typeof note !== "string" || note.trim().length < 3 || note.length > 300 || /[\u0000-\u001f\u007f]/.test(note)) return null;
  return { ...record(metadata), reconciliationRequired: false, reconciledBy: operatorId, reconciledAt: new Date(nowMs).toISOString(), reconciliationNote: note.trim() };
}
