import { getPrisma } from "@/lib/db/prisma";
import { clientWhere, resolveDataScope } from "@/lib/security/data-scope";
import type { TenantAccess } from "@/lib/security/tenant-access";
import { getServerAccessContext } from "@/lib/security/access-context";

export type DashboardHomeSource = "database" | "mock" | "unavailable";

export type HonestConnectionStatus = "connected" | "not_connected" | "error" | "expired";

export interface DashboardHomeRange {
  from: string;
  to: string;
}

export interface DashboardKpiMetric {
  label: string;
  value: number | null;
  previous: number | null;
  series: number[];
  hint: string;
  available: boolean;
}

export interface DashboardIntegrationRow {
  key: "website" | "social" | "advertising" | "reviews";
  label: string;
  href: string;
  detail: string;
  platforms: string[];
  status: HonestConnectionStatus;
}

export interface PerformanceSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface TopPageRow {
  path: string;
  sessions: number;
  changePct: number | null;
}

export interface TopSocialPostRow {
  id: string;
  platform: string;
  caption: string;
  engagement: number | null;
  live: boolean;
}

export interface RecentReviewRow {
  id: string;
  reviewerName: string;
  rating: number | null;
  body: string;
  provider: string;
  reviewedAt: string | null;
}

export interface DashboardHomeData {
  source: DashboardHomeSource;
  sourceLabel: string;
  range: DashboardHomeRange;
  welcomeName: string;
  kpis: {
    reach: DashboardKpiMetric;
    engagement: DashboardKpiMetric;
    websiteTraffic: DashboardKpiMetric;
    conversions: DashboardKpiMetric;
    avgRating: DashboardKpiMetric & { reviewCount: number };
  };
  integrations: DashboardIntegrationRow[];
  performance: PerformanceSlice[];
  topPages: TopPageRow[];
  topPosts: TopSocialPostRow[];
  reviews: RecentReviewRow[];
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDay(value: string | undefined, fallback: Date): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function resolveDashboardRange(fromParam?: string, toParam?: string): DashboardHomeRange {
  const to = parseDay(toParam, new Date());
  const defaultFrom = new Date(to);
  defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 30);
  const from = parseDay(fromParam, defaultFrom);
  return {
    from: isoDate(from <= to ? from : defaultFrom),
    to: isoDate(to),
  };
}

