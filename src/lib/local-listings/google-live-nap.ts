import type { CitationRow } from "./citation-audit";

/**
 * The official Business Information v1 API supports an account-owned
 * locations/{id} read with a required readMask. No client-supplied URL/host.
 */
export function googleLiveLocationUrl(resourceName: string): URL | null {
  if (!/^locations\/[A-Za-z0-9_-]+$/.test(resourceName)) return null;
  const url = new URL(
    "https://mybusinessbusinessinformation.googleapis.com/v1/" + resourceName,
  );
  url.searchParams.set(
    "readMask",
    "name,title,websiteUri,phoneNumbers,storefrontAddress",
  );
  return url;
}

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function safeText(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}

/** Provider evidence: one remote location response, never a website crawl. */
export function parseLiveGoogleBusinessNap(
  payload: unknown,
  expectedResourceName: string,
): CitationRow | null {
  if (!googleLiveLocationUrl(expectedResourceName)) return null;
  const item = obj(payload);
  if (!item || safeText(item.name) !== expectedResourceName) return null;
  const name = safeText(item.title);
  if (!name) return null;
  const address = obj(item.storefrontAddress);
  const addressLines = Array.isArray(address?.addressLines)
    ? address.addressLines.filter((line): line is string => typeof line === "string")
      .slice(0, 5).map(safeText).filter(Boolean)
    : [];
  const locationAddress = [
    ...addressLines, safeText(address?.locality), safeText(address?.administrativeArea),
    safeText(address?.postalCode),
  ].filter(Boolean).join(", ").slice(0, 500);
  const phones = obj(item.phoneNumbers);
  return {
    directory: "Google Business Profile (live API)",
    // Business website != verified Google listing URL. Never create a link.
    listingUrl: "",
    name,
    address: locationAddress,
    phone: safeText(phones?.primaryPhone),
    website: safeText(item.websiteUri),
  };
}
