import "server-only";

import { getPrisma } from "@/lib/db/prisma";
import { getServerAccessContext } from "@/lib/security/access-context";
import {
  readGoogleSnapshotAddress, readGoogleSnapshotPhone,
  readObservedCitationNap, safeCitationLink, type SavedCitationEvidence,
} from "./citation-evidence";

/**
 * Evidence loaded from the currently authenticated, selected workspace only.
 * Records are previously saved observations; no network directory scan is
 * performed. No demo data, other tenants, or planned citations are included.
 */
export async function getSavedCitationEvidence(): Promise<SavedCitationEvidence[]> {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped") return [];

  const db = getPrisma();
  if (!db) return [];
  const clientId = access.activeClientId;

  try {
    const [citations, googleAccounts] = await Promise.all([
      db.listingCitation.findMany({
        where: {
          clientId,
          source: { in: ["manual", "qmaps", "provider_api"] },
          status: { in: ["found_internal", "needs_update"] },
        },
        select: {
          id: true, businessBrandId: true, localListingId: true,
          directoryName: true, url: true, source: true,
          metadata: true, lastCheckedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 120,
      }),
      db.socialAccount.findMany({
        where: {
          clientId,
          platform: "google_business",
          status: "connected",
          accessStatus: "selected",
          isAvailableThroughAuth: true,
          providerConnection: { provider: "google_business", status: "connected" },
        },
        select: {
          id: true, businessBrandId: true, displayName: true,
          profileUrl: true, metadata: true, lastDiscoveredAt: true,
        },
        orderBy: { lastDiscoveredAt: "desc" },
        take: 50,
      }),
    ]);

    const saved: SavedCitationEvidence[] = citations.map(row => ({
      id: "citation:" + row.id,
      source: "stored_citation",
      sourceLabel: row.source === "manual" ? "Saved manual citation"
        : row.source === "qmaps" ? "Saved QMAPS citation" : "Saved API citation",
      observedAt: row.lastCheckedAt?.toISOString() ?? null,
      businessBrandId: row.businessBrandId,
      localListingId: row.localListingId,
      socialAccountId: null,
      row: {
        directory: row.directoryName,
        listingUrl: safeCitationLink(row.url),
        ...readObservedCitationNap(row.metadata),
      },
    }));

    const google: SavedCitationEvidence[] = googleAccounts.map(row => ({
      id: "google:" + row.id,
      source: "google_business_snapshot",
      sourceLabel: "Connected Google Business Profile snapshot",
      observedAt: row.lastDiscoveredAt?.toISOString() ?? null,
      businessBrandId: row.businessBrandId,
      localListingId: null,
      socialAccountId: row.id,
      row: {
        directory: "Google Business Profile (saved)",
        // The social connection's profileUrl is a BUSINESS website URI,
        // not a Google listing URL. Do not present it as external evidence.
        listingUrl: "",
        name: row.displayName ?? "",
        address: readGoogleSnapshotAddress(row.metadata),
        phone: readGoogleSnapshotPhone(row.metadata),
        website: row.profileUrl ?? "",
      },
    }));

    return [...google, ...saved];
  } catch (error) {
    console.error(
      "[local-citation] Cannot load tenant-scoped citation evidence",
      error instanceof Error ? error.message : "unknown",
    );
    return [];
  }
}
