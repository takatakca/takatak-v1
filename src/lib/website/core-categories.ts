// The core of every TAKATAK customer (owner, Oct 2026), in this order:
// domains, hosting, marketing / ads, social media, local listings, reviews,
// AI Studio, billing / invoicing, business phone. Every customer starts with
// a website, so it leads the list without a number.
//
// Copy lives in translations (en.ts / fr.ts) under `cat.<key>.*`.
// Prices come only from the code catalogs: src/lib/website/pricing.ts and
// src/lib/billing/social/{plan,addon}-catalog.ts. A category with no price in
// code is "on quote"; the business phone is planned and shows no price.
// Capabilities are labelled `soon` when the code does not run them yet.
// scripts/verify-website-categories.ts keeps this file honest.
import {
  ArrowRightLeft,
  AtSign,
  BarChart3,
  BellRing,
  BookMarked,
  Bot,
  Building2,
  CalendarDays,
  Camera,
  Clapperboard,
  CreditCard,
  DatabaseBackup,
  FileText,
  Filter,
  Gauge,
  Globe2,
  HardDrive,
  Hash,
  Headset,
  Inbox,
  LayoutTemplate,
  LineChart,
  ListChecks,
  Lock,
  MailCheck,
  MapPin,
  Megaphone,
  MessageSquareReply,
  Mic2,
  MousePointerClick,
  Navigation,
  Network,
  Percent,
  PhoneCall,
  PhoneForwarded,
  ReceiptText,
  Rocket,
  Search,
  Server,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Star,
  Swords,
  Target,
  Users,
  Voicemail,
  Wand2,
  Workflow,
  type LucideIcon,
} from "lucide-react";

import { SOCIAL_ADDON_CATALOG } from "@/lib/billing/social/addon-catalog";
import { SOCIAL_PLAN_CATALOG, annualSavingsPercent } from "@/lib/billing/social/plan-catalog";
import { pricing, type Cadence } from "./pricing";

export type CategoryKey =
  | "website"
  | "domains"
  | "hosting"
  | "marketing"
  | "social"
  | "local"
  | "reviews"
  | "ai"
  | "billing"
  | "voip";

/** live: runs in the product today · early: part live, part coming soon ·
 *  onRequest: delivered by our team on request · planned: not launched. */
export type Availability = "live" | "early" | "onRequest" | "planned";

export type MockKind =
  | "domainSearch"
  | "dns"
  | "server"
  | "campaign"
  | "socialCalendar"
  | "listing"
  | "reviews"
  | "reviewRequest"
  | "aiGenerate"
  | "invoice"
  | "invoiceList"
  | "callFlow";

export interface CategoryImage {
  src: string;
  width: number;
  height: number;
}

/** One switchable view inside a category: a real image or a product mock-up. */
export interface CategoryView {
  id: string;
  image?: CategoryImage;
  mock?: MockKind;
}

export interface IncludedItem {
  icon: LucideIcon;
  /** Not running in the product yet: shown with a "Coming soon" label. */
  soon?: boolean;
}

export interface PriceTier {
  /** Translation key of the tier name. */
  nameKey: string;
  amount: number;
  cadence: Cadence;
  suffixKey?: string;
  /** Translation keys of the tier's detail lines. */
  detailKeys: readonly string[];
  featured?: boolean;
  /** Code file and line the amount comes from (reported, never shown). */
  source: string;
}

export type CategoryPricing =
  | { kind: "tiers"; tiers: readonly PriceTier[] }
  | { kind: "social"; software: readonly PriceTier[]; managed: readonly PriceTier[] }
  | { kind: "quote"; related?: readonly PriceTier[] }
  | { kind: "planned" };

export type CtaAction = "link" | "domainSearch" | "chat";

export interface CategoryCta {
  labelKey: string;
  to: string;
  action?: CtaAction;
}

