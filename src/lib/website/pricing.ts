// Centralized TAKATAK pricing (CAD). Single source of truth for all
// "starting at" pricing displayed across the site. Amounts are in whole
// CAD units (dollars).

export type Cadence = "one-time" | "monthly" | "yearly" | "per-lead" | "custom";

export interface PriceTier {
  key: string;
  name: string;
  amount: number;
  cadence: Cadence;
  suffix?: string; // e.g. "+ ad spend"
  description?: string;
  features?: readonly string[];
}

export const pricing = {
  domain: {
    register: { key: "domain-register", name: "Domain registration", amount: 19.99, cadence: "yearly" as Cadence },
    transfer: { key: "domain-transfer", name: "Domain transfer", amount: 19.99, cadence: "one-time" as Cadence },
  },
  hosting: [
    { key: "portfolio", name: "Portfolio", amount: 9.99, cadence: "monthly", description: "Personal sites and simple landing pages.", features: ["1 site", "10 GB SSD", "Free SSL", "Email-ready"] },
    { key: "bronze", name: "Bronze", amount: 19.99, cadence: "monthly", description: "Small business websites and portfolios.", features: ["Up to 3 sites", "30 GB SSD", "Daily backups", "Free SSL + email"] },
    { key: "silver", name: "Silver", amount: 39.99, cadence: "monthly", description: "WordPress and growing business sites.", features: ["Up to 10 sites", "80 GB SSD", "WordPress tuning", "cPanel + staging"] },
    { key: "gold", name: "Gold", amount: 79.99, cadence: "monthly", description: "High-traffic and ecommerce-ready hosting.", features: ["Unlimited sites", "200 GB SSD NVMe", "Priority routing", "Ecommerce ready"] },
  ] as const,
  websites: [
    { key: "starter", name: "Starter Website", amount: 499, cadence: "one-time", description: "1–3 pages, mobile-ready, launch in days." },
    { key: "business", name: "Business Website", amount: 1499, cadence: "one-time", description: "5–8 pages, contact forms, analytics." },
    { key: "premium", name: "Premium Website", amount: 2999, cadence: "one-time", description: "Custom design, booking, payments, integrations." },
    { key: "ecommerce", name: "Ecommerce Website", amount: 3999, cadence: "one-time", description: "Products, checkout, shipping & payments setup." },
  ] as const,
  apps: [
    { key: "prototype", name: "App Prototype", amount: 1999, cadence: "one-time" },
    { key: "mvp", name: "Business App MVP", amount: 7500, cadence: "one-time" },
    { key: "custom", name: "Custom Mobile App", amount: 15000, cadence: "custom", suffix: "+" },
  ] as const,
  branding: [
    { key: "logo", name: "Logo Design", amount: 149, cadence: "one-time" },
    { key: "kit", name: "Brand Kit", amount: 499, cadence: "one-time" },
    { key: "identity", name: "Full Brand Identity", amount: 1499, cadence: "one-time" },
  ] as const,
  marketing: [
    { key: "setup", name: "Campaign Setup", amount: 299, cadence: "one-time" },
    { key: "monthly", name: "Monthly Marketing", amount: 499, cadence: "monthly" },
    { key: "growth", name: "Advanced Growth", amount: 1500, cadence: "monthly", suffix: "+ ad spend" },
  ] as const,
  social: [
    { key: "starter", name: "Social Starter", amount: 149, cadence: "monthly" },
    { key: "business", name: "Social Business", amount: 399, cadence: "monthly" },
    { key: "pro", name: "Social Pro", amount: 799, cadence: "monthly" },
  ] as const,
  local: [
    { key: "setup", name: "Listing Setup", amount: 99, cadence: "one-time" },
    { key: "mgmt", name: "Local Visibility", amount: 199, cadence: "monthly" },
    { key: "multi", name: "Multi-location", amount: 499, cadence: "monthly" },
  ] as const,
  leads: [
    { key: "setup", name: "Lead System Setup", amount: 299, cadence: "one-time" },
    { key: "per-lead", name: "Qualified Leads", amount: 25, cadence: "per-lead" },
    { key: "managed", name: "Managed Lead Campaign", amount: 750, cadence: "monthly" },
  ] as const,
  voip: [
    { key: "starter", name: "Business Phone Starter", amount: 19.99, cadence: "monthly" },
    { key: "business", name: "VoIP Business", amount: 49.99, cadence: "monthly" },
    { key: "ai", name: "AI Call Routing", amount: 99, cadence: "monthly" },
  ] as const,
  ai: [
    { key: "workflow", name: "Workflow Automation", amount: 399, cadence: "one-time" },
    { key: "assistant", name: "Custom AI Assistant", amount: 999, cadence: "one-time" },
    { key: "ops", name: "Operations Automation", amount: 2500, cadence: "custom", suffix: "+" },
  ] as const,
  admin: [
    { key: "entry", name: "Data Entry", amount: 99, cadence: "one-time" },
    { key: "cleanup", name: "Spreadsheet Cleanup", amount: 149, cadence: "one-time" },
    { key: "workflow", name: "Admin Workflow", amount: 399, cadence: "one-time" },
  ] as const,
  design: [
    { key: "flyer", name: "Flyer Design", amount: 99, cadence: "one-time" },
    { key: "menu", name: "Restaurant Menu", amount: 199, cadence: "one-time" },
    { key: "campaign", name: "Print Campaign", amount: 499, cadence: "one-time" },
  ] as const,
} as const;

