import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import type { CitationReferenceProfile } from "./citation-audit";

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function googleAddress(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const meta = value as Record<string, unknown>;
  const lines = Array.isArray(meta.addressLines)
    ? meta.addressLines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    : [];
  return [...lines, stringValue(meta.locality), stringValue(meta.administrativeArea),
    stringValue(meta.postalCode)].filter(Boolean).join(", ");
}

/**
 * Only reads a currently selected, active client workspace. Never uses a user-
 * submitted client ID, never falls back to mock, and never calls Google or any
 * other external publisher. All records are stored/imported snapshots.
 */
export async function getCitationReferenceProfiles(): Promise<CitationReferenceProfile[]> {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped") return [];
  const db = getPrisma();
  if (!db) return [];
  const clientId = access.activeClientId;

  try {
    const [listings, googleAccounts] = await Promise.all([
      db.localListing.findMany({
        where: { clientId, provider: { not: "internal_demo" } },
        select: {
          id: true, name: true, addressLine1: true, city: true, region: true,
          postalCode: true, phone: true, website: true, updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 30,
      }),
      db.socialAccount.findMany({
        where: {
          clientId, platform: "google_business", status: "connected",
          accessStatus: "selected", isAvailableThroughAuth: true,
          providerConnection: { provider: "google_business", status: "connected" },
        },
        select: {
          id: true, displayName: true, profileUrl: true, metadata: true, lastDiscoveredAt: true,
        },
        orderBy: { lastDiscoveredAt: "desc" },
        take: 30,
      }),
    ]);
    const local: CitationReferenceProfile[] = listings.map(item => ({
      id: "local:" + item.id,
      label: (item.name || "Local business") + " — saved TAKATAK listing",
      source: "local_listing",
      observedAt: item.updatedAt.toISOString(),
      nap: {
        name: item.name,
        address: [item.addressLine1, item.city, item.region, item.postalCode].filter(Boolean).join(", "),
        phone: item.phone ?? "",
        website: item.website ?? "",
      },
    }));
    const google: CitationReferenceProfile[] = googleAccounts.map(item => ({
      id: "google:" + item.id,
      label: (item.displayName || "Google Business Profile") + " — connected Google snapshot",
      source: "google_business_connection",
      observedAt: item.lastDiscoveredAt?.toISOString() ?? null,
      nap: {
        name: item.displayName ?? "",
        address: googleAddress(item.metadata),
        // Social discovery does not currently store GBP phone numbers; never invent one.
        phone: "",
        website: item.profileUrl ?? "",
      },
    }));
    return [...google, ...local];
  } catch (error) {
    console.error("[local-citation] Failed to read selected workspace references", error instanceof Error ? error.message : "unknown");
    return [];
  }
}