export interface CoreCategory {
  key: CategoryKey;
  /** 1–9 in the owner's order; the website leads without a number. */
  index: number | null;
  route: string;
  icon: LucideIcon;
  accent: string;
  accent2: string;
  availability: Availability;
  views: readonly CategoryView[];
  /** Small mock layered over the main visual for depth. */
  floating?: MockKind;
  included: readonly IncludedItem[];
  steps: number;
  faqs: number;
  /** Proper nouns (networks, platforms) shown as chips; same in both languages. */
  chips?: readonly { label: string; soon?: boolean }[];
  pricing: CategoryPricing;
  /** Homepage "from" line. */
  from: { amount: number; cadence: Cadence; prefixKey: string } | "quote" | "planned";
  primary: CategoryCta;
  secondary: CategoryCta;
}

/** Social networks a TAKATAK workspace can connect today
 *  (src/lib/social/providers/registry.ts: implemented and connectable). */
export const SOCIAL_NETWORKS_LIVE = [
  "Facebook",
  "Instagram",
  "Threads",
  "TikTok",
  "YouTube",
  "X",
  "Bluesky",
  "Twitch",
  "Google Business Profile",
] as const;

/** In the provider registry but not implemented yet. */
export const SOCIAL_NETWORKS_SOON = ["LinkedIn", "Pinterest"] as const;

/** Ad platforms with a live account connection (registry: meta_ads, google_ads). */
export const AD_PLATFORMS_LIVE = ["Meta Ads", "Google Ads"] as const;

/** Reporting connection in the registry (looker_studio). */
export const REPORTING_LIVE = ["Looker Studio"] as const;

const img = (name: string, width = 1280, height = 800): CategoryImage => ({
  src: `/marketplace/visuals/${name}.jpg`,
  width,
  height,
});

const tier = (
  nameKey: string,
  amount: number,
  cadence: Cadence,
  detailKeys: readonly string[],
  source: string,
  extra: Partial<Pick<PriceTier, "featured" | "suffixKey">> = {},
): PriceTier => ({ nameKey, amount, cadence, detailKeys, source, ...extra });

const plan = SOCIAL_PLAN_CATALOG;

export const SOCIAL_ANNUAL_SAVINGS_PERCENT = annualSavingsPercent();
export const SOCIAL_X_ADDON_MONTHLY = SOCIAL_ADDON_CATALOG.x_account.displayMonthlyCad;

/** Self-serve social plans with a Stripe checkout (plan-catalog.ts). */
export const SOCIAL_SOFTWARE_PLANS = [
  { code: "social_essential_1", entry: plan.social_essential_1, source: "src/lib/billing/social/plan-catalog.ts:111" },
  { code: "social_starter_5", entry: plan.social_starter_5, source: "src/lib/billing/social/plan-catalog.ts:120" },
  { code: "social_advanced_15", entry: plan.social_advanced_15, source: "src/lib/billing/social/plan-catalog.ts:138" },
] as const;

const P = "src/lib/website/pricing.ts";

