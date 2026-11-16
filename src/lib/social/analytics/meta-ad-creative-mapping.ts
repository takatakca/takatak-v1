import { safeCreativeAction, safeCreativeCopy, safeMetaCreativeThumbnail } from "@/lib/social/analytics/meta-creative-media";

/**
 * Mapper for Meta ad-level performance + per-ad creative metadata.
 * No aggregation between ads or accounts; absence is represented by null.
 */
export type MetaAdCreativeReportRow = {
  adId: string;
  adName: string;
  campaignName: string | null;
  campaignId: string | null;
  creativeId: string | null;
  creativeName: string | null;
  creativeType: string | null;
  /** Optional creative content. These fields may not be returned by every Meta ad format. */
  creativeTitle?: string | null;
  creativeBody?: string | null;
  creativeThumbnailUrl?: string | null;
  creativeVideoId?: string | null;
  creativeCallToAction?: string | null;
  status: string | null;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};

type GraphRow = Record<string, unknown>;

function graphId(value: unknown): string | null {
  if (typeof value === "string" && /^\d{1,32}$/.test(value)) return value;
  return null;
}

function graphName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, 180);
  return clean.length > 0 ? clean : null;
}

function graphMetric(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "string" && value.trim().length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function graphRecord(value: unknown): GraphRow | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as GraphRow
    : null;
}

export function mergeMetaAdInsightsWithCreatives(
  insights: readonly GraphRow[],
  ads: readonly GraphRow[],
): MetaAdCreativeReportRow[] {
  const adById = new Map<string, GraphRow>();
  for (const ad of ads) {
    const id = graphId(ad.id);
    if (id) adById.set(id, ad);
  }
  const seen = new Set<string>();
  const rows: MetaAdCreativeReportRow[] = [];
  for (const point of insights) {
    const adId = graphId(point.ad_id);
    if (!adId || seen.has(adId)) continue;
    seen.add(adId);
    const ad = adById.get(adId) ?? null;
    const creative = graphRecord(ad?.creative);
    const status = graphName(ad?.effective_status);
    rows.push({
      adId,
      adName: graphName(point.ad_name) ?? graphName(ad?.name) ?? "Meta ad",
      campaignName: graphName(point.campaign_name),
      campaignId: graphId(point.campaign_id),
      creativeId: graphId(creative?.id),
      creativeName: graphName(creative?.name),
      creativeType: graphName(creative?.object_type),
      creativeTitle: safeCreativeCopy(creative?.title, 140),
      creativeBody: safeCreativeCopy(creative?.body, 320),
      creativeThumbnailUrl: safeMetaCreativeThumbnail(creative?.thumbnail_url),
      creativeVideoId: graphId(creative?.video_id),
      creativeCallToAction: safeCreativeAction(creative?.call_to_action_type),
      status: status && /^[A-Z_]{1,40}$/.test(status) ? status : null,
      impressions: graphMetric(point.impressions),
      clicks: graphMetric(point.clicks),
      spend: graphMetric(point.spend),
      ctr: graphMetric(point.ctr),
      cpc: graphMetric(point.cpc),
      cpm: graphMetric(point.cpm),
    });
  }
  return rows.sort((a, b) => (b.spend ?? -1) - (a.spend ?? -1));
}

/** True only when every ad present in insights has a matching /ads metadata object. */
export function hasCompleteMetaAdMetadata(
  insights: readonly Record<string, unknown>[],
  ads: readonly Record<string, unknown>[],
): boolean {
  const metadataIds = new Set(
    ads.map((item) => graphId(item.id)).filter((id): id is string => id !== null),
  );
  return insights.every((item) => {
    const id = graphId(item.ad_id);
    return id !== null && metadataIds.has(id);
  });
}
