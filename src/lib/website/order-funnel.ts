// The /commander order funnel: one service per step, tiers from the real
// catalogs only (core-categories.ts, pricing.ts, the AI credit packs), a
// running total, and a quote that can be saved and shared. Pure data: no I/O.

import { AI_CREDIT_PACKS } from "@/lib/growth/ai-engine";
import { CORE_CATEGORIES, type CategoryKey, type PriceTier } from "./core-categories";
import type { Cadence } from "./pricing";
import { pricing } from "./pricing";

export type StepKey = "website" | "hosting" | "social" | "marketing" | "reviews" | "phone" | "credits";
export type AddOnKey = "domain" | "local";
export type LineKey = StepKey | AddOnKey;

/** Owner's chain (2026-10-31): Website > Hosting > Social > Marketing > Reviews > Phone > AI credits. */
export const STEPS: readonly StepKey[] = ["website", "hosting", "social", "marketing", "reviews", "phone", "credits"];

export const STEP_CATEGORY: Record<StepKey, CategoryKey> = {
  website: "website",
  hosting: "hosting",
  social: "social",
  marketing: "marketing",
  reviews: "reviews",
  phone: "voip",
  credits: "ai",
};

export interface FunnelTier {
  id: string;
  /** Translation key of the tier name, or a literal name when `literal` is set. */
  nameKey: string;
  literal?: boolean;
  amount: number;
  cadence: Cadence;
  detailKeys: readonly string[];
  /** The catalog's own featured tier: shown as "Recommended". */
  featured?: boolean;
  suffixKey?: string;
  /** AI credit packs: the number of credits in the pack. */
  credits?: number;
}

export type StepOffer =
  | { kind: "tiers"; tiers: FunnelTier[] }
  | { kind: "quote" }
  | { kind: "waitlist" };

const fromCatalog = (t: PriceTier, i: number): FunnelTier => ({
  id: `${t.nameKey}#${i}`,
  nameKey: t.nameKey,
  amount: t.amount,
  cadence: t.cadence,
  detailKeys: t.detailKeys,
  featured: t.featured,
  suffixKey: t.suffixKey,
});

/** What each step sells, straight from the catalogs. */
export function stepOffer(step: StepKey): StepOffer {
  if (step === "credits") {
    return {
      kind: "tiers",
      tiers: AI_CREDIT_PACKS.map((p) => ({
        id: `credits.${p.key}`,
        nameKey: p.label,
        literal: true,
        credits: p.credits,
        amount: p.priceCad,
        cadence: "one-time" as Cadence,
        detailKeys: [],
        featured: p.key === "growth",
      })),
    };
  }
  const category = CORE_CATEGORIES.find((c) => c.key === STEP_CATEGORY[step]);
  const p = category?.pricing;
  if (!p || p.kind === "planned") return { kind: "waitlist" };
  if (p.kind === "quote") return { kind: "quote" };
  if (p.kind === "social") return { kind: "tiers", tiers: p.software.map(fromCatalog) };
  return { kind: "tiers", tiers: p.tiers.map(fromCatalog) };
}

/** Optional add-ons shown inside a step, each needing its own click. */
export const ADD_ONS: Record<AddOnKey, { step: StepKey; tier: () => FunnelTier }> = {
  domain: {
    step: "hosting",
    tier: () => ({ id: "addon.domain", nameKey: "cat.domains.name", amount: pricing.domain.register.amount, cadence: "yearly", detailKeys: [] }),
  },
  local: {
    step: "reviews",
    tier: () => fromCatalog(stepOfferLocal()[0], 0),
  },
};

function stepOfferLocal(): PriceTier[] {
  const local = CORE_CATEGORIES.find((c) => c.key === "local");
  return local?.pricing.kind === "tiers" ? [...local.pricing.tiers] : [];
}

export type FunnelLine =
  | { kind: "price"; tier: FunnelTier }
  | { kind: "quote" }
  | { kind: "waitlist" };

export interface FunnelState {
  business: string | null;
  lines: Partial<Record<LineKey, FunnelLine>>;
}

export const EMPTY_FUNNEL: FunnelState = { business: null, lines: {} };