const cadFormatter = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 2,
});

export function formatCAD(amount: number): string {
  // Drop trailing .00 for whole-dollar amounts to keep pricing badges tight.
  const formatted = cadFormatter.format(amount);
  return formatted.replace(/\.00(?!\d)/, "");
}

export function cadenceLabel(cadence: Cadence): string {
  return cadenceLabelEn(cadence);
}

function cadenceLabelEn(cadence: Cadence): string {
  switch (cadence) {
    case "monthly": return "/month";
    case "yearly": return "/year";
    case "per-lead": return "/lead";
    case "custom": return "";
    case "one-time":
    default: return "";
  }
}

/** Translation keys for cadence suffixes, used with useLanguage().t(). */
export const cadenceKeys: Record<Cadence, string> = {
  monthly: "cadence.monthly",
  yearly: "cadence.yearly",
  "per-lead": "cadence.perLead",
  "one-time": "cadence.oneTime",
  custom: "cadence.custom",
};

export function startingAt(amount: number, cadence: Cadence = "one-time", suffix?: string): string {
  return `${formatCAD(amount)}${cadenceLabel(cadence)}${suffix ? ` ${suffix}` : ""}`;
}

// Homepage featured pricing rail — one representative price per category.
export interface FeaturedPrice {
  key: string;
  category: string;
  headline: string;
  from: number;
  cadence: Cadence;
  suffix?: string;
  cta: string;
  href: string;
}

