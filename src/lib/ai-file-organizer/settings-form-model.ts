import {
  parseOrganizerSettingsUpdate,
  type OrganizerSettings,
  type OrganizerSettingsUpdate,
} from "./settings-policy";

export type OrganizerSettingsDraft = {
  mode: "off" | "suggest";
  consentGranted: boolean;
  providerProcessingConsent: boolean;
  destinationIds: string[];
  minimumConfidence: number;
};

/** Browser controls may propose a policy; the server must still authorize destinations. */
export function makeOrganizerSettingsUpdate(
  draft: OrganizerSettingsDraft,
  expectedRevision: number,
): OrganizerSettingsUpdate | null {
  const off = draft.mode === "off";
  const parsed = parseOrganizerSettingsUpdate({
    mode: draft.mode,
    consentGranted: off ? false : draft.consentGranted,
    providerProcessingConsent: off ? false : draft.providerProcessingConsent,
    allowedSourceKinds: off ? [] : ["studio"],
    allowedDestinationIds: off ? [] : draft.destinationIds,
    minimumConfidence: draft.minimumConfidence,
    requireApproval: true,
    expectedRevision,
  });
  return parsed;
}

export function organizerDraftFromSettings(settings: OrganizerSettings): OrganizerSettingsDraft {
  return {
    mode: settings.mode === "suggest" ? "suggest" : "off",
    consentGranted: settings.consentGranted,
    providerProcessingConsent: settings.providerProcessingConsent,
    destinationIds: [...settings.allowedDestinationIds],
    minimumConfidence: settings.minimumConfidence,
  };
}
