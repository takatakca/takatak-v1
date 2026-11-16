import type { CitationReferenceProfile } from "./citation-audit";

export type CitationProfileChoice = {
  id: string;
  label: string;
  sharesName: boolean;
};

/**
 * An equal-looking business name is NOT evidence of duplicate database rows.
 * Preserve every existing location/account identity and show its origin.
 * Profiles are already filtered to the authenticated workspace on the server.
 */
function comparableName(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en").replace(/[\s\p{P}\p{S}]+/gu, " ").trim();
}

export function buildCitationProfileChoices(
  profiles: CitationReferenceProfile[],
): CitationProfileChoice[] {
  const occurrences = new Map<string, number>();
  for (const profile of profiles) {
    const name = comparableName(profile.nap.name);
    if (name) occurrences.set(name, (occurrences.get(name) ?? 0) + 1);
  }

  return profiles.map(profile => {
    const name = comparableName(profile.nap.name);
    const sharesName = Boolean(name && (occurrences.get(name) ?? 0) > 1);
    if (!sharesName) {
      return { id: profile.id, label: profile.label, sharesName: false };
    }

    const source = profile.source === "google_business_connection"
      ? "Google snapshot" : "TAKATAK listing";
    const location = profile.nap.address.trim().slice(0, 80) || "address not stored";
    const key = profile.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6) || "unknown";

    return {
      id: profile.id,
      label: (profile.nap.name || "Business") + " — " + source + " — " + location + " — ref " + key,
      sharesName: true,
    };
  });
}
