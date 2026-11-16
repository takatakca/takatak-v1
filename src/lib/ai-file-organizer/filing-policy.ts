/** Approval of a metadata overlay. No provider calls or source content writes. */
export type FilingStatus = "pending" | "approved" | "rejected" | "undone";
export type FilingAction = "approve" | "reject" | "undo";
export type FilingTransition =
  | { ok: true; status: FilingStatus }
  | { ok: false; code: "revision_conflict" | "transition_forbidden" | "entitlement_required" | "source_changed" };

export function decideFilingTransition(input: {
  currentStatus: FilingStatus;
  action: FilingAction;
  actualRevision: number;
  expectedRevision: number;
  sourceStillCurrent: boolean;
  enabledAndEntitled: boolean;
}): FilingTransition {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1 ||
    input.expectedRevision !== input.actualRevision) return { ok: false, code: "revision_conflict" };
  if (input.action === "reject" && input.currentStatus === "pending")
    return { ok: true, status: "rejected" };
  if (input.action === "undo" && input.currentStatus === "approved")
    return { ok: true, status: "undone" };
  if (input.action !== "approve" || input.currentStatus !== "pending")
    return { ok: false, code: "transition_forbidden" };
  if (!input.enabledAndEntitled) return { ok: false, code: "entitlement_required" };
  if (!input.sourceStillCurrent) return { ok: false, code: "source_changed" };
  return { ok: true, status: "approved" };
}

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9_-]{16,64}$/;
export function parseFilingProposalInput(value: unknown): {
  requestId: string; outputId: string; destinationProjectId: string;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string,unknown>;
  if (Object.keys(x).length !== 3 ||
    typeof x.requestId !== "string" || !ID.test(x.requestId) ||
    typeof x.outputId !== "string" || !UUID.test(x.outputId) ||
    typeof x.destinationProjectId !== "string" || !UUID.test(x.destinationProjectId) ||
    x.outputId.toLowerCase() === x.destinationProjectId.toLowerCase()) return null;
  return { requestId: x.requestId, outputId: x.outputId, destinationProjectId: x.destinationProjectId };
}
export function parseFilingDecisionInput(value: unknown): {
  action: FilingAction; expectedRevision: number;
} | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const x = value as Record<string,unknown>;
  if (Object.keys(x).length !== 2 || (x.action !== "approve" && x.action !== "reject" && x.action !== "undo") ||
    !Number.isInteger(x.expectedRevision) || (x.expectedRevision as number) < 1 ||
    (x.expectedRevision as number) > 1000000) return null;
  return { action: x.action, expectedRevision: x.expectedRevision as number };
}
