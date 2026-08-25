"use client";

import { useState } from "react";
import { Link } from "@/lib/website/nav";
import { ArrowRight, Check, Server } from "lucide-react";
import { pricing, formatCAD } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

const DESC_KEYS: Record<string, string> = {
  portfolio: "hosting.plan.portfolio.desc",
  bronze: "hosting.plan.bronze.desc",
  silver: "hosting.plan.silver.desc",
  gold: "hosting.plan.gold.desc",
};

/** Capacity signal per plan (visual only — 0..1). */
const CAPACITY: Record<string, readonly number[]> = {
  portfolio: [0.25, 0.2, 0.3],
  bronze: [0.45, 0.4, 0.5],
  silver: [0.7, 0.65, 0.75],
  gold: [1, 0.95, 1],
};

/**
 * Interactive TAKATAK hosting plan selector. Switching a plan updates the
 * price, best-fit description, benefits, capacity signal and CTA.
 */
export function HostingPlanSelector() {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const [key, setKey] = useState<string>(pricing.hosting[1].key);
  const plan = pricing.hosting.find((p) => p.key === key) ?? pricing.hosting[0];

  return (
    <div className="flex flex-col">
      <div role="tablist" aria-label={t("hosting.selector.title")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {pricing.hosting.map((p) => {
          const active = p.key === plan.key;
          return (
            <button
              key={p.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setKey(p.key)}
              className={`rounded-xl border p-3 text-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                active
                  ? "border-primary bg-primary/10 shadow-[var(--shadow-card)] " + (reduced ? "" : "-translate-y-0.5")
                  : "border-border bg-background hover:border-primary/50"
              }`}
            >
              <span className="flex items-center justify-center text-primary"><Server size={14} /></span>
              <span className="mt-1.5 block text-xs font-semibold text-foreground">{p.name}</span>
              <span className="block text-[11px] text-muted-foreground">
                {formatCAD(p.amount)}{t("cadence.monthly")}
              </span>
            </button>
          );
        })}
      </div>

      <div key={plan.key} className={reduced ? "mt-5" : "mt-5 animate-fade-in"}>
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">
            {t("hosting.selector.bestFor")}
          </p>
          <p className="text-lg font-bold text-foreground">
            {formatCAD(plan.amount)}
            <span className="text-xs font-medium text-muted-foreground">{t("cadence.monthly")}</span>
          </p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t(DESC_KEYS[plan.key] as never)}</p>

        <div className="mt-4 grid gap-1.5" aria-hidden>
          {(CAPACITY[plan.key] ?? []).map((v, i) => (
            <span key={i} className="block h-1 overflow-hidden rounded-full bg-secondary">
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                style={{ width: `${Math.round(v * 100)}%` }}
              />
            </span>
          ))}
        </div>

        <ul className="mt-4 grid gap-1.5">
          {(plan.features ?? []).map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
              <Check size={14} className="shrink-0 text-primary" /> {f}
            </li>
          ))}
        </ul>

        <Link
          to="/hosting"
          hash={plan.key}
          className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("hosting.selector.cta")} <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
