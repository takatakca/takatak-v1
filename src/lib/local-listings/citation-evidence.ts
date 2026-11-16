import type { BusinessNap, CitationReferenceProfile, CitationRow } from "./citation-audit";

export type CitationEvidenceSource = "stored_citation" | "google_business_snapshot";

export type SavedCitationEvidence = {
  id: string;
  source: CitationEvidenceSource;
  sourceLabel: string;
  observedAt: string | null;
  businessBrandId: string | null;
  localListingId: string | null;
  socialAccountId: string | null;
  row: CitationRow;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

export function safeCitationLink(value: unknown): string {
  const text = safeString(value);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return "";
    return url.toString();
  } catch {
    return "";
  }
}

/**
 * NAP fields are observations only when explicitly present in evidence
 * metadata. A linked TAKATAK listing is a reference, never an observation
 * about an outside directory.
 */
export function readObservedCitationNap(metadata: unknown): BusinessNap {
  const m = record(metadata);
  const observed = record(m?.observedNap) ?? record(m?.observedNAP) ?? record(m?.observed_nap);
  return {
    name: safeString(observed?.name),
    address: safeString(observed?.address),
    phone: safeString(observed?.phone),
    website: safeString(observed?.website),
  };
}

export function readGoogleSnapshotAddress(metadata: unknown): string {
  const m = record(metadata);
  if (!m) return "";
  const lines = Array.isArray(m.addressLines)
    ? m.addressLines.filter((v): v is string => typeof v === "string" && Boolean(v.trim())).slice(0, 4)
    : [];
  return [...lines, safeString(m.locality), safeString(m.administrativeArea), safeString(m.postalCode)]
    .filter(Boolean).join(", ").slice(0, 500);
}

export function readGoogleSnapshotPhone(metadata: unknown): string {
  return safeString(record(metadata)?.primaryPhone);
}

/**
 * Match exact location/account only. An unbound brand-wide citation cannot
 * prove which of several locations it describes; never infer ownership.
 */
export function citationEvidenceMatchesProfile(profile: CitationReferenceProfile, evidence: SavedCitationEvidence): boolean {
  if (evidence.socialAccountId) return evidence.socialAccountId === profile.socialAccountId;
  if (evidence.localListingId) return evidence.localListingId === profile.localListingId;
  // Brand-only records cannot be safely tied to a particular location.
  // Multi-location brands must bind evidence to an exact listing/account.
  return false;
}

export function rowsForSavedEvidence(profile: CitationReferenceProfile | undefined, evidence: SavedCitationEvidence[]): CitationRow[] {
  if (!profile) return [];
  return evidence.filter(item => citationEvidenceMatchesProfile(profile, item)).map(item => item.row);
}
