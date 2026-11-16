import { parseOrganizerSettingsUpdate, type OrganizerSettingsUpdate } from "./settings-policy";

export type OrganizerUiDraft = {
  mode: "off" | "suggest";
  consentGranted: boolean;
  providerProcessingConsent: boolean;
  allowedDestinationIds: string[];
  minimumConfidence: number;
};

/**
 * Build only the supported payload. The browser never sends tenant identity,
 * billing grants, file paths or a self-elevated automatic processing mode.
 * The route revalidates projects against the signed workspace identity.
 */
export function organizerSettingsSavePayload(
  draft: OrganizerUiDraft,
  expectedRevision: number,
  visibleProjectIds: readonly string[],
): OrganizerSettingsUpdate | null {
  const destinations = draft.mode === "off" ? [] : draft.allowedDestinationIds;
  if (draft.mode === "suggest" && destinations.some(id => !visibleProjectIds.includes(id))) return null;
  const payload = {
    mode: draft.mode,
    consentGranted: draft.mode === "suggest" && draft.consentGranted,
    providerProcessingConsent: draft.mode === "suggest" && draft.providerProcessingConsent,
    allowedSourceKinds: draft.mode === "suggest" ? ["studio"] : [],
    allowedDestinationIds: destinations,
    minimumConfidence: draft.minimumConfidence,
    requireApproval: true,
    expectedRevision,
  };
  return parseOrganizerSettingsUpdate(payload);
}
