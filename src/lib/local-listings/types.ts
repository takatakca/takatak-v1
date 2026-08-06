// Phase 11 — Local listings view types (serializable, UI-facing).
export type LocalListingsDataSource = "database" | "mock" | "unavailable";

export interface SourceMeta {
  source: LocalListingsDataSource;
  sourceLabel: string;
}

export interface LocalListingSummary {
  id: string;
  name: string;
  platformName: string;
  provider: string;
  category: string | null;
  brandName: string | null;
  city: string | null;
  region: string | null;
  country: string;
  status: string;
  napStatus: string;
  lastCheckedAt: string | null;
}

export interface ListingCitationSummary {
  id: string;
  directoryName: string;
  url: string | null;
  status: string;
  napStatus: string;
  source: string;
  listingName: string | null;
  lastCheckedAt: string | null;
}

export interface ListingReviewSummary {
  id: string;
  provider: string;
  reviewerName: string | null;
  rating: number | null;
  title: string | null;
  bodyPreview: string | null;
  status: string;
  replyStatus: string;
  sentiment: string;
  listingName: string | null;
  reviewedAt: string | null;
}

export interface ListingPhotoSummary {
  id: string;
  title: string | null;
  imageUrl: string | null;
  status: string;
  source: string;
  listingName: string | null;
}

export interface LocalVisibilitySnapshotSummary {
  id: string;
  source: string;
  score: number | null;
  listingsCount: number;
  citationsCount: number;
  reviewsCount: number;
  averageRating: number | null;
  notes: string | null;
  listingName: string | null;
  capturedAt: string;
}

export interface LocalListingsKpis {
  listings: number;
  citations: number;
  reviews: number;
  photos: number;
  snapshots: number;
}

export interface CitationHealth {
  total: number;
  foundInternal: number;
  needsUpdate: number;
  missing: number;
}

export interface LocalListingsOverviewData extends SourceMeta {
  kpis: LocalListingsKpis;
  listings: LocalListingSummary[];
  citationHealth: CitationHealth;
  reviews: ListingReviewSummary[];
  snapshots: LocalVisibilitySnapshotSummary[];
}
