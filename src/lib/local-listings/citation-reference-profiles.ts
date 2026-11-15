import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import type { CitationReferenceProfile } from "./citation-audit";
import { readGoogleSnapshotAddress, readGoogleSnapshotPhone } from "./citation-evidence";

function stringValue(value: unknown): string {

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
          id: true, businessBrandId: true, name: true, addressLine1: true, city: true, region: true,
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
          id: true, businessBrandId: true, displayName: true, profileUrl: true, metadata: true, lastDiscoveredAt: true,
        },
        orderBy: { lastDiscoveredAt: "desc" },
        take: 30,
      }),
    ]);
    const local: CitationReferenceProfile[] = listings.map(item => ({
      id: "local:" + item.id,
      label: (item.name || "Local business") + " — saved TAKATAK listing",
      source: "local_listing",
      businessBrandId: item.businessBrandId,
      localListingId: item.id,
      socialAccountId: null,
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
      businessBrandId: item.businessBrandId,
      localListingId: null,
      socialAccountId: item.id,
      observedAt: item.lastDiscoveredAt?.toISOString() ?? null,
      nap: {
        name: item.displayName ?? "",
        address: readGoogleSnapshotAddress(item.metadata),
        // Only present after a new authorized GBP location discovery; older snapshots may lack it.
        phone: readGoogleSnapshotPhone(item.metadata),
        website: item.profileUrl ?? "",
      },
    }));
    return [...google, ...local];
  } catch (error) {
    console.error("[local-citation] Failed to read selected workspace references", error instanceof Error ? error.message : "unknown");
    return [];
  }
}
