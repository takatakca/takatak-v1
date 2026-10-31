"use client";

// The visitor's plan on the homepage: services picked in the carousel or the
// plan builder, shown in the sticky dock and carried to /register. Session
// storage only (cleared when the tab closes); no personal data.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { CORE_CATEGORIES, type CategoryKey, type CoreCategory } from "./core-categories";

const KEY = "takatak:home-plan";

export interface PlanTotals {
  oneTime: number;
  monthly: number;
  yearly: number;
  /** Services priced on quote or not launched yet. */
  quoted: number;
}

export function planTotals(keys: readonly CategoryKey[]): PlanTotals {
  const totals: PlanTotals = { oneTime: 0, monthly: 0, yearly: 0, quoted: 0 };
  for (const key of keys) {
    const c = CORE_CATEGORIES.find((x) => x.key === key);
    if (!c) continue;
    if (typeof c.from === "string") {
      totals.quoted += 1;
      continue;
    }
    if (c.from.cadence === "monthly") totals.monthly += c.from.amount;
    else if (c.from.cadence === "yearly") totals.yearly += c.from.amount;
    else if (c.from.cadence === "one-time") totals.oneTime += c.from.amount;
    else totals.quoted += 1;
  }
  return totals;
}

export function readStoredPlan(): CategoryKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((k): k is CategoryKey => CORE_CATEGORIES.some((c) => c.key === k)) : [];
  } catch {
    return [];
  }
}

interface PlanContextValue {
  keys: CategoryKey[];
  has: (key: CategoryKey) => boolean;
  toggle: (key: CategoryKey) => void;
  set: (keys: CategoryKey[]) => void;
  clear: () => void;
  totals: PlanTotals;
  categories: CoreCategory[];
  /** /register with the plan in the query string, so the next step can show it. */
  registerHref: string;
  /** The order pop-up (summary and the buttons to order). */
  orderOpen: boolean;
  setOrderOpen: (open: boolean) => void;
}

const PlanContext = createContext<PlanContextValue | null>(null);

export function HomePlanProvider({ children }: { children: ReactNode }) {
  const [keys, setKeys] = useState<CategoryKey[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);

  useEffect(() => {
    setKeys(readStoredPlan());
  }, []);

  const persist = useCallback((next: CategoryKey[]) => {
    // Keep the owner's category order whatever the click order was.
    const ordered = CORE_CATEGORIES.map((c) => c.key).filter((k) => next.includes(k));
    setKeys(ordered);
    try {
      window.sessionStorage.setItem(KEY, JSON.stringify(ordered));
    } catch {
      /* storage may be unavailable */
    }
  }, []);

  const value = useMemo<PlanContextValue>(() => {
    const has = (key: CategoryKey) => keys.includes(key);
    return {
      keys,
      has,
      toggle: (key) => persist(has(key) ? keys.filter((k) => k !== key) : [...keys, key]),
      set: persist,
      clear: () => persist([]),
      totals: planTotals(keys),
      categories: CORE_CATEGORIES.filter((c) => keys.includes(c.key)),
      registerHref: keys.length ? `/register?plan=${keys.join(",")}` : "/register",
      orderOpen,
      setOrderOpen,
    };
  }, [keys, persist, orderOpen]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function useHomePlan(): PlanContextValue {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("useHomePlan must be used inside HomePlanProvider");
  return ctx;
}