export const CORE_CATEGORIES: readonly CoreCategory[] = [
  {
    key: "website",
    index: null,
    route: "/services/websites",
    icon: LayoutTemplate,
    accent: "#1F8BFF",
    accent2: "#29C3FF",
    availability: "live",
    views: [
      { id: "design", image: img("website") },
      { id: "store", image: img("ecommerce") },
      { id: "mobile", image: img("mobile") },
    ],
    included: [
      { icon: LayoutTemplate },
      { icon: Smartphone },
      { icon: Search },
      { icon: MailCheck },
      { icon: ShoppingCart },
      { icon: BarChart3 },
    ],
    steps: 4,
    faqs: 4,
    pricing: {
      kind: "tiers",
      tiers: pricing.websites.map((w, i) =>
        tier(`tier.websites.${w.key}`, w.amount, w.cadence, [`cat.website.tier.${w.key}`], `${P}:${29 + i}`, {
          featured: w.key === "business",
        }),
      ),
    },
    from: { amount: pricing.websites[0].amount, cadence: "one-time", prefixKey: "cat.from" },
    primary: { labelKey: "cat.website.cta", to: "/marketplace/post-project" },
    secondary: { labelKey: "cat.common.talk", to: "", action: "chat" },
  },
  {
    key: "domains",
    index: 1,
    route: "/domain",
    icon: AtSign,
    accent: "#22C7FF",
    accent2: "#7DE3FF",
    availability: "live",
    views: [
      { id: "search", mock: "domainSearch" },
      { id: "dns", mock: "dns" },
    ],
    floating: "dns",
    included: [
      { icon: Globe2 },
      { icon: ArrowRightLeft },
      { icon: Network },
      { icon: MailCheck },
      { icon: Lock },
      { icon: BellRing },
    ],
    steps: 4,
    faqs: 4,
    chips: [{ label: ".ca" }, { label: ".com" }, { label: ".net" }, { label: ".org" }],
    pricing: {
      kind: "tiers",
      tiers: [
        tier("tier.domains.domain-register", pricing.domain.register.amount, "yearly", ["cat.domains.tier.register"], `${P}:19`, { featured: true }),
        tier("tier.domains.domain-transfer", pricing.domain.transfer.amount, "one-time", ["cat.domains.tier.transfer"], `${P}:20`),
      ],
    },
    from: { amount: pricing.domain.register.amount, cadence: "yearly", prefixKey: "cat.from" },
    primary: { labelKey: "cat.domains.cta", to: "/domain", action: "domainSearch" },
    secondary: { labelKey: "cat.domains.cta2", to: "/marketplace/post-project" },
  },
  {
    key: "hosting",
    index: 2,
    route: "/hosting",
    icon: Server,
    accent: "#2F7BFF",
    accent2: "#7FB2FF",
    availability: "live",
    views: [
      { id: "server", mock: "server" },
      { id: "migration", image: { src: "/img/migration.webp", width: 930, height: 690 } },
    ],
    included: [
      { icon: ShieldCheck },
      { icon: DatabaseBackup },
      { icon: Gauge },
      { icon: HardDrive },
      { icon: ArrowRightLeft },
      { icon: Headset },
    ],
    steps: 4,
    faqs: 4,
    pricing: {
      kind: "tiers",
      tiers: pricing.hosting.map((h, i) =>
        tier(
          `tier.hosting.${h.key}`,
          h.amount,
          h.cadence,
          h.features.map((_, f) => `cat.hosting.tier.${h.key}.f${f + 1}`),
          `${P}:${23 + i}`,
          { featured: h.key === "silver" },
        ),
      ),
    },
    from: { amount: pricing.hosting[0].amount, cadence: "monthly", prefixKey: "cat.from" },
    primary: { labelKey: "cat.hosting.cta", to: "/checkout" },
    secondary: { labelKey: "cat.common.talk", to: "", action: "chat" },
  },
  {
    key: "marketing",
    index: 3,
    route: "/services/marketing",
    icon: Megaphone,
    accent: "#FF3D9A",
    accent2: "#FF8AC4",
    availability: "live",
    views: [
      { id: "campaigns", mock: "campaign" },
      { id: "analytics", image: img("seo") },
    ],
    included: [
      { icon: Megaphone },
      { icon: Target },
      { icon: LineChart },
      { icon: MousePointerClick },
      { icon: FileText },
      { icon: Users },
    ],
    steps: 4,
    faqs: 4,
    chips: [...AD_PLATFORMS_LIVE.map((label) => ({ label })), ...REPORTING_LIVE.map((label) => ({ label }))],
    pricing: {
      kind: "tiers",
      tiers: pricing.marketing.map((m, i) =>
        tier(`tier.marketing.${m.key}`, m.amount, m.cadence, [`cat.marketing.tier.${m.key}`], `${P}:${45 + i}`, {
          featured: m.key === "monthly",
          suffixKey: "suffix" in m ? "suffix.adSpend" : undefined,
        }),
      ),
    },
    from: { amount: pricing.marketing[0].amount, cadence: "one-time", prefixKey: "cat.fromSetup" },
    primary: { labelKey: "cat.marketing.cta", to: "/marketplace/post-project" },
    secondary: { labelKey: "cat.common.talk", to: "", action: "chat" },
  },
  {
    key: "social",
    index: 4,
    route: "/services/social-media",
    icon: Share2,
    accent: "#9B5CFF",
    accent2: "#D58BFF",
    availability: "early",
    views: [
      { id: "calendar", mock: "socialCalendar" },
      { id: "content", image: img("social") },
    ],
    included: [
      { icon: Share2 },
      { icon: BarChart3 },
      { icon: Swords },
      { icon: CalendarDays },
      { icon: ListChecks },
      { icon: Rocket, soon: true },
    ],
    steps: 4,
    faqs: 4,
    chips: [
      ...SOCIAL_NETWORKS_LIVE.map((label) => ({ label })),
      ...SOCIAL_NETWORKS_SOON.map((label) => ({ label, soon: true })),
    ],
    pricing: {
      kind: "social",
      software: SOCIAL_SOFTWARE_PLANS.map((p, i) =>
        tier(
          `tier.socialPlan.${p.code}`,
          p.entry.displayMonthlyCad,
          "monthly",
          [`cat.social.plan.${p.code}.f1`, `cat.social.plan.${p.code}.f2`, `cat.social.plan.${p.code}.f3`],
          p.source,
          { featured: i === 1 },
        ),
      ),
      managed: pricing.social.map((s, i) =>
        tier(`tier.social.${s.key}`, s.amount, s.cadence, [`cat.social.tier.${s.key}`], `${P}:${50 + i}`, {
          featured: s.key === "business",
        }),
      ),
    },
    from: { amount: plan.social_essential_1.displayMonthlyCad, cadence: "monthly", prefixKey: "cat.fromPlans" },
    primary: { labelKey: "cat.social.cta", to: "/register" },
    secondary: { labelKey: "cat.social.cta2", to: "/dashboard/billing" },
  },
  {
    key: "local",
    index: 5,
    route: "/services/local-listings",
    icon: MapPin,
    accent: "#5468FF",
    accent2: "#9AA6FF",
    availability: "live",
    views: [
      { id: "profile", mock: "listing" },
      { id: "search", image: img("seo") },
    ],
    included: [
      { icon: Building2 },
      { icon: Navigation },
      { icon: PhoneCall },
      { icon: ListChecks },
      { icon: Camera },
      { icon: Users },
    ],
    steps: 4,
    faqs: 4,
    chips: [{ label: "Google Business Profile" }],
    pricing: {
      kind: "tiers",
      tiers: pricing.local.map((l, i) =>
        tier(`tier.local.${l.key}`, l.amount, l.cadence, [`cat.local.tier.${l.key}`], `${P}:${55 + i}`, {
          featured: l.key === "mgmt",
        }),
      ),
    },
    from: { amount: pricing.local[0].amount, cadence: "one-time", prefixKey: "cat.fromSetup" },
    primary: { labelKey: "cat.local.cta", to: "/marketplace/post-project" },
    secondary: { labelKey: "cat.common.talk", to: "", action: "chat" },
  },
  {
    key: "reviews",
    index: 6,
    route: "/services/reviews",
    icon: Star,
    accent: "#D946EF",
    accent2: "#F59BFF",
    availability: "early",
    views: [
      { id: "monitor", mock: "reviews" },
      { id: "collect", mock: "reviewRequest" },
    ],
    included: [
      { icon: Inbox },
      { icon: Star },
      { icon: MessageSquareReply },
      { icon: Headset },
      { icon: Smartphone, soon: true },
      { icon: Bot, soon: true },
    ],
    steps: 4,
    faqs: 4,
    chips: [{ label: "Google Business Profile" }],
    pricing: { kind: "quote" },
    from: "quote",
    primary: { labelKey: "cat.reviews.cta", to: "/marketplace/post-project" },
    secondary: { labelKey: "cat.common.talk", to: "", action: "chat" },
  },
  {
    key: "ai",
    index: 7,
    route: "/services/ai-studio",
    icon: Sparkles,
    accent: "#7C5CFF",
    accent2: "#29C3FF",
    availability: "early",
    views: [
      { id: "studio", image: img("ai") },
      { id: "generate", mock: "aiGenerate" },
    ],
    included: [
      { icon: Mic2 },
      { icon: BookMarked },
      { icon: Wand2, soon: true },
      { icon: Megaphone, soon: true },
      { icon: Clapperboard, soon: true },
      { icon: Workflow },
    ],
    steps: 4,
    faqs: 4,
    pricing: {
      kind: "quote",
      related: pricing.ai.map((a, i) =>
        tier(`tier.ai.${a.key}`, a.amount, a.cadence, [`cat.ai.tier.${a.key}`], `${P}:${70 + i}`, {
          featured: a.key === "assistant",
          suffixKey: "suffix" in a ? "cat.suffix.plus" : undefined,
        }),
      ),
    },
    from: "quote",
    primary: { labelKey: "cat.ai.cta", to: "/marketplace/post-project" },
    secondary: { labelKey: "cat.common.talk", to: "", action: "chat" },
  },
  {
    key: "billing",
    index: 8,
    route: "/services/billing",
    icon: ReceiptText,
    accent: "#4FA3FF",
    accent2: "#B8C4D3",
    availability: "live",
    views: [
      { id: "invoice", mock: "invoice" },
      { id: "tracking", mock: "invoiceList" },
    ],
    included: [
      { icon: CreditCard },
      { icon: ReceiptText },
      { icon: Percent },
      { icon: BellRing },
      { icon: Filter },
      { icon: FileText },
    ],
    steps: 4,
    faqs: 4,
    pricing: { kind: "quote" },
    from: "quote",
    primary: { labelKey: "cat.billing.cta", to: "/register" },
    secondary: { labelKey: "cat.billing.cta2", to: "/marketplace/post-project" },
  },
  {
    key: "voip",
    index: 9,
    route: "/services/voip",
    icon: PhoneCall,
    accent: "#4D9DFF",
    accent2: "#B69CFF",
    availability: "planned",
    views: [
      { id: "flow", mock: "callFlow" },
      { id: "office", image: img("voip") },
    ],
    included: [
      { icon: Hash, soon: true },
      { icon: Bot, soon: true },
      { icon: Users, soon: true },
      { icon: Voicemail, soon: true },
      { icon: PhoneForwarded, soon: true },
      { icon: Headset },
    ],
    steps: 4,
    faqs: 4,
    pricing: { kind: "planned" },
    from: "planned",
    primary: { labelKey: "cat.voip.cta", to: "/marketplace/post-project" },
    secondary: { labelKey: "cat.voip.cta2", to: "", action: "chat" },
  },
];

/** The nine numbered core categories (the website leads without a number). */
export const NUMBERED_CATEGORIES = CORE_CATEGORIES.filter((c) => c.index !== null);

export function getCoreCategory(key: CategoryKey): CoreCategory {
  const found = CORE_CATEGORIES.find((c) => c.key === key);
  if (!found) throw new Error(`Unknown core category: ${key}`);
  return found;
}

/** /services/<slug> pages that render the premium category sales page. */
export const SERVICE_SLUG_TO_CATEGORY: Record<string, CategoryKey> = {
  websites: "website",
  domains: "domains",
  hosting: "hosting",
  marketing: "marketing",
  "social-media": "social",
  "local-listings": "local",
  reviews: "reviews",
  "ai-studio": "ai",
  billing: "billing",
  voip: "voip",
};
