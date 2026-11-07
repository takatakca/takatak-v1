export const R2F_OPPORTUNITY_STATES = [
  "new", "qualified", "internal_candidate", "partner_candidate", "distributed",
  "contacted", "won", "lost", "completed", "cancelled",
] as const;

export type R2FOpportunityState = (typeof R2F_OPPORTUNITY_STATES)[number];
export type R2FPublicOpportunityStatus =
  | "received" | "in_review" | "matched" | "in_progress" | "finished" | "closed";

const ALLOWED_NEXT: Record<R2FOpportunityState, readonly R2FOpportunityState[]> = {
  new: ["qualified", "cancelled"],
  qualified: ["internal_candidate", "partner_candidate", "lost", "cancelled"],
  internal_candidate: ["distributed", "contacted", "lost", "cancelled"],
  partner_candidate: ["distributed", "lost", "cancelled"],
  distributed: ["contacted", "lost", "cancelled"],
  contacted: ["won", "lost", "cancelled"],
  won: ["completed", "cancelled"],
  lost: [], completed: [], cancelled: [],
};

const PUBLIC_STATUS: Record<R2FOpportunityState, R2FPublicOpportunityStatus> = {
  new: "received", qualified: "in_review",
  internal_candidate: "in_review", partner_candidate: "in_review",
  distributed: "matched", contacted: "in_progress", won: "in_progress",
  lost: "closed", completed: "finished", cancelled: "closed",
};

export function isR2FOpportunityState(value: unknown): value is R2FOpportunityState {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ALLOWED_NEXT, value);
}

export type R2FTransitionResult =
  | { allowed: true; changed: boolean }
  | { allowed: false; reason: "unknown_state" | "forbidden_transition" };

export function evaluateR2FOpportunityTransition(from: unknown, to: unknown): R2FTransitionResult {
  if (!isR2FOpportunityState(from) || !isR2FOpportunityState(to)) {
    return { allowed: false, reason: "unknown_state" };
  }
  if (from === to) return { allowed: true, changed: false };
  if (ALLOWED_NEXT[from].includes(to)) return { allowed: true, changed: true };
  return { allowed: false, reason: "forbidden_transition" };
}

export function toR2FPublicOpportunityStatus(state: unknown): R2FPublicOpportunityStatus | null {
  return isR2FOpportunityState(state) ? PUBLIC_STATUS[state] : null;
}

export interface R2FPublicOpportunityProjection {
  version: 1;
  reference: string;
  status: R2FPublicOpportunityStatus;
  updatedAt: string;
}

export function buildR2FPublicOpportunityProjection(input: {
  reference: unknown; state: unknown; updatedAt: unknown;
}): R2FPublicOpportunityProjection | null {
  const status = toR2FPublicOpportunityStatus(input.state);
  if (!status || typeof input.reference !== "string" ||
      !/^[A-Za-z0-9_-]{8,64}$/.test(input.reference) ||
      typeof input.updatedAt !== "string") return null;
  const timestamp = new Date(input.updatedAt);
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== input.updatedAt) {
    return null;
  }
  return { version: 1, reference: input.reference, status, updatedAt: input.updatedAt };
}
