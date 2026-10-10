// Growth Suite — module directory shown on the hub and in navigation.

export interface GrowthModuleLink {
  href: string;
  title: string;
  summary: string;
}

export const GROWTH_MODULES: GrowthModuleLink[] = [
  { href: "/dashboard/growth/report", title: "Monthly Report", summary: "A printable client report of everything TAKATAK delivered this month." },
  { href: "/dashboard/growth/analytics", title: "Analytics", summary: "Traffic, conversions and ad results in one view." },
  { href: "/dashboard/growth/reviews", title: "Reputation & Reviews", summary: "Review requests, private feedback funnel, monitoring and AI replies." },
  { href: "/dashboard/growth/conversations", title: "Conversations", summary: "Website chat, WhatsApp, Messenger and SMS in one inbox." },
  { href: "/dashboard/growth/ads-manager", title: "Ads Manager", summary: "Google, Meta, TikTok, Microsoft and TAKATAK ADS side by side." },
  { href: "/dashboard/growth/audiences", title: "Retargeting & Geo", summary: "Bring visitors back and target the right neighbourhoods." },
  { href: "/dashboard/seo", title: "SEO", summary: "Live site audit, keywords and backlinks." },
  { href: "/dashboard/growth/ai-engine", title: "AI Engine & Credits", summary: "13 AI engines, autopilot agents and credit pricing." },
  { href: "/dashboard/growth/connectors", title: "Connectors", summary: "Every API TAKATAK plugs into, with live setup status." },
  { href: "/dashboard/growth/pricing", title: "Plans & Pricing", summary: "The one-stop-shop catalog, from domain to AI autopilot." },
];
