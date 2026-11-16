import { decideOrganizerAction, type OrganizerDecision, type OrganizerPolicy } from "./approval-policy";

const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

/** Metadata-only source. Original draft content, stored metadata and credentials never leave Studio. */
export interface OrganizerStudioSource {
  clientId: string;
  origin: string;
  status: string;
  source: string;
}
export interface OrganizerDestination {
  clientId: string;
}
export interface OrganizerStudioDependencies {
  /** Existing workspace membership + create_content permission; no browser-derived authority. */
  canManageWorkspace(clientId: string): Promise<boolean>;
  /** Existing billing subscription or trusted exemption; never a browser value. */
  hasOrganizerEntitlement(clientId: string): Promise<boolean>;
  /** Read SavedAiOutput by { id, clientId } with Studio source metadata filter. */
  loadStudioOutput(clientId: string, outputId: string): Promise<OrganizerStudioSource | null>;
  /** Resolve real, authorized destination storage; missing adapter must deny. */
  loadDestination(clientId: string, destinationId: string): Promise<OrganizerDestination | null>;
}
export interface StudioOrganizerPreview {
  clientId: string;
  outputId: string;
  destinationId: string;
  confidence: number;
  /** Server-persisted policy only; never trust an agent-supplied policy. */
  policy: Omit<OrganizerPolicy, "entitlementActive">;
}

/**
 * PREVIEW ONLY: never persists approval, modifies Studio metadata, moves originals,
 * performs AI inference, or charges credits. Caller must re-evaluate on write.
 */
export async function previewStudioOrganizerAction(
  deps: OrganizerStudioDependencies,
  input: StudioOrganizerPreview,
): Promise<OrganizerDecision> {
  if (input.policy.mode === "off" || !input.policy.consentGranted) return "disabled";
  if (!UUID.test(input.clientId) || !UUID.test(input.outputId)) return "blocked";
  if (!await deps.canManageWorkspace(input.clientId)) return "blocked";
  if (!await deps.hasOrganizerEntitlement(input.clientId)) return "blocked";
  const source = await deps.loadStudioOutput(input.clientId, input.outputId);
  if (!source || source.clientId !== input.clientId || source.source !== "takatakstudio_output" ||
    source.origin !== "ai_generated" || !["saved", "draft", "sent_to_approval"].includes(source.status)) return "blocked";
  const destination = await deps.loadDestination(input.clientId, input.destinationId);
  if (!destination || destination.clientId !== input.clientId) return "blocked";
  return decideOrganizerAction({ ...input.policy, entitlementActive: true }, {
    sourceKind: "studio", destinationId: input.destinationId,
    confidence: input.confidence, sourceClientId: source.clientId,
    destinationClientId: destination.clientId, activeClientId: input.clientId,
  });
}