export const featuredPrices: readonly FeaturedPrice[] = [
  { key: "domain",    category: "Domain Names",     headline: "Register a .ca, .com, .net or .org", from: pricing.domain.register.amount, cadence: "yearly",   cta: "Search domains",       href: "/domain" },
  { key: "hosting",   category: "Web Hosting",      headline: "Managed hosting with SSL & backups", from: pricing.hosting[0].amount,      cadence: "monthly",  cta: "View hosting plans",    href: "/hosting" },
  { key: "website",   category: "Website Creation", headline: "Websites that convert",              from: pricing.websites[0].amount,     cadence: "one-time", cta: "Start website intake",  href: "/services/websites" },
  { key: "app",       category: "Mobile Apps",      headline: "iOS & Android app builds",           from: pricing.apps[0].amount,         cadence: "one-time", cta: "Start app project",     href: "/services/mobile-apps" },
  { key: "marketing", category: "Marketing",        headline: "Paid campaigns & funnels",           from: pricing.marketing[0].amount,    cadence: "one-time", cta: "Start marketing",       href: "/services/marketing" },
  { key: "social",    category: "Social Automation",headline: "Content, planning & publishing",     from: pricing.social[0].amount,       cadence: "monthly",  cta: "Set up social",         href: "/services/social-media" },
  { key: "local",     category: "Local Visibility", headline: "Get found on Maps & directories",    from: pricing.local[0].amount,        cadence: "one-time", cta: "Improve local visibility", href: "/services/local-listings" },
  { key: "leads",     category: "Lead Generation",  headline: "Qualified leads on demand",          from: pricing.leads[1].amount,        cadence: "per-lead", cta: "Set up lead generation", href: "/services/lead-generation" },
  { key: "voip",      category: "Business VoIP",    headline: "Numbers, IVR & call flows",          from: pricing.voip[0].amount,         cadence: "monthly",  cta: "Set up VoIP",           href: "/services/voip" },
  { key: "ai",        category: "AI Business Tools",headline: "Automations & AI assistants",        from: pricing.ai[0].amount,           cadence: "one-time", cta: "Describe your workflow", href: "/services/ai-business-tools" },
  { key: "logo",      category: "Logo & Branding",  headline: "Brand identity & logo systems",      from: pricing.branding[0].amount,     cadence: "one-time", cta: "Start branding",         href: "/marketplace/search" },
  { key: "design",    category: "Menus & Flyers",   headline: "Flyers, menus & print design",       from: pricing.design[0].amount,       cadence: "one-time", cta: "Start design project",   href: "/marketplace/search" },
] as const;
// Starting price (CAD) per service key from src/lib/services.ts.
export const serviceStartingPrice: Record<string, { amount: number; cadence: Cadence; suffix?: string }> = {
  domains: { amount: pricing.domain.register.amount, cadence: "yearly" },
  hosting: { amount: pricing.hosting[0].amount, cadence: "monthly" },
  websites: { amount: pricing.websites[0].amount, cadence: "one-time" },
  mobile_apps: { amount: pricing.apps[0].amount, cadence: "one-time" },
  online_marketing: { amount: pricing.marketing[0].amount, cadence: "one-time" },
  social_media: { amount: pricing.social[0].amount, cadence: "monthly" },
  local_listings: { amount: pricing.local[0].amount, cadence: "one-time" },
  lead_generation: { amount: pricing.leads[0].amount, cadence: "one-time" },
  voip_phone: { amount: pricing.voip[0].amount, cadence: "monthly" },
  ai_business_tools: { amount: pricing.ai[0].amount, cadence: "one-time" },
  freelancer_marketplace: { amount: pricing.admin[0].amount, cadence: "one-time" },
};

// Full pricing table used by /pricing.
export interface PricingGroup {
  key: string;
  title: string;
  blurb: string;
  href: string;
  tiers: readonly { key: string; name: string; amount: number; cadence: Cadence; suffix?: string; description?: string }[];
}

export const pricingGroups: readonly PricingGroup[] = [
  { key: "domains", title: "Domain Names", blurb: "Registration, transfer, DNS and renewals in CAD.", href: "/domain", tiers: [pricing.domain.register, pricing.domain.transfer] },
  { key: "hosting", title: "Web Hosting", blurb: "Managed hosting with SSL, backups and support.", href: "/hosting", tiers: pricing.hosting },
  { key: "websites", title: "Websites", blurb: "Designed, built and launched by our team.", href: "/services/websites", tiers: pricing.websites },
  { key: "apps", title: "Mobile Apps", blurb: "Prototype to production app delivery.", href: "/services/mobile-apps", tiers: pricing.apps },
  { key: "branding", title: "Logo & Branding", blurb: "Identity systems and brand assets.", href: "/marketplace", tiers: pricing.branding },
  { key: "marketing", title: "Marketing", blurb: "Campaign setup and ongoing growth.", href: "/services/marketing", tiers: pricing.marketing },
  { key: "social", title: "Social Media", blurb: "Content planning and publishing.", href: "/services/social-media", tiers: pricing.social },
  { key: "local", title: "Local Visibility", blurb: "Maps, directories and local search.", href: "/services/local-listings", tiers: pricing.local },
  { key: "leads", title: "Lead Generation", blurb: "Qualified leads and managed campaigns.", href: "/services/lead-generation", tiers: pricing.leads },
  { key: "voip", title: "Business VoIP", blurb: "Numbers, IVR and call routing.", href: "/services/voip", tiers: pricing.voip },
  { key: "ai", title: "Automation & AI Tools", blurb: "Workflow automation and assistants.", href: "/services/ai-business-tools", tiers: pricing.ai },
  { key: "admin", title: "Admin Support", blurb: "Data, spreadsheets and back-office tasks.", href: "/marketplace", tiers: pricing.admin },
  { key: "design", title: "Print & Design", blurb: "Flyers, menus and campaign collateral.", href: "/marketplace", tiers: pricing.design },
];
