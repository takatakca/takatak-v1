// The connector ecosystem shown on the homepage, built only from the real
// catalogs: AI engines (Admin › AI provider keys), Growth Suite connectors,
// social publishing providers, and the TAKATAK house apps. The total shown on
// the page is the size of this list, never a typed number.

import { AI_PROVIDER_CATALOG } from "@/lib/ai-providers/catalog";
import { CONNECTORS } from "@/lib/growth/connectors";
import { SUITE_GROUPS } from "@/lib/website/home-funnel";

export type WallGroup = "ai" | "growth" | "house";

export interface WallItem {
  key: string;
  name: string;
  group: WallGroup;
  /** Slug in BRAND_ICONS, when a public brand mark exists. */
  icon?: string;
  /** House mark: icon name (HOUSE_ICONS) or a two-letter monogram. */
  mark?: string;
  mono?: string;
}

const AI_ICON: Record<string, string> = {
  anthropic: "claude",
  gemini: "googlegemini",
  mistral: "mistralai",
  perplexity: "perplexity",
  deepseek: "deepseek",
  elevenlabs: "elevenlabs",
  suno: "suno",
  cursor: "cursor",
};
/** Short public names (the catalog names carry admin notes). */
const AI_NAME: Record<string, string> = {
  anthropic: "Claude",
  openai: "ChatGPT",
  gemini: "Gemini",
  xai: "Grok",
  groq: "Groq",
  stability: "Stability AI",
};

const CONNECTOR_ICON: Record<string, string> = {
  cloudflare: "cloudflare",
  ga4: "googleanalytics",
  search_console: "googlesearchconsole",
  gtm: "googletagmanager",
  meta_pixel: "meta",
  google_ads: "googleads",
  meta_ads: "meta",
  tiktok_ads: "tiktok",
  google_business_profile: "googlemaps",
  facebook_reviews: "facebook",
  yelp: "yelp",
  trustpilot: "trustpilot",
  whatsapp: "whatsapp",
  messenger: "messenger",
  pagespeed: "pagespeedinsights",
  semrush: "semrush",
  stripe: "stripe",
};
const CONNECTOR_NAME: Record<string, string> = {
  metricool: "Metricool",
  meta_pixel: "Meta Pixel",
  meta_ads: "Meta Ads",
  facebook_reviews: "Facebook",
  yelp: "Yelp",
  whatsapp: "WhatsApp",
  twilio_sms: "Twilio SMS",
  pagespeed: "PageSpeed",
};

/** Social publishing providers implemented in src/lib/social/providers/registry.ts. */
const SOCIAL: WallItem[] = [
  { key: "instagram", name: "Instagram", group: "growth", icon: "instagram" },
  { key: "threads", name: "Threads", group: "growth", icon: "threads" },
  { key: "youtube", name: "YouTube", group: "growth", icon: "youtube" },
  { key: "tiktok", name: "TikTok", group: "growth", icon: "tiktok" },
  { key: "pinterest", name: "Pinterest", group: "growth", icon: "pinterest" },
  { key: "x", name: "X", group: "growth", icon: "x" },
  { key: "bluesky", name: "Bluesky", group: "growth", icon: "bluesky" },
  { key: "twitch", name: "Twitch", group: "growth", icon: "twitch" },
  // Email sending for the site (Gmail SMTP, docs/NEWSLETTER.md).
  { key: "gmail", name: "Gmail", group: "growth", icon: "gmail" },
];

/** Built by TAKATAK. */
const HOUSE_CONNECTOR_MARK: Record<string, string> = {
  takatak_social: "share",
  takatak_analytics: "chart",
  takatak_ads: "megaphone",
  takatak_review_funnel: "star",
  qmaps: "pin",
  web_chat: "chat",
  takatak_site_audit: "scan",
  flexs: "bolt",
};
const HOUSE_APP_MARK: Record<string, string> = {
  foodhub: "chef",
  seo: "search",
  mimt: "phone",
  academy: "cap",
};
const isHouse = (key: string) => key in HOUSE_CONNECTOR_MARK;

function houseName(key: string, name: string): string {
  return name.replace(/^TAKATAK /, "TAKATAK ").replace(" Widget", "");
}

export const WALL_AI: WallItem[] = AI_PROVIDER_CATALOG.map((p) => ({
  key: p.key,
  name: AI_NAME[p.key] ?? p.name,
  group: "ai" as const,
  icon: AI_ICON[p.key],
}));

export const WALL_GROWTH: WallItem[] = [
  ...CONNECTORS.filter((c) => !isHouse(c.key)).map((c) => ({
    key: c.key,
    name: CONNECTOR_NAME[c.key] ?? c.name.replace(/\s*\(.*\)\s*$/, ""),
    group: "growth" as const,
    icon: CONNECTOR_ICON[c.key],
  })),
  ...SOCIAL,
];

export const WALL_HOUSE: WallItem[] = (() => {
  const items: WallItem[] = [
    { key: "takbot", name: "TAK bot", group: "house", mark: "spark" },
    ...CONNECTORS.filter((c) => isHouse(c.key)).map((c) => ({ key: c.key, name: houseName(c.key, c.name), group: "house" as const, mark: HOUSE_CONNECTOR_MARK[c.key] })),
  ];
  for (const g of SUITE_GROUPS) {
    for (const p of g.products) {
      if (items.some((i) => i.key === p.key)) continue;
      items.push({ key: p.key, name: p.name, group: "house", mark: HOUSE_APP_MARK[p.key], mono: HOUSE_APP_MARK[p.key] ? undefined : p.mono });
    }
  }
  items.push({ key: "facturations", name: "Facturations", group: "house", mark: "receipt" });
  return items;
})();

export const WALL_TOTAL = new Set([...WALL_AI, ...WALL_GROWTH, ...WALL_HOUSE].map((i) => `${i.group === "house" ? "h" : "x"}:${i.key}`)).size;