function previousRange(range: DashboardHomeRange): DashboardHomeRange {
  const from = new Date(`${range.from}T00:00:00.000Z`);
  const to = new Date(`${range.to}T00:00:00.000Z`);
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
  const prevTo = new Date(from);
  prevTo.setUTCDate(prevTo.getUTCDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setUTCDate(prevFrom.getUTCDate() - (days - 1));
  return { from: isoDate(prevFrom), to: isoDate(prevTo) };
}

function dateWhere(range: DashboardHomeRange) {
  return {
    gte: new Date(`${range.from}T00:00:00.000Z`),
    lte: new Date(`${range.to}T23:59:59.999Z`),
  };
}

function emptyKpi(label: string, hint: string): DashboardKpiMetric {
  return { label, value: null, previous: null, series: [], hint, available: false };
}

function viewerName(options: {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  clientName: string | null;
}): string {
  const composed = [options.firstName, options.lastName].filter(Boolean).join(" ");
  return options.displayName || composed || options.clientName || options.email || "there";
}

const EMPTY: Omit<DashboardHomeData, "source" | "sourceLabel" | "range" | "welcomeName"> = {
  kpis: {
    reach: emptyKpi("Total Reach", "Social reach is unavailable until analytics sync."),
    engagement: emptyKpi("Engagement", "Engagement is unavailable until analytics sync."),
    websiteTraffic: emptyKpi("Website Traffic", "Website analytics is not connected."),
    conversions: emptyKpi("Conversions", "No conversion records in this range."),
    avgRating: {
      ...emptyKpi("Avg. Rating", "No reviews yet."),
      reviewCount: 0,
    },
  },
  integrations: [
    {
      key: "website",
      label: "Website",
      href: "/dashboard/web-hosting",
      detail: "No website connected",
      platforms: [],
      status: "not_connected",
    },
    {
      key: "social",
      label: "Social Media",
      href: "/dashboard/social",
      detail: "No accounts connected",
      platforms: [],
      status: "not_connected",
    },
    {
      key: "advertising",
      label: "Advertising",
      href: "/dashboard/advertising",
      detail: "No ad accounts connected",
      platforms: [],
      status: "not_connected",
    },
    {
      key: "reviews",
      label: "Reviews",
      href: "/dashboard/local-listings/reviews",
      detail: "No review sources connected",
      platforms: [],
      status: "not_connected",
    },
  ],
  performance: [
    { key: "website", label: "Website", value: 0, color: "#3b82f6" },
    { key: "social", label: "Social Media", value: 0, color: "#22c55e" },
    { key: "advertising", label: "Advertising", value: 0, color: "#8b5cf6" },
    { key: "reviews", label: "Reviews", value: 0, color: "#f97316" },
  ],
  topPages: [],
  topPosts: [],
  reviews: [],
};

function connectionStatus(statuses: string[]): HonestConnectionStatus {
  if (statuses.includes("connected")) return "connected";
  if (statuses.includes("error")) return "error";
  if (statuses.includes("expired")) return "expired";
  return "not_connected";
}

function preview(text: string | null | undefined, max = 88): string {
  if (!text) return "Untitled post";
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

export async function getDashboardHomeData(options: {
  from?: string;
  to?: string;
  access?: TenantAccess;
}): Promise<DashboardHomeData> {
  const range = resolveDashboardRange(options.from, options.to);
  const prev = previousRange(range);
  const [{ displayEmail, profileDetails, activeClientName }, scope] =
    await Promise.all([
      options.access
        ? Promise.resolve({
            displayEmail: null as string | null,
            profileDetails: null,
            activeClientName: null as string | null,
          })
        : getServerAccessContext(),
      resolveDataScope(options.access),
    ]);

  const welcomeName = viewerName({
    displayName: profileDetails?.displayName ?? null,
    firstName: profileDetails?.firstName ?? null,
    lastName: profileDetails?.lastName ?? null,
    email: profileDetails?.email ?? displayEmail,
    clientName: activeClientName,
  });

  if (scope.kind === "unavailable") {
    return {
      source: "unavailable",
      sourceLabel: scope.label,
      range,
      welcomeName,
      ...EMPTY,
    };
  }

  const prisma = scope.kind === "db" ? getPrisma() : null;
  if (!prisma || scope.kind !== "db") {
    return {
      source: "mock",
      sourceLabel: "Mock foundation data — database not connected yet.",
      range,
      welcomeName,
      ...EMPTY,
    };
  }

  try {
    const where = clientWhere(scope);
    const [
      currentSocial,
      previousSocial,
      dailySocial,
      domains,
      socialAccounts,
      adAccounts,
      adCurrent,
      adClicksPrevious,
      wonLeadsCurrent,
      wonLeadsPrevious,
      reviewsAgg,
      reviews,
      listings,
      contentItems,
      socialPosts,
    ] = await Promise.all([
      prisma.socialAnalyticsDaily.aggregate({
        where: { ...where, date: dateWhere(range) },
        _sum: { reach: true, engagement: true },
      }),
      prisma.socialAnalyticsDaily.aggregate({
        where: { ...where, date: dateWhere(prev) },
        _sum: { reach: true, engagement: true },
      }),
      prisma.socialAnalyticsDaily.findMany({
        where: { ...where, date: dateWhere(range) },
        orderBy: { date: "asc" },
        select: { date: true, reach: true, engagement: true },
      }),
      prisma.domainAsset.findMany({
        where,
        orderBy: { createdAt: "asc" },
        take: 3,
        select: { domainName: true, status: true },
      }),
      prisma.socialAccount.findMany({
        where,
        select: { platform: true, status: true },
      }),
      prisma.socialAdAccount.findMany({
        where,
        select: { platform: true, status: true, displayName: true },
      }),
      prisma.socialAdAnalyticsDaily.aggregate({
        where: { ...where, date: dateWhere(range) },
        _sum: { clicks: true, impressions: true },
      }),
      prisma.socialAdAnalyticsDaily.aggregate({
        where: { ...where, date: dateWhere(prev) },
        _sum: { clicks: true },
      }),
      prisma.lead.count({
        where: { ...where, status: "won_internal", createdAt: dateWhere(range) },
      }),
      prisma.lead.count({
        where: { ...where, status: "won_internal", createdAt: dateWhere(prev) },
      }),
      prisma.listingReview.aggregate({
        where: { ...where, rating: { not: null } },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      prisma.listingReview.findMany({
        where,
        orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }],
        take: 4,
        select: {
          id: true,
          reviewerName: true,
          rating: true,
          body: true,
          title: true,
          provider: true,
          reviewedAt: true,
        },
      }),
      prisma.localListing.findMany({
        where,
        select: { provider: true, status: true, platformName: true },
      }),
      prisma.socialContentItem.findMany({
        where: {
          ...where,
          availability: "available",
          publishedAt: dateWhere(range),
        },
        orderBy: { engagement: "desc" },
        take: 5,
        select: {
          id: true,
          captionExcerpt: true,
          engagement: true,
          socialAccount: { select: { platform: true } },
        },
      }),
      prisma.socialPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, platform: true, caption: true, status: true },
      }),
    ]);

    const reachSeries = dailySocial.map((row) => row.reach);
    const engagementSeries = dailySocial.map((row) => row.engagement);
    const hasSocialAnalytics = dailySocial.length > 0;
    const reachValue = currentSocial._sum.reach ?? 0;
    const engagementValue = currentSocial._sum.engagement ?? 0;
    const adClicks = adCurrent._sum.clicks ?? 0;
    const conversionsAvailable = adClicks > 0 || wonLeadsCurrent > 0;
    const conversionValue = adClicks > 0 ? adClicks : wonLeadsCurrent;
    const conversionPrevious = adClicks > 0 ? (adClicksPrevious._sum.clicks ?? 0) : wonLeadsPrevious;
    const reviewCount = reviewsAgg._count._all;
    const avgRating = reviewsAgg._avg.rating;

    const connectedSocial = socialAccounts.filter((account) => account.status === "connected");
    const connectedAds = adAccounts.filter((account) => account.status === "connected");
    const liveReviewSources = listings.filter(
      (listing) => listing.provider === "google_business" || listing.provider === "qmaps",
    );

    const websiteStatus = connectionStatus(
      domains.map((domain) => (domain.status === "tracked" ? "connected" : "not_connected")),
    );
    // Domain "tracked" is internal tracking, not a live website analytics connection.
    // Only surface Connected when a domain is tracked AND we later have analytics.
    // Until website analytics exists, keep this as not_connected even if a domain is listed.
    const websiteConnected = false;

    const integrations: DashboardIntegrationRow[] = [
      {
        key: "website",
        label: "Website",
        href: "/dashboard/web-hosting",
        detail: domains[0]?.domainName ? `https://${domains[0].domainName}` : "No website connected",
        platforms: [],
        status: websiteConnected ? "connected" : websiteStatus === "error" ? "error" : "not_connected",
      },
      {
        key: "social",
        label: "Social Media",
        href: "/dashboard/social",
        detail:
          connectedSocial.length > 0
            ? `${connectedSocial.length} account${connectedSocial.length === 1 ? "" : "s"} linked`
            : "No accounts connected",
        platforms: [...new Set(connectedSocial.map((account) => account.platform))],
        status: connectionStatus(socialAccounts.map((account) => account.status)),
      },
      {
        key: "advertising",
        label: "Advertising",
        href: "/dashboard/advertising",
        detail:
          connectedAds.length > 0
            ? connectedAds.map((account) => account.displayName ?? account.platform).join(", ")
            : "No ad accounts connected",
        platforms: [...new Set(connectedAds.map((account) => account.platform))],
        status: connectionStatus(adAccounts.map((account) => account.status)),
      },
      {
        key: "reviews",
        label: "Reviews",
        href: "/dashboard/local-listings/reviews",
        detail:
          liveReviewSources.length > 0
            ? [...new Set(liveReviewSources.map((listing) => listing.platformName))].join(", ")
            : "No review sources connected",
        platforms: [...new Set(liveReviewSources.map((listing) => listing.provider))],
        status: liveReviewSources.length > 0 ? "connected" : "not_connected",
      },
    ];

    const topPosts: TopSocialPostRow[] =
      contentItems.length > 0
        ? contentItems.map((item) => ({
            id: item.id,
            platform: item.socialAccount.platform,
            caption: preview(item.captionExcerpt),
            engagement: item.engagement,
            live: true,
          }))
        : socialPosts.map((post) => ({
            id: post.id,
            platform: post.platform,
            caption: preview(post.caption),
            engagement: null,
            live: false,
          }));

    return {
      source: "database",
      sourceLabel: "Live workspace records for the selected date range.",
      range,
      welcomeName,
      kpis: {
        reach: {
          label: "Total Reach",
          value: hasSocialAnalytics ? reachValue : null,
          previous: hasSocialAnalytics ? (previousSocial._sum.reach ?? 0) : null,
          series: reachSeries,
          hint: hasSocialAnalytics
            ? "Social reach from synced analytics."
            : "Social reach appears after analytics sync.",
          available: hasSocialAnalytics,
        },
        engagement: {
          label: "Engagement",
          value: hasSocialAnalytics ? engagementValue : null,
          previous: hasSocialAnalytics ? (previousSocial._sum.engagement ?? 0) : null,
          series: engagementSeries,
          hint: hasSocialAnalytics
            ? "Reactions, comments, and shares from synced posts."
            : "Engagement appears after analytics sync.",
          available: hasSocialAnalytics,
        },
        websiteTraffic: {
          label: "Website Traffic",
          value: null,
          previous: null,
          series: [],
          hint: "Website analytics is not connected.",
          available: false,
        },
        conversions: {
          label: "Conversions",
          value: conversionsAvailable ? conversionValue : null,
          previous: conversionsAvailable ? conversionPrevious : null,
          series: [],
          hint: adClicks > 0
            ? "Ad clicks in this range."
            : wonLeadsCurrent > 0
              ? "Won leads in this range."
              : "No conversion records in this range.",
          available: conversionsAvailable,
        },
        avgRating: {
          label: "Avg. Rating",
          value: avgRating,
          previous: null,
          series: [],
          hint: reviewCount ? `${reviewCount} review${reviewCount === 1 ? "" : "s"}` : "No reviews yet.",
          available: reviewCount > 0,
          reviewCount,
        },
      },
      integrations,
      performance: [
        { key: "website", label: "Website", value: 0, color: "#3b82f6" },
        {
          key: "social",
          label: "Social Media",
          value: hasSocialAnalytics ? reachValue : 0,
          color: "#22c55e",
        },
        {
          key: "advertising",
          label: "Advertising",
          value: adCurrent._sum.impressions ?? 0,
          color: "#8b5cf6",
        },
        {
          key: "reviews",
          label: "Reviews",
          value: reviewCount,
          color: "#f97316",
        },
      ],
      topPages: [],
      topPosts,
      reviews: reviews.map((review) => ({
        id: review.id,
        reviewerName: review.reviewerName?.trim() || "Reviewer",
        rating: review.rating,
        body: preview(review.body || review.title, 110),
        provider: review.provider,
        reviewedAt: review.reviewedAt?.toISOString() ?? null,
      })),
    };
  } catch (error) {
    console.error(
      "[dashboard-home] Query failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    if (!scope.allowMockFallback) {
      return {
        source: "unavailable",
        sourceLabel: "Data is temporarily unavailable.",
        range,
        welcomeName,
        ...EMPTY,
      };
    }
    return {
      source: "mock",
      sourceLabel: "Mock foundation data — dashboard query failed.",
      range,
      welcomeName,
      ...EMPTY,
    };
  }
}