export interface FunnelTotals {
  /** Paid at the first order: one-time items, first month, first year. */
  first: number;
  monthly: number;
  yearly: number;
  quotes: number;
  count: number;
}

export function funnelTotals(state: FunnelState): FunnelTotals {
  const t: FunnelTotals = { first: 0, monthly: 0, yearly: 0, quotes: 0, count: 0 };
  for (const line of Object.values(state.lines)) {
    if (!line) continue;
    t.count += 1;
    if (line.kind !== "price") {
      if (line.kind === "quote") t.quotes += 1;
      continue;
    }
    const { amount, cadence } = line.tier;
    t.first += amount;
    if (cadence === "monthly") t.monthly += amount;
    if (cadence === "yearly") t.yearly += amount;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return { ...t, first: round(t.first), monthly: round(t.monthly), yearly: round(t.yearly) };
}

/** Our recommendation per business type (an opinion shown as "For a restaurant we recommend…"). */
export const BUSINESS_PICKS: Record<string, Partial<Record<StepKey, number>>> = {
  restaurant: { website: 1, hosting: 2, social: 1, marketing: 1, credits: 1 },
  shop: { website: 3, hosting: 3, social: 1, marketing: 1, credits: 1 },
  services: { website: 1, hosting: 1, social: 0, marketing: 0, credits: 0 },
  startup: { website: 0, hosting: 0, social: 0, marketing: 0, credits: 0 },
};

/** Index of the tier to highlight: the business pick, else the catalog's featured tier. */
export function recommendedIndex(step: StepKey, tiers: readonly FunnelTier[], business: string | null): number {
  const pick = business ? BUSINESS_PICKS[business]?.[step] : undefined;
  if (pick !== undefined && pick < tiers.length) return pick;
  const featured = tiers.findIndex((t) => t.featured);
  return featured >= 0 ? featured : 0;
}

/** Category keys in the quote, for /register?plan=… (the plan carry-over on sign-up). */
export function planKeys(state: FunnelState): CategoryKey[] {
  const keys = new Set<CategoryKey>();
  for (const line of Object.keys(state.lines) as LineKey[]) {
    if (!state.lines[line]) continue;
    if (line === "domain") keys.add("domains");
    else if (line === "local") keys.add("local");
    else keys.add(STEP_CATEGORY[line]);
  }
  return CORE_CATEGORIES.map((c) => c.key).filter((k) => keys.has(k));
}

/** Compact, shareable quote: `/commander?q=…` (tier ids only; prices are re-read from the catalog). */
export function encodeQuote(state: FunnelState): string {
  const compact = {
    b: state.business,
    l: Object.fromEntries(
      Object.entries(state.lines).map(([k, v]) => [k, v?.kind === "price" ? v.tier.id : v?.kind ?? null]),
    ),
  };
  const json = JSON.stringify(compact);
  return typeof btoa === "function" ? btoa(unescape(encodeURIComponent(json))).replace(/=+$/, "") : "";
}

export function decodeQuote(q: string): FunnelState | null {
  try {
    const json = decodeURIComponent(escape(atob(q)));
    const parsed = JSON.parse(json) as { b?: unknown; l?: Record<string, unknown> };
    const state: FunnelState = { business: typeof parsed.b === "string" ? parsed.b : null, lines: {} };
    for (const [key, value] of Object.entries(parsed.l ?? {})) {
      if (value === "quote") state.lines[key as LineKey] = { kind: "quote" };
      else if (value === "waitlist") state.lines[key as LineKey] = { kind: "waitlist" };
      else if (typeof value === "string") {
        const tier = findTier(key as LineKey, value);
        if (tier) state.lines[key as LineKey] = { kind: "price", tier };
      }
    }
    return state;
  } catch {
    return null;
  }
}

export function findTier(line: LineKey, id: string): FunnelTier | null {
  if (line === "domain" || line === "local") {
    const t = ADD_ONS[line].tier();
    return t.id === id ? t : null;
  }
  const offer = stepOffer(line);
  return offer.kind === "tiers" ? offer.tiers.find((t) => t.id === id) ?? null : null;
}
