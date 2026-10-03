export const ADS_PLAN_CODES = [
  "ads_unsubscribed",
  "ads_direct",
  "ads_local_network",
  "ads_max_lead_pro",
] as const;

export type AdsPlanCode = (typeof ADS_PLAN_CODES)[number];

export const ADS_FEATURES = [
  "ads_access",
  "single_site_campaigns",
  "network_campaigns",
  "max_lead_pro",
  "qmaps_targeting",
  "flex_attribution",
  "local_lab_creatives",
] as const;

export type AdsFeature = (typeof ADS_FEATURES)[number];

export type AdsPlanEntitlements = {
  planCode: AdsPlanCode;
  planName: string;
  features: readonly AdsFeature[];
  launchState: "foundation" | "pilot";
};

export type AdsSubscriptionAccess = "paid" | "blocked";

export type AdsTargetingContext = {
  country?: string | null;
  region?: string | null;
  city?: string | null;
  postalPrefix?: string | null;
  category?: string | null;
  locale?: string | null;
  device?: string | null;
};

export type AdsTargetingRules = {
  countries?: string[];
  regions?: string[];
  cities?: string[];
  postalPrefixes?: string[];
  categories?: string[];
  locales?: string[];
  devices?: string[];
};

export type ServedAd = {
  campaignId: string;
  creativeId: string;
  placementId: string;
  headline: string;
  body: string | null;
  callToAction: string | null;
  destinationUrl: string;
  imageUrl: string | null;
  label: "Publicité" | "Advertisement";
  trackingToken: string | null;
  trackingEnabled: boolean;
};
