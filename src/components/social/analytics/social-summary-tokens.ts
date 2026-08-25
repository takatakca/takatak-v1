export type SocialPlatformKey =
  | "facebook"
  | "instagram"
  | "threads"
  | "tiktok"
  | "google_business"
  | "linkedin"
  | "x"
  | "youtube"
  | "pinterest"
  | "bluesky"
  | "twitch";

export type SocialAdPlatformKey = "meta_ads" | "google_ads";

export const PLATFORM_NAMES: Record<SocialPlatformKey, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  tiktok: "TikTok",
  google_business: "Google Business Profile",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
  pinterest: "Pinterest",
  bluesky: "Bluesky",
  twitch: "Twitch",
};

export const AD_PLATFORM_NAMES: Record<SocialAdPlatformKey, string> = {
  meta_ads: "Meta Ads",
  google_ads: "Google Ads",
};

/**
 * Exact Metricool-style card fills sampled from the supplied Summary screenshots.
 */
export const PLATFORM_CARD_COLORS: Record<SocialPlatformKey, string> = {
  facebook: "#8B95F4",
  instagram: "#FEB1E9",
  bluesky: "#566DF1",
  pinterest: "#E4A934",
  tiktok: "#98A2AB",
  youtube: "#FB7959",
  twitch: "#BA87B0",
  google_business: "#51A76A",
  threads: "#3A3A3A",
  linkedin: "#6FA3D0",
  x: "#4A4A4A",
};

export const AD_PLATFORM_CARD_COLORS: Record<SocialAdPlatformKey, string> = {
  meta_ads: "#8996F6",
  google_ads: "#51A76A",
};

export const SUMMARY_PAGE_BG = "#FCFCFC";
export const SUMMARY_PANEL_BG = "#FFFFFF";
export const SUMMARY_TOTAL_CARD_BG = "#EDEEF2";
export const SUMMARY_CHART_SERIES = "#BA87B0";
export const SUMMARY_GRID = "#ECEEF2";
export const SUMMARY_AXIS = "#9AA1AA";

export const FOLLOWER_PLATFORM_ORDER: SocialPlatformKey[] = [
  "facebook",
  "instagram",
  "bluesky",
  "pinterest",
  "tiktok",
  "youtube",
  "twitch",
];

export const IMPRESSION_PLATFORM_ORDER: SocialPlatformKey[] = [
  "facebook",
  "instagram",
  "google_business",
  "pinterest",
  "tiktok",
  "youtube",
  "twitch",
];

export const POST_PLATFORM_ORDER: SocialPlatformKey[] = [
  "facebook",
  "instagram",
  "bluesky",
  "google_business",
  "pinterest",
  "tiktok",
  "youtube",
  "twitch",
];

export const AD_PLATFORM_ORDER: SocialAdPlatformKey[] = [
  "meta_ads",
  "google_ads",
];

export type MetricValue =
  | { kind: "value"; value: number }
  | { kind: "unavailable" };

export function metricValue(value: number | null | undefined): MetricValue {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { kind: "unavailable" };
  }

  return { kind: "value", value };
}

export function formatMetric(
  value: MetricValue,
  format: (n: number) => string = (n) =>
    new Intl.NumberFormat("en-CA", { maximumFractionDigits: 0 }).format(n),
): string {
  if (value.kind === "unavailable") {
    return "—";
  }

  return format(value.value);
}

export function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function displayDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function displayDateShort(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function enumerateDates(start: string, end: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);

  while (cursor <= last) {
    dates.push(dateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

export function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function number(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat("en-CA", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}
