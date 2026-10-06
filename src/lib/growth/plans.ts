// Growth Suite — customer journey and service catalog (pure data).
//
// The TAKATAK journey: a business starts with a domain, adds hosting, then
// grows with social, marketing (reviews, listings, ads, SEO) and AI that runs
// the work for them. Prices are DRAFT values in CAD for the owner to confirm;
// nothing here charges anyone — Stripe checkout is wired separately.

import type { GrowthStage } from "./types";

export const GROWTH_STAGES: GrowthStage[] = [
  {
    key: "domain",
    step: 1,
    title: "Domain",
    href: "/dashboard/web-hosting/domains",
    summary: "Claim the business name online. DNS, SSL and email all start here.",
    connectorKeys: ["upmind", "cloudflare"],
  },
  {
    key: "hosting",
    step: 2,
    title: "Hosting & Website",
    href: "/dashboard/web-hosting",
    summary: "Fast hosting, a website that converts, backups and security.",
    connectorKeys: ["upmind"],
  },
  {
    key: "social",
    step: 3,
    title: "Social Media",
    href: "/dashboard/social",
    summary: "Every social account in one place, one click publishes everywhere.",
    connectorKeys: ["metricool"],
  },
  {
    key: "marketing",
    step: 4,
    title: "Marketing",
    href: "/dashboard/growth/ads-manager",
    summary: "Reviews, local listings, SEO, Google and Facebook ads, retargeting and geo-targeting.",
    connectorKeys: ["google_business_profile", "qmaps", "google_ads", "meta_ads", "takatak_ads"],
  },
  {
    key: "ai",
    step: 5,
    title: "AI Studio & Agents",
    href: "/dashboard/growth/ai-engine",
    summary: "AI creates, posts, replies and reports on autopilot, paid with credits.",
    connectorKeys: ["takatak_site_audit"],
  },
];

export interface ServicePlanDef {
  key: string;
  name: string;
  stage: GrowthStage["key"];
  monthlyCad: number;
  /** Replaces comparable standalone software (positioning only). */
  replaces?: string;
  includes: string[];
}

/** DRAFT price list — owner to confirm before publishing on /pricing. */
export const SERVICE_PLANS: ServicePlanDef[] = [
  {
    key: "domain_care",
    name: "Domain Care",
    stage: "domain",
    monthlyCad: 3,
    includes: ["Domain renewal monitoring", "DNS management", "Free SSL"],
  },
  {
    key: "hosting_business",
    name: "Business Hosting",
    stage: "hosting",
    monthlyCad: 19,
    includes: ["Managed hosting", "Daily backups", "Uptime + security monitoring", "Professional email"],
  },
  {
    key: "social_suite",
    name: "Social Suite",
    stage: "social",
    monthlyCad: 39,
    replaces: "Hootsuite / Later",
    includes: ["All social accounts", "One-click multi-platform posting", "Content calendar", "Social analytics"],
  },
  {
    key: "reputation",
    name: "Reputation Pro",
    stage: "marketing",
    monthlyCad: 49,
    replaces: "Birdeye / Podium reviews",
    includes: ["Review requests by SMS, WhatsApp and email", "Private feedback funnel", "Review monitoring", "AI review replies"],
  },
  {
    key: "local_seo",
    name: "Local SEO",
    stage: "marketing",
    monthlyCad: 59,
    replaces: "BrightLocal / Semrush Local",
    includes: ["Listings + citations", "Weekly site audit", "Keyword rank tracking", "Google Business Profile sync"],
  },
  {
    key: "ads_manager",
    name: "Ads Manager",
    stage: "marketing",
    monthlyCad: 79,
    includes: ["Google + Meta + TAKATAK ADS in one view", "Retargeting audiences", "Geo-targeting", "Lead attribution"],
  },
  {
    key: "conversations",
    name: "Conversations",
    stage: "marketing",
    monthlyCad: 29,
    replaces: "Podium / Tidio",
    includes: ["Website chat widget", "WhatsApp + Messenger + SMS inbox", "AI first reply"],
  },
  {
    key: "ai_autopilot",
    name: "AI Autopilot",
    stage: "ai",
    monthlyCad: 99,
    includes: ["All AI agents", "500 credits / month included", "Approval gates on every publish and spend"],
  },
];

export const ALL_IN_BUNDLE = {
  name: "TAKATAK One",
  monthlyCad: 299,
  summary: "Every plan above in one subscription, managed by TAKATAK with AI agents running the daily work.",
};
