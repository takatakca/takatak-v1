import type { MetaAdCreativeReportRow } from "@/lib/social/analytics/meta-ad-creative-mapping";

/**
 * A descriptive, same-campaign comparison only. No industry reference,
 * audience-adjusted result, causal winner, creative-asset attribution or ROI.
 */
export const PEER_MIN_IMPRESSIONS = 1_000;
export const PEER_MIN_SPEND = 10;
export const PEER_MIN_ADS = 3;

export type MetaAdPeerComparison = {
  campaignId: string;
  campaignName: string;
  sampleSize: number;
  medians: { ctr: number | null; cpc: number | null; cpm: number | null };
};

function valid(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function median(values: readonly (number | null)[]): number | null {
  const numbers = values.filter(valid).sort((a, b) => a - b);
  if (numbers.length < PEER_MIN_ADS) return null;
  const mid = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[mid] : (numbers[mid - 1] + numbers[mid]) / 2;
}

/**
 * Calculate campaign-level peer samples from already authorized and loaded ads.
 * Never combine separate campaigns, clients, periods or currencies.
 */
export function compareMetaAdsWithinCampaign(
  rows: readonly MetaAdCreativeReportRow[],
  complete: boolean,
): MetaAdPeerComparison[] {
  if (!complete) return [];
  const byCampaign = new Map<string, MetaAdCreativeReportRow[]>();
  const seenAdIds = new Set<string>();

  for (const ad of rows) {
    if (!ad.campaignId || !/^\d{1,32}$/.test(ad.campaignId) ||
        !/^\d{1,32}$/.test(ad.adId) || seenAdIds.has(ad.adId) ||
        !valid(ad.impressions) || ad.impressions < PEER_MIN_IMPRESSIONS ||
        !valid(ad.spend) || ad.spend < PEER_MIN_SPEND) continue;
    seenAdIds.add(ad.adId);
    const peers = byCampaign.get(ad.campaignId) ?? [];
    peers.push(ad);
    byCampaign.set(ad.campaignId, peers);
  }

  const result: MetaAdPeerComparison[] = [];
  for (const [campaignId, ads] of byCampaign) {
    if (ads.length < PEER_MIN_ADS) continue;
    const medians = {
      ctr: median(ads.map((ad) => ad.ctr)),
      cpc: median(ads.map((ad) => ad.cpc)),
      cpm: median(ads.map((ad) => ad.cpm)),
    };
    if (medians.ctr === null && medians.cpc === null && medians.cpm === null) continue;
    result.push({
      campaignId,
      campaignName: ads.find((ad) => ad.campaignName)?.campaignName ?? "Meta campaign",
      sampleSize: ads.length,
      medians,
    });
  }
  // Display largest samples first, never rank campaigns by presumed effectiveness.
  return result.sort((a, b) => b.sampleSize - a.sampleSize || a.campaignId.localeCompare(b.campaignId));
}
