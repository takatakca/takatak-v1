/**
 * Exploratory comparisons inside ONE selected Meta ad account only.
 * Do not interpret these campaign-level values as creative/industry benchmarks,
 * quality scores, causality, ROAS, or cross-tenant averages.
 */
export type MetaCampaignBenchmarkInput = {
  id: string;
  name: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
};

export type MetaCampaignBenchmarkRow = MetaCampaignBenchmarkInput & {
  impressions: number;
  spend: number;
};

export type MetaCampaignBenchmarkSummary =
  | { kind: "unavailable"; reason: string; eligible: number }
  | {
      kind: "ready";
      eligible: number;
      minImpressions: number;
      minSpend: number;
      medians: { ctr: number | null; cpc: number | null; cpm: number | null };
      rows: MetaCampaignBenchmarkRow[];
    };

export const CAMPAIGN_BENCHMARK_MIN_IMPRESSIONS = 1000;
export const CAMPAIGN_BENCHMARK_MIN_SPEND = 10;
export const CAMPAIGN_BENCHMARK_MIN_PEERS = 3;

function nonnegative(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function median(values: Array<number | null>): number | null {
  const eligible = values.filter(nonnegative).sort((left, right) => left - right);
  if (eligible.length < CAMPAIGN_BENCHMARK_MIN_PEERS) return null;
  const middle = Math.floor(eligible.length / 2);
  if (eligible.length % 2 === 1) return eligible[middle];
  return (eligible[middle - 1] + eligible[middle]) / 2;
}

export function summarizeMetaCampaignBenchmarks(
  campaigns: readonly MetaCampaignBenchmarkInput[],
  confirmed: boolean,
): MetaCampaignBenchmarkSummary {
  if (!confirmed) {
    return {
      kind: "unavailable",
      reason: "The connected Meta account did not return a complete campaign report.",
      eligible: 0,
    };
  }

  const rows: MetaCampaignBenchmarkRow[] = campaigns
    .filter((campaign): campaign is MetaCampaignBenchmarkRow =>
      nonnegative(campaign.impressions) &&
      campaign.impressions >= CAMPAIGN_BENCHMARK_MIN_IMPRESSIONS &&
      nonnegative(campaign.spend) &&
      campaign.spend >= CAMPAIGN_BENCHMARK_MIN_SPEND &&
      nonnegative(campaign.clicks),
    )
    .map((campaign) => ({
      ...campaign,
      ctr: nonnegative(campaign.ctr) ? campaign.ctr : null,
      cpc: nonnegative(campaign.cpc) ? campaign.cpc : null,
      cpm: nonnegative(campaign.cpm) ? campaign.cpm : null,
    }));

  if (rows.length < CAMPAIGN_BENCHMARK_MIN_PEERS) {
    return {
      kind: "unavailable",
      reason: "At least three campaigns with 1,000 impressions and 10 units of account-currency spend each are needed.",
      eligible: rows.length,
    };
  }

  // Each median is per campaign, not a spend-weighted average.
  // A metric remains unknown if fewer than three campaigns reported it.
  return {
    kind: "ready",
    eligible: rows.length,
    minImpressions: CAMPAIGN_BENCHMARK_MIN_IMPRESSIONS,
    minSpend: CAMPAIGN_BENCHMARK_MIN_SPEND,
    medians: {
      ctr: median(rows.map((row) => row.ctr)),
      cpc: median(rows.map((row) => row.cpc)),
      cpm: median(rows.map((row) => row.cpm)),
    },
    rows: [...rows].sort((a, b) => b.spend - a.spend),
  };
}
