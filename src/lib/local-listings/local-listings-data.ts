// Phase 11 — Local listings data access. DB-first, honest mock fallback.
// This file NEVER calls QMAPS, Google Business, or any provider API.

import { getPrisma } from "@/lib/db/prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";
import type {
  ListingCitationSummary,
  ListingPhotoSummary,
  ListingReviewSummary,
  LocalListingsOverviewData,
  LocalListingSummary,
  LocalVisibilitySnapshotSummary,
  SourceMeta,
} from "./types";

const MOCK_LABEL = "Mock foundation data — database not connected yet.";
const DB_LABEL = "Database — live foundation records (QMAPS and Google Business not connected).";

// ── Mock foundation data (mirrors the seed) ──────────────────
const MOCK_LISTINGS: LocalListingSummary[] = [
  { id: "m_l1", name: "Montreal Restaurant Hub Local Listing Foundation", platformName: "Internal Local Listing Foundation", provider: "internal_demo", category: "Restaurant", brandName: "Montreal Restaurant Hub Demo", city: "Montréal", region: "Québec", country: "Canada", status: "active_internal", napStatus: "consistent_internal", lastCheckedAt: null },
  { id: "m_l2", name: "TAKATAK Business Services Listing Foundation", platformName: "Internal Local Listing Foundation", provider: "internal_demo", category: "Business services", brandName: "TAKATAK Demo Brand", city: "Montréal", region: "Québec", country: "Canada", status: "draft", napStatus: "needs_review", lastCheckedAt: null },
];

const MOCK_CITATIONS: ListingCitationSummary[] = [
  { id: "m_c1", directoryName: "Internal Demo Directory", url: null, status: "found_internal", napStatus: "consistent_internal", source: "internal_demo", listingName: "Montreal Restaurant Hub Local Listing Foundation", lastCheckedAt: null },
  { id: "m_c2", directoryName: "Local Business Directory Foundation", url: null, status: "planned", napStatus: "unknown", source: "internal_demo", listingName: "Montreal Restaurant Hub Local Listing Foundation", lastCheckedAt: null },
  { id: "m_c3", directoryName: "Restaurant Category Directory Foundation", url: null, status: "needs_update", napStatus: "needs_review", source: "internal_demo", listingName: "Montreal Restaurant Hub Local Listing Foundation", lastCheckedAt: null },
  { id: "m_c4", directoryName: "Service Provider Directory Foundation", url: null, status: "planned", napStatus: "unknown", source: "internal_demo", listingName: "TAKATAK Business Services Listing Foundation", lastCheckedAt: null },
];

const MOCK_REVIEWS: ListingReviewSummary[] = [
  { id: "m_rv1", provider: "internal_demo", reviewerName: "Internal Demo Reviewer", rating: 5, title: "Internal demo review — positive", bodyPreview: "[Internal demo review — not imported from Google or QMAPS] Great weekly specials and friendly staff…", status: "internal_demo", replyStatus: "draft_reply", sentiment: "positive", listingName: "Montreal Restaurant Hub Local Listing Foundation", reviewedAt: "2026-07-16" },
  { id: "m_rv2", provider: "internal_demo", reviewerName: "Internal Demo Reviewer 2", rating: 3, title: "Internal demo review — neutral", bodyPreview: "[Internal demo review — not imported from Google or QMAPS] Average wait time on a busy night…", status: "needs_review", replyStatus: "not_replied", sentiment: "neutral", listingName: "Montreal Restaurant Hub Local Listing Foundation", reviewedAt: "2026-07-16" },
];

const MOCK_PHOTOS: ListingPhotoSummary[] = [
  { id: "m_p1", title: "Exterior photo (planned)", imageUrl: null, status: "planned", source: "internal_demo", listingName: "Montreal Restaurant Hub Local Listing Foundation" },
  { id: "m_p2", title: "Menu / brand photo (planned)", imageUrl: null, status: "planned", source: "internal_demo", listingName: "Montreal Restaurant Hub Local Listing Foundation" },
];

const MOCK_SNAPSHOTS: LocalVisibilitySnapshotSummary[] = [
  { id: "m_v1", source: "internal_foundation", score: null, listingsCount: 1, citationsCount: 3, reviewsCount: 2, averageRating: 4.0, notes: "Foundation visibility only — counts from internal foundation records, not from QMAPS or provider data.", listingName: "Montreal Restaurant Hub Local Listing Foundation", capturedAt: "2026-07-16" },
  { id: "m_v2", source: "internal_foundation", score: null, listingsCount: 1, citationsCount: 1, reviewsCount: 0, averageRating: null, notes: "Foundation visibility only — counts from internal foundation records, not from QMAPS or provider data.", listingName: "TAKATAK Business Services Listing Foundation", capturedAt: "2026-07-16" },
];

function preview(text: string | null): string | null {
  if (!text) return null;
  return text.length > 110 ? `${text.slice(0, 107)}…` : text;
}

function logDbError(scope: string, error: unknown) {
  console.error(`[local-listings-data:${scope}] Query failed — using mock foundation data:`, error instanceof Error ? error.message : "unknown error");
}

const day = (d: Date | null | undefined) => d?.toISOString().slice(0, 10) ?? null;

