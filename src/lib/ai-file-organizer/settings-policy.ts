import type { OrganizerMode } from "./approval-policy";

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export type OrganizerSettings = {
  mode: OrganizerMode;
  consentGranted: boolean;
  providerProcessingConsent: boolean;
  allowedSourceKinds: string[];
  allowedDestinationIds: string[];
  minimumConfidence: number;
  requireApproval: boolean;
  revision: number;
};
export type OrganizerSettingsUpdate = Omit<OrganizerSettings, "revision"> & { expectedRevision: number };
export function defaultOrganizerSettings(): OrganizerSettings {
  return { mode: "off", consentGranted: false, providerProcessingConsent: false,
    allowedSourceKinds: [], allowedDestinationIds: [], minimumConfidence: 0.9,
    requireApproval: true, revision: 0 };
}
function uniqueStudioDestinations(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 20 &&
    value.every(x => typeof x === "string" && UUID.test(x)) &&
    new Set(value.map(x => x.toLowerCase())).size === value.length;
}
/** A caller cannot claim consent, entitlement, tenancy or a new destination using extra keys. */
export function parseOrganizerSettingsUpdate(body: unknown): OrganizerSettingsUpdate | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const data = body as Record<string, unknown>;
  const keys = ["mode", "consentGranted", "providerProcessingConsent", "allowedSourceKinds",
    "allowedDestinationIds", "minimumConfidence", "requireApproval", "expectedRevision"];
  if (Object.keys(data).some(key => !keys.includes(key)) ||
    !Number.isInteger(data.expectedRevision) || (data.expectedRevision as number) < 0 ||
    (data.expectedRevision as number) > 1000000000) return null;
  if (data.mode !== "off" && data.mode !== "suggest") return null;
  if (typeof data.consentGranted !== "boolean" || typeof data.providerProcessingConsent !== "boolean" ||
    data.requireApproval !== true ||
    typeof data.minimumConfidence !== "number" || !Number.isFinite(data.minimumConfidence) ||
    data.minimumConfidence < 0.8 || data.minimumConfidence > 1) return null;
  if (data.mode === "off") {
    if (data.consentGranted || data.providerProcessingConsent ||
      !Array.isArray(data.allowedSourceKinds) || data.allowedSourceKinds.length ||
      !Array.isArray(data.allowedDestinationIds) || data.allowedDestinationIds.length) return null;
    return { mode: "off", consentGranted: false, providerProcessingConsent: false,
      allowedSourceKinds: [], allowedDestinationIds: [], minimumConfidence: data.minimumConfidence,
      requireApproval: true, expectedRevision: data.expectedRevision as number };
  }
  if (!data.consentGranted || data.providerProcessingConsent !== false ||
    !Array.isArray(data.allowedSourceKinds) || data.allowedSourceKinds.length !== 1 ||
    data.allowedSourceKinds[0] !== "studio" || !uniqueStudioDestinations(data.allowedDestinationIds)) return null;
  return { mode: "suggest", consentGranted: true, providerProcessingConsent: false,
    requireApproval: true, allowedSourceKinds: ["studio"],
    allowedDestinationIds: [...data.allowedDestinationIds], minimumConfidence: data.minimumConfidence,
    expectedRevision: data.expectedRevision as number };
}
export function organizerSettingsFromRow(row: {
  mode: string; consentGranted: boolean; providerProcessingConsent: boolean;
  allowedSourceKinds: unknown; allowedDestinationIds: unknown; minimumConfidence: number;
  requireApproval: boolean; revision: number;
} | null): OrganizerSettings {
  if (!row) return defaultOrganizerSettings();
  const validDestinations = Array.isArray(row.allowedDestinationIds) &&
    row.allowedDestinationIds.length > 0 && row.allowedDestinationIds.length <= 20 &&
    row.allowedDestinationIds.every(x => typeof x === "string" && UUID.test(x)) &&
    new Set(row.allowedDestinationIds.map(x => String(x).toLowerCase())).size === row.allowedDestinationIds.length;
  if (row.mode !== "suggest" || !row.consentGranted || row.providerProcessingConsent !== false ||
    row.requireApproval !== true || !Array.isArray(row.allowedSourceKinds) ||
    row.allowedSourceKinds.length !== 1 || row.allowedSourceKinds[0] !== "studio" ||
    !validDestinations ||
    !Number.isFinite(row.minimumConfidence) || row.minimumConfidence < 0.8 || row.minimumConfidence > 1 ||
    !Number.isInteger(row.revision) || row.revision < 1) {
    return { ...defaultOrganizerSettings(), revision: Number.isInteger(row.revision) && row.revision > 0 ? row.revision : 0 };
  }
  return { mode: "suggest", consentGranted: true, providerProcessingConsent: false,
    allowedSourceKinds: ["studio"], allowedDestinationIds: [...(row.allowedDestinationIds as string[])],
    minimumConfidence: row.minimumConfidence, requireApproval: true, revision: row.revision };
}
