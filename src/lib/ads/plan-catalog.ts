import {
  ADS_PLAN_CODES,
  type AdsFeature,
  type AdsPlanCode,
  type AdsPlanEntitlements,
} from "./types";

export const ADS_UNSUBSCRIBED_PLAN_CODE = "ads_unsubscribed" as const;

export const ADS_PLAN_CATALOG: Record<AdsPlanCode, AdsPlanEntitlements> = {
  ads_unsubscribed: {
    planCode: "ads_unsubscribed",
    planName: "TAKATAK ADS — Unsubscribed",
    launchState: "foundation",
    features: [],
  },
  ads_direct: {
    planCode: "ads_direct",
    planName: "TAKATAK ADS Direct",
    launchState: "pilot",
    features: ["ads_access", "single_site_campaigns"],
  },
  ads_local_network: {
    planCode: "ads_local_network",
    planName: "TAKATAK ADS Local Network",
    launchState: "pilot",
    features: [
      "ads_access",
      "single_site_campaigns",
      "network_campaigns",
      "qmaps_targeting",
    ],
  },
  ads_max_lead_pro: {
    planCode: "ads_max_lead_pro",
    planName: "TAKATAK Max Lead Pro",
    launchState: "pilot",
    features: [
      "ads_access",
      "single_site_campaigns",
      "network_campaigns",
      "max_lead_pro",
      "qmaps_targeting",
      "flex_attribution",
      "local_lab_creatives",
    ],
  },
};

export function isAdsPlanCode(value: string | null | undefined): value is AdsPlanCode {
  return Boolean(
    value && (ADS_PLAN_CODES as readonly string[]).includes(value),
  );
}

export function adsPlanHasFeature(
  planCode: AdsPlanCode,
  feature: AdsFeature,
): boolean {
  return ADS_PLAN_CATALOG[planCode].features.includes(feature);
}
