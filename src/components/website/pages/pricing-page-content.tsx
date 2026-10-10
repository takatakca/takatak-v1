"use client";

import { ArrowRight, Clock3, MessageSquareText } from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import { CategoryIcon, Kicker, NavyBackdrop, accentStyle, cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { CORE_CATEGORIES, SOCIAL_SOFTWARE_PLANS, type CategoryKey } from "@/lib/website/core-categories";
import { Link } from "@/lib/website/nav";
import { usePublicPricing } from "@/lib/website/catalog-pricing-context";
import { type PricingGroup } from "@/lib/website/pricing";

// Core category → pricing group in src/lib/website/pricing.ts.
const GROUP_FOR: Partial<Record<CategoryKey, string>> = {
  website: "websites",
  domains: "domains",
  hosting: "hosting",
  marketing: "marketing",
  social: "social",
  local: "local",
  ai: "ai",
};
const CORE_GROUPS = new Set([...Object.values(GROUP_FOR), "voip"]);

type Row = { key: string; name: string; amount: number; cadence: PricingGroup["tiers"][number]["cadence"]; suffix?: string };

function PriceRows({ rows }: { rows: readonly Row[] }) {
  const { tk, lang } = useCopy();
  return (
    <ul className="mt-5 grid gap-1">
      {rows.map((r) => (
        <li key={r.key} className="flex items-baseline justify-between gap-3 border-b border-white/[0.07] py-2.5 last:border-0">
          <span className="text-sm text-white/75">{r.name}</span>
          <span className="shrink-0 text-sm font-bold text-white">
            {money(lang, r.amount)}
            <span className="text-xs font-medium text-white/50">
              {cadenceSuffix(tk, r.cadence)}
              {r.suffix ? ` ${r.suffix === "+ ad spend" ? tk("suffix.adSpend") : tk("cat.suffix.plus")}` : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** /pricing: every price from the code catalogs, in the order of the TAKATAK core. */
export function PricingPageContent() {
  const { tk } = useCopy();
  const { pricingGroups: groups } = usePublicPricing();
  const groupRows = (key: string): Row[] => {
    const group = groups.find((g) => g.key === key);
    if (!group) return [];
    return group.tiers.map((tier) => ({
      key: tier.key,
      name: tk(`tier.${group.key}.${tier.key}`),
      amount: tier.amount,
      cadence: tier.cadence,
      suffix: tier.suffix,
    }));
  };
  const socialPlans: Row[] = SOCIAL_SOFTWARE_PLANS.map((p) => ({
    key: p.code,
    name: tk(`tier.socialPlan.${p.code}`),
    amount: p.entry.displayMonthlyCad,
    cadence: "monthly",
  }));
  const more = groups.filter((g) => !CORE_GROUPS.has(g.key));

  return (
    <div className="tk-page tk-premium brand-dark">
      <section className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-14 sm:pt-20">
          <Kicker>{tk("home.pt.kicker")}</Kicker>
          <h1 className="tk-gradient-text mt-4 max-w-3xl text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-6xl">
            {tk("home.pt.title")}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">{tk("pricing.intro")}</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20">
        <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CORE_CATEGORIES.map((c, i) => {
            const groupKey = GROUP_FOR[c.key];
            const rows = c.key === "social" ? socialPlans : groupKey ? groupRows(groupKey) : [];
            return (
              <Reveal as="li" key={c.key} delay={(i % 3) * 70}>
                <div style={accentStyle(c)} className="tk-glass tk-lift flex h-full flex-col rounded-[22px] p-6">
                  <div className="flex items-center gap-3">
                    <CategoryIcon category={c} size={40} />
                    <div>
                      <h2 className="text-base font-bold text-white">{tk(`cat.${c.key}.name`)}</h2>
                      <p className="text-xs text-white/50">{tk(`cat.${c.key}.eyebrow`)}</p>
                    </div>
                  </div>
                  {rows.length > 0 ? (
                    <PriceRows rows={rows} />
                  ) : c.from === "planned" ? (
                    <p className="mt-5 inline-flex items-center gap-2 text-sm text-amber-100">
                      <Clock3 size={15} aria-hidden /> {tk("pricing.planned")}
                    </p>
                  ) : (
                    <p className="mt-5 inline-flex items-center gap-2 text-sm text-white/75">
                      <MessageSquareText size={15} className="tk-accent-text" aria-hidden /> {tk("cat.onQuote")}
                    </p>
                  )}
                  {c.key === "social" && groupRows("social").length > 0 && (
                    <>
                      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">{tk("cat.price.managed")}</p>
                      <PriceRows rows={groupRows("social")} />
                    </>
                  )}
                  <Link
                    to={c.route}
                    className="tk-accent-text mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold hover:underline"
                  >
                    {tk("cat.common.explore", { name: tk(`cat.${c.key}.name`) })} <ArrowRight size={14} aria-hidden />
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </ul>

        {more.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-extrabold text-white">{tk("pricing.more")}</h2>
            <ul className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {more.map((g) => (
                <li key={g.key} className="tk-glass flex flex-col rounded-[22px] p-6">
                  <h3 className="text-base font-bold text-white">{tk(`pg.${g.key}.title`)}</h3>
                  <p className="mt-1 text-sm text-white/55">{tk(`pg.${g.key}.blurb`)}</p>
                  <PriceRows rows={groupRows(g.key)} />
                  <Link to={g.href} className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-[var(--tk-cyan)] hover:underline">
                    {tk("pricing.getStarted")} <ArrowRight size={14} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-10 text-sm text-white/50">{tk("cat.price.note")}</p>
      </section>
    </div>
  );
}