// ── Listings ─────────────────────────────────────────────────
export async function getLocalListingsData(access?: TenantAccess): Promise<SourceMeta & { listings: LocalListingSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, listings: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.localListing.findMany({
        where: clientWhere(scope),
        include: { businessBrand: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        listings: rows.map((l) => ({
          id: l.id, name: l.name, platformName: l.platformName, provider: l.provider,
          category: l.category, brandName: l.businessBrand?.name ?? null,
          city: l.city, region: l.region, country: l.country,
          status: l.status, napStatus: l.napStatus, lastCheckedAt: day(l.lastCheckedAt),
        })),
      };
    } catch (error) {
      logDbError("listings", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", listings: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, listings: MOCK_LISTINGS };
}

// ── Citations ────────────────────────────────────────────────
export async function getListingCitationsData(access?: TenantAccess): Promise<SourceMeta & { citations: ListingCitationSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, citations: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.listingCitation.findMany({
        where: clientWhere(scope),
        include: { localListing: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        citations: rows.map((c) => ({
          id: c.id, directoryName: c.directoryName, url: c.url,
          status: c.status, napStatus: c.napStatus, source: c.source,
          listingName: c.localListing?.name ?? null, lastCheckedAt: day(c.lastCheckedAt),
        })),
      };
    } catch (error) {
      logDbError("citations", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", citations: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, citations: MOCK_CITATIONS };
}

// ── Reviews ──────────────────────────────────────────────────
export async function getListingReviewsData(access?: TenantAccess): Promise<SourceMeta & { reviews: ListingReviewSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, reviews: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.listingReview.findMany({
        where: clientWhere(scope),
        include: { localListing: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        reviews: rows.map((r) => ({
          id: r.id, provider: r.provider, reviewerName: r.reviewerName, rating: r.rating,
          title: r.title, bodyPreview: preview(r.body),
          status: r.status, replyStatus: r.replyStatus, sentiment: r.sentiment,
          listingName: r.localListing?.name ?? null, reviewedAt: day(r.reviewedAt),
        })),
      };
    } catch (error) {
      logDbError("reviews", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", reviews: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, reviews: MOCK_REVIEWS };
}

// ── Photos ───────────────────────────────────────────────────
export async function getListingPhotosData(access?: TenantAccess): Promise<SourceMeta & { photos: ListingPhotoSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, photos: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.listingPhoto.findMany({
        where: clientWhere(scope),
        include: { localListing: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        photos: rows.map((p) => ({
          id: p.id, title: p.title, imageUrl: p.imageUrl,
          status: p.status, source: p.source,
          listingName: p.localListing?.name ?? null,
        })),
      };
    } catch (error) {
      logDbError("photos", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", photos: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, photos: MOCK_PHOTOS };
}

// ── Visibility snapshots ─────────────────────────────────────
export async function getLocalVisibilityData(access?: TenantAccess): Promise<SourceMeta & { snapshots: LocalVisibilitySnapshotSummary[] }> {
  const scope = await resolveDataScope(access);
  if (scope.kind === "unavailable") {
    return { source: "unavailable", sourceLabel: scope.label, snapshots: [] };
  }
  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (prisma && scope.kind === "db") {
    try {
      const rows = await prisma.localVisibilitySnapshot.findMany({
        where: clientWhere(scope),
        include: { localListing: { select: { name: true } } },
        orderBy: { capturedAt: "desc" },
      });
      return {
        source: "database", sourceLabel: DB_LABEL,
        snapshots: rows.map((v) => ({
          id: v.id, source: v.source, score: v.score,
          listingsCount: v.listingsCount, citationsCount: v.citationsCount,
          reviewsCount: v.reviewsCount, averageRating: v.averageRating,
          notes: v.notes, listingName: v.localListing?.name ?? null,
          capturedAt: v.capturedAt.toISOString().slice(0, 10),
        })),
      };
    } catch (error) {
      logDbError("visibility", error);
      if (!scope.allowMockFallback) {
        return { source: "unavailable", sourceLabel: "Data is temporarily unavailable.", snapshots: [] };
      }
    }
  }
  return { source: "mock", sourceLabel: MOCK_LABEL, snapshots: MOCK_SNAPSHOTS };
}

// ── Overview ─────────────────────────────────────────────────
export async function getLocalListingsOverviewData(access?: TenantAccess): Promise<LocalListingsOverviewData> {
  const [listings, citations, reviews, photos, snapshots] = await Promise.all([
    getLocalListingsData(access),
    getListingCitationsData(access),
    getListingReviewsData(access),
    getListingPhotosData(access),
    getLocalVisibilityData(access),
  ]);
  return {
    source: listings.source,
    sourceLabel: listings.sourceLabel,
    kpis: {
      listings: listings.listings.length,
      citations: citations.citations.length,
      reviews: reviews.reviews.length,
      photos: photos.photos.length,
      snapshots: snapshots.snapshots.length,
    },
    listings: listings.listings,
    citationHealth: {
      total: citations.citations.length,
      foundInternal: citations.citations.filter((c) => c.status === "found_internal").length,
      needsUpdate: citations.citations.filter((c) => c.status === "needs_update").length,
      missing: citations.citations.filter((c) => c.status === "missing").length,
    },
    reviews: reviews.reviews,
    snapshots: snapshots.snapshots,
  };
}
