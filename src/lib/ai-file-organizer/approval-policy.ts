/**
 * AI File Organizer: deterministic, side-effect-free approval policy.
 * This module never moves files or grants access. Call only after the existing
 * TAKATAK server has resolved workspace identity and paid entitlement.
 */
export type OrganizerMode = "off" | "suggest" | "auto";
export type OrganizerDecision = "disabled" | "blocked" | "approval_required" | "auto_approved";
export interface OrganizerPolicy {
  mode: OrganizerMode;
  consentGranted: boolean;
  entitlementActive: boolean;
  allowedSourceKinds: readonly string[];
  allowedDestinationIds: readonly string[];
  minimumConfidence: number;
  requireApproval: boolean;
}
export interface OrganizerCandidate {
  sourceKind: string;
  destinationId: string;
  confidence: number;
  sourceClientId: string;
  destinationClientId: string;
  activeClientId: string;
}
export function decideOrganizerAction(policy: OrganizerPolicy, candidate: OrganizerCandidate): OrganizerDecision {
  if (policy.mode === "off" || !policy.consentGranted) return "disabled";
  if (!policy.entitlementActive) return "blocked";
  if (!candidate.activeClientId || candidate.sourceClientId !== candidate.activeClientId ||
      candidate.destinationClientId !== candidate.activeClientId) return "blocked";
  if (!policy.allowedSourceKinds.includes(candidate.sourceKind) ||
      !policy.allowedDestinationIds.includes(candidate.destinationId)) return "blocked";
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 ||
      candidate.confidence > 1 || !Number.isFinite(policy.minimumConfidence) ||
      policy.minimumConfidence < 0 || policy.minimumConfidence > 1) return "blocked";
  if (policy.mode === "suggest" || policy.requireApproval ||
      candidate.confidence < policy.minimumConfidence) return "approval_required";
  return "auto_approved";
}
