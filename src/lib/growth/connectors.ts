// Growth Suite — connector catalog (pure data, safe to import anywhere).
// Presence-only status resolution lives in ./connector-status.ts (server-only).
// Adding a connector here never triggers a network call; real adapters are
// built per provider once their official API contract is confirmed.

import type { ConnectorCategory, ConnectorDef } from "./types";

export const CONNECTOR_CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  domains_hosting: "Domains & Hosting",
  social: "Social Media",
  analytics: "Analytics & Tracking",
  ads: "Paid Ads",
  reviews: "Reviews & Reputation",
  local: "Local Listings",
  messaging: "Messaging & Chat",
  seo: "SEO Intelligence",
  leads: "Leads",
  payments: "Payments",
};

export const CONNECTOR_CATEGORY_ORDER: ConnectorCategory[] = [
  "domains_hosting",
  "social",
  "analytics",
  "ads",
  "reviews",
  "local",
  "messaging",
  "seo",
  "leads",
  "payments",
];

const GOOGLE_SERVICE_ACCOUNT = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
];

export const CONNECTORS: ConnectorDef[] = [
  // Domains & Hosting
  {
    key: "upmind",
    name: "Upmind",
    category: "domains_hosting",
    purpose: "Domain registration, hosting provisioning and invoicing.",
    env: ["UPMIND_API_KEY", "UPMIND_API_BASE_URL"],
    kind: "external",
    managedIn: "/dashboard/integrations",
  },
  {
    key: "cloudflare",
    name: "Cloudflare",
    category: "domains_hosting",
    purpose: "DNS zones, CDN, SSL and firewall rules for client domains.",
    env: ["CLOUDFLARE_API_TOKEN"],
    kind: "external",
    docsUrl: "https://developers.cloudflare.com/api/",
  },

  // Social — native TAKATAK Social (knowledgeAI projects/SOCIAL-CORE.md).
  // Metricool is a UX benchmark and optional legacy adapter, never a dependency.
  {
    key: "takatak_social",
    name: "TAKATAK Social",
    category: "social",
    purpose: "Native social publishing, calendar, inbox and analytics for every brand.",
    env: [],
    kind: "built_in",
    managedIn: "/dashboard/social",
  },
  {
    key: "metricool",
    name: "Metricool (legacy adapter)",
    category: "social",
    purpose: "Optional legacy adapter kept for benchmarking. TAKATAK Social does not depend on it.",
    env: ["METRICOOL_API_KEY", "METRICOOL_ACCOUNT_ID"],
    kind: "external",
    managedIn: "/dashboard/integrations",
  },

  // Analytics & Tracking
  {
    key: "takatak_analytics",
    name: "TAKATAK Analytics",
    category: "analytics",
    purpose: "Cookie-free first-party traffic, conversions and retargeting audiences.",
    env: [],
    kind: "built_in",
    managedIn: "/dashboard/growth/analytics",
  },
  {
    key: "ga4",
    name: "Google Analytics 4",
    category: "analytics",
    purpose: "Google's own traffic numbers per website (link each GA4 property in Analytics).",
    env: [...GOOGLE_SERVICE_ACCOUNT],
    kind: "external",
    docsUrl: "https://developers.google.com/analytics/devguides/reporting/data/v1",
  },
  {
    key: "search_console",
    name: "Google Search Console",
    category: "analytics",
    purpose: "Real Google search queries, clicks and positions per website (shown on Keywords).",
    env: [...GOOGLE_SERVICE_ACCOUNT],
    kind: "external",
    docsUrl: "https://developers.google.com/webmaster-tools",
  },
  {
    key: "gtm",
    name: "Google Tag Manager",
    category: "analytics",
    purpose: "One container for every pixel and conversion tag on client sites.",
    env: ["GOOGLE_TAG_MANAGER_ID"],
    kind: "external",
  },
  {
    key: "meta_pixel",
    name: "Meta Pixel + Conversions API",
    category: "analytics",
    purpose: "Website events for Facebook/Instagram retargeting and attribution.",
    env: ["META_PIXEL_ID", "META_CONVERSIONS_API_TOKEN"],
    kind: "external",
  },
  {
    key: "clarity",
    name: "Microsoft Clarity",
    category: "analytics",
    purpose: "Heatmaps and session recordings for UX insight.",
    env: ["MICROSOFT_CLARITY_PROJECT_ID"],
    kind: "external",
  },

  // Paid Ads
  {
    key: "takatak_ads",
    name: "TAKATAK ADS",
    category: "ads",
    purpose: "Proprietary local ad network across TAKATAK publisher sites.",
    env: [],
    kind: "built_in",
    managedIn: "/dashboard/advertising",
  },
  {
    key: "google_ads",
    name: "Google Ads",
    category: "ads",
    purpose: "Search, Performance Max, Display and YouTube campaigns.",
    env: [
      "GOOGLE_ADS_DEVELOPER_TOKEN",
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_REFRESH_TOKEN",
      "GOOGLE_ADS_LOGIN_CUSTOMER_ID",
    ],
    kind: "external",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
  },
  {
    key: "meta_ads",
    name: "Meta Ads (Facebook & Instagram)",
    category: "ads",
    purpose: "Campaigns, custom audiences, lookalikes and lead forms.",
    env: ["META_APP_ID", "META_APP_SECRET", "META_ADS_ACCESS_TOKEN"],
    kind: "external",
    docsUrl: "https://developers.facebook.com/docs/marketing-apis",
  },
  {
    key: "tiktok_ads",
    name: "TikTok Ads",
    category: "ads",
    purpose: "Short-video campaigns and TikTok pixel audiences.",
    env: ["TIKTOK_ADS_APP_ID", "TIKTOK_ADS_SECRET", "TIKTOK_ADS_ACCESS_TOKEN"],
    kind: "external",
    docsUrl: "https://business-api.tiktok.com/portal/docs",
  },
  {
    key: "microsoft_ads",
    name: "Microsoft Advertising",
    category: "ads",
    purpose: "Bing search campaigns, often cheaper local clicks.",
    env: [
      "MICROSOFT_ADS_DEVELOPER_TOKEN",
      "MICROSOFT_ADS_CLIENT_ID",
      "MICROSOFT_ADS_REFRESH_TOKEN",
    ],
    kind: "external",
    docsUrl: "https://learn.microsoft.com/en-us/advertising/guides/",
  },

  // Reviews & Reputation
  {
    key: "google_business_profile",
    name: "Google Business Profile",
    category: "reviews",
    purpose: "Import Google reviews, reply to them and keep the listing in sync.",
    env: [
      "GOOGLE_BUSINESS_PROFILE_CLIENT_ID",
      "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET",
      "GROWTH_TOKEN_ENCRYPTION_KEY_V1",
    ],
    managedIn: "/dashboard/growth/reviews",
    kind: "external",
    docsUrl: "https://developers.google.com/my-business",
  },
  {
    key: "facebook_reviews",
    name: "Facebook Recommendations",
    category: "reviews",
    purpose: "Page recommendations and ratings for each brand page.",
    env: ["META_APP_ID", "META_APP_SECRET", "META_PAGE_ACCESS_TOKEN"],
    kind: "external",
  },
  {
    key: "yelp",
    name: "Yelp Fusion",
    category: "reviews",
    purpose: "Business ratings and review excerpts for monitoring.",
    env: ["YELP_API_KEY"],
    kind: "external",
    docsUrl: "https://docs.developer.yelp.com/",
  },
  {
    key: "trustpilot",
    name: "Trustpilot",
    category: "reviews",
    purpose: "Service reviews and review invitations for online businesses.",
    env: ["TRUSTPILOT_API_KEY", "TRUSTPILOT_API_SECRET"],
    kind: "external",
    docsUrl: "https://developers.trustpilot.com/",
  },
  {
    key: "takatak_review_funnel",
    name: "TAKATAK Review Funnel",
    category: "reviews",
    purpose: "Tracked review requests, branded rating page, private feedback inbox and public review routing.",
    env: [],
    kind: "built_in",
    managedIn: "/dashboard/growth/reviews",
  },

  // Local Listings
  {
    key: "qmaps",
    name: "QMAPS",
    category: "local",
    purpose: "Listings, citations and local visibility engine.",
    env: ["QMAPS_API_KEY", "QMAPS_API_BASE_URL"],
    kind: "external",
    managedIn: "/dashboard/local-listings",
  },
  {
    key: "brightlocal",
    name: "BrightLocal",
    category: "local",
    purpose: "Local rank tracking, citation audits and local SEO reports.",
    env: ["BRIGHTLOCAL_API_KEY", "BRIGHTLOCAL_API_SECRET"],
    kind: "external",
    docsUrl: "https://developer.brightlocal.com/",
  },

  // Messaging & Chat
  {
    key: "whatsapp",
    name: "WhatsApp Business (Cloud API)",
    category: "messaging",
    purpose: "Two-way WhatsApp conversations, review requests and alerts.",
    env: [
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_VERIFY_TOKEN",
      "META_APP_SECRET",
    ],
    kind: "external",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
  },
  {
    key: "messenger",
    name: "Facebook Messenger",
    category: "messaging",
    purpose: "Page conversations routed into one unified inbox.",
    env: ["META_PAGE_ACCESS_TOKEN", "META_APP_SECRET"],
    kind: "external",
    docsUrl: "https://developers.facebook.com/docs/messenger-platform",
  },
  {
    key: "twilio_sms",
    name: "Twilio SMS",
    category: "messaging",
    purpose: "Text-message review requests, reminders and two-way SMS.",
    env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_MESSAGING_SERVICE_SID"],
    kind: "external",
    docsUrl: "https://www.twilio.com/docs/messaging",
  },
  {
    key: "web_chat",
    name: "TAKATAK Web Chat Widget",
    category: "messaging",
    purpose: "Pop-up chat bubble for client websites with a live staff inbox and lead hand-off.",
    env: [],
    kind: "built_in",
    managedIn: "/dashboard/growth/conversations",
  },

  // SEO Intelligence
  {
    key: "takatak_site_audit",
    name: "TAKATAK Site Audit",
    category: "seo",
    purpose: "Live on-page audit: titles, meta, headings, indexing, robots and sitemap.",
    env: [],
    kind: "built_in",
    managedIn: "/dashboard/seo",
  },
  {
    key: "pagespeed",
    name: "Google PageSpeed Insights",
    category: "seo",
    purpose: "Core Web Vitals and Lighthouse performance scores.",
    env: ["PAGESPEED_API_KEY"],
    kind: "external",
    docsUrl: "https://developers.google.com/speed/docs/insights/v5/get-started",
  },
  {
    key: "semrush",
    name: "Semrush",
    category: "seo",
    purpose: "Keyword research, domain analytics and competitor gaps.",
    env: ["SEMRUSH_API_KEY"],
    kind: "external",
    docsUrl: "https://developer.semrush.com/api/",
  },
  {
    key: "ahrefs",
    name: "Ahrefs",
    category: "seo",
    purpose: "Backlink index, referring domains and content gaps.",
    env: ["AHREFS_API_TOKEN"],
    kind: "external",
    docsUrl: "https://docs.ahrefs.com/",
  },
  {
    key: "dataforseo",
    name: "DataForSEO",
    category: "seo",
    purpose: "Pay-per-call SERP, keyword volume and rank-tracking data.",
    env: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
    kind: "external",
    docsUrl: "https://docs.dataforseo.com/",
  },

  // Leads
  {
    key: "flexs",
    name: "FLEXS",
    category: "leads",
    purpose: "Lead capture, attribution and follow-up engine.",
    env: ["FLEXS_API_KEY", "FLEXS_API_BASE_URL"],
    kind: "external",
    managedIn: "/dashboard/leads",
  },

  // Payments
  {
    key: "stripe",
    name: "Stripe",
    category: "payments",
    purpose: "Subscriptions, AI credit purchases and invoices.",
    env: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
    kind: "external",
    docsUrl: "https://docs.stripe.com/api",
  },
];

export function connectorByKey(key: string): ConnectorDef | undefined {
  return CONNECTORS.find((c) => c.key === key);
}
