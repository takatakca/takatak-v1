"use client";

import { Check, Plus } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { CONNECTORS } from "@/lib/growth/connectors";
import { TAKBOT_ENGINES, TAKBOT_MODES } from "@/lib/takbot/catalog";
import { CORE_CATEGORIES } from "@/lib/website/core-categories";
import { useHomePlan } from "@/lib/website/home-plan";
import { Rise, Ticker, useSeen } from "./primitives";

const T = {
  label: { en: "Live from our catalog", fr: "En direct de notre catalogue" },
  stats: [
    { n: CORE_CATEGORIES.length, en: "services", fr: "services" },
    { n: TAKBOT_ENGINES.length, en: "AI engines in TAK bot", fr: "moteurs d’IA dans TAK bot" },
    { n: CONNECTORS.length, en: "connectors", fr: "connecteurs" },
    { n: TAKBOT_MODES.length, en: "AI modes", fr: "modes d’IA" },
  ],
  add: { en: "Add", fr: "Ajouter" },
} as const;

/** Real numbers that count up and real starting prices that slide by; tap a price to add it. */
export function LiveBand() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const { ref, seen } = useSeen<HTMLDivElement>();
  const priced = CORE_CATEGORIES.filter((c) => typeof c.from === "object");
  const chips = [...priced, ...priced];

  return (
    <div ref={ref} className="relative overflow-hidden bg-[#050B1A] text-white">
      <div aria-hidden className="hp-tech-grid opacity-60" />
      <div className="relative mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-10">
        <Rise>
          <p className="hp-code-eyebrow flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#7FD8FF]">
            <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            {T.label[lang]}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 lg:grid-cols-2">
            {T.stats.map((s) => (
              <div key={s.en}>
                <dt className="sr-only">{s[lang]}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="hp-display text-[34px] leading-none">
                    <Ticker value={seen ? s.n : 0} format={(v) => String(Math.round(v))} />
                  </span>
                  <span className="text-[13.5px] text-white/70">{s[lang]}</span>
                </dd>
              </div>
            ))}
          </dl>
        </Rise>

        <div className="hp-ticker min-w-0">
          <ul className="hp-ticker-track py-1">
            {chips.map((c, i) => {
              const on = plan.has(c.key);
              const from = c.from as { amount: number; cadence: Parameters<typeof cadenceSuffix>[1] };
              return (
                <li key={`${c.key}-${i}`} aria-hidden={i >= priced.length || undefined}>
                  <button
                    type="button"
                    tabIndex={i >= priced.length ? -1 : 0}
                    onClick={() => plan.toggle(c.key)}
                    aria-pressed={on}
                    className="hp-chip-flash flex items-center gap-3 rounded-full py-2.5 pl-4 pr-2.5 text-left transition-colors"
                    style={{ animationDelay: `${(i % priced.length) * 1}s` }}
                  >
                    <span className="whitespace-nowrap text-[14.5px] font-semibold">{tk(`cat.${c.key}.name`)}</span>
                    <span className="whitespace-nowrap text-[14px] tabular-nums text-[#7FD8FF]">
                      {money(lang, from.amount)}
                      {cadenceSuffix(tk, from.cadence)}
                    </span>
                    <span className={`grid h-7 w-7 place-items-center rounded-full ${on ? "bg-emerald-500" : "bg-white text-[#050B1A]"}`}>
                      {on ? <Check size={14} strokeWidth={3} aria-hidden /> : <Plus size={14} strokeWidth={3} aria-hidden />}
                      <span className="sr-only">{T.add[lang]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
