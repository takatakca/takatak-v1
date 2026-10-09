"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, Check, Clock3, Headset, MessageSquareText } from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import { openLiveChat } from "@/lib/website/chat-provider";
import {
  SOCIAL_ANNUAL_SAVINGS_PERCENT,
  SOCIAL_SOFTWARE_PLANS,
  SOCIAL_X_ADDON_MONTHLY,
  type CategoryCta,
  type CoreCategory,
  type PriceTier,
} from "@/lib/website/core-categories";
import { Link } from "@/lib/website/nav";
import { CtaButton, SegmentedTabs, cadenceSuffix, money, useCopy } from "./ui";

type CtaProps = { onDomainSearch?: () => void; page?: string };

function TierCard({
  tier,
  cta,
  ctaProps,
  amountOverride,
  cadenceNote,
}: {
  tier: PriceTier;
  cta: CategoryCta;
  ctaProps: CtaProps;
  amountOverride?: number;
  cadenceNote?: string;
}) {
  const { tk, lang } = useCopy();
  const amount = amountOverride ?? tier.amount;
  return (
    <div
      className={`tk-glass tk-lift relative flex h-full flex-col rounded-[22px] p-6 ${
        tier.featured ? "tk-accent-ring bg-[color-mix(in_oklab,var(--tk-accent)_10%,transparent)]" : ""
      }`}
    >
      {tier.featured && (
        <span className="tk-accent-bg absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white">
          {tk("cat.price.recommended")}
        </span>
      )}
      <h3 className="text-[15px] font-bold text-white">{tk(tier.nameKey)}</h3>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1">
        <span className="text-4xl font-extrabold tracking-tight text-white">{money(lang, amount)}</span>
        <span className="text-sm text-white/55">
          {cadenceNote ?? cadenceSuffix(tk, tier.cadence)}
          {tier.suffixKey ? ` ${tk(tier.suffixKey)}` : ""}
        </span>
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/40">CAD</p>
      <ul className="mb-7 mt-5 grid gap-2.5">
        {tier.detailKeys.map((d) => (
          <li key={d} className="flex items-start gap-2.5 text-sm text-white/80">
            <Check size={15} strokeWidth={3} className="tk-accent-text mt-0.5 shrink-0" aria-hidden />
            {tk(d)}
          </li>
        ))}
      </ul>
      <CtaButton
        cta={{ ...cta, labelKey: cta.action === "chat" ? cta.labelKey : "cat.price.choose" }}
        variant={tier.featured ? "primary" : "ghost"}
        className="mt-auto w-full"
        {...ctaProps}
      />
    </div>
  );
}

function TierGrid({ tiers, cta, ctaProps }: { tiers: readonly PriceTier[]; cta: CategoryCta; ctaProps: CtaProps }) {
  const cols = tiers.length >= 4 ? "lg:grid-cols-4" : tiers.length === 3 ? "lg:grid-cols-3" : "md:grid-cols-2 lg:max-w-4xl";
  return (
    <div className={`grid gap-5 pt-3 sm:grid-cols-2 ${cols}`}>
      {tiers.map((tier, i) => (
        <Reveal key={tier.nameKey} delay={i * 80}>
          <TierCard tier={tier} cta={cta} ctaProps={ctaProps} />
        </Reveal>
      ))}
    </div>
  );
}

function Panel({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div className="tk-glass relative overflow-hidden rounded-[26px] p-7 sm:p-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklab, var(--tk-accent) 45%, transparent), transparent)" }}
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex max-w-2xl items-start gap-4">
          <span aria-hidden className="tk-accent-bg grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white">
            {icon}
          </span>
          <div>
            <h3 className="text-2xl font-extrabold text-white">{title}</h3>
            <p className="mt-2 text-[15px] leading-7 text-white/68">{body}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">{children}</div>
      </div>
    </div>
  );
}

/** Pricing for one category, only from the code catalogs (see core-categories.ts). */
export function CategoryPricing({ category, ...ctaProps }: { category: CoreCategory } & CtaProps) {
  const { tk, lang } = useCopy();
  const [mode, setMode] = useState<"software" | "managed">("software");
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const pricing = category.pricing;

  if (pricing.kind === "tiers") {
    return (
      <>
        <TierGrid tiers={pricing.tiers} cta={category.primary} ctaProps={ctaProps} />
        <p className="mt-6 text-xs text-white/45">{tk("cat.price.note")}</p>
      </>
    );
  }

  if (pricing.kind === "social") {
    return (
      <>
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <SegmentedTabs
            idBase="social-pricing"
            label={tk("cat.page.pricing")}
            value={mode}
            onChange={(v) => setMode(v as "software" | "managed")}
            items={[
              { id: "software", label: tk("cat.price.software") },
              { id: "managed", label: tk("cat.price.managed") },
            ]}
          />
          {mode === "software" && (
            <SegmentedTabs
              idBase="social-cycle"
              label={tk("cat.price.monthly")}
              value={cycle}
              onChange={(v) => setCycle(v as "monthly" | "annual")}
              items={[
                { id: "monthly", label: tk("cat.price.monthly") },
                { id: "annual", label: tk("cat.price.annual", { pct: SOCIAL_ANNUAL_SAVINGS_PERCENT }) },
              ]}
            />
          )}
        </div>
        <div id="social-pricing-panel" role="tabpanel" aria-labelledby={`social-pricing-tab-${mode}`}>
          {mode === "software" ? (
            <div className="grid gap-5 pt-3 sm:grid-cols-2 lg:grid-cols-3">
              {pricing.software.map((tier, i) => {
                const entry = SOCIAL_SOFTWARE_PLANS[i].entry;
                const annual = Math.round(entry.displayAnnualMonthlyCad * 100) / 100;
                return (
                  <Reveal key={tier.nameKey} delay={i * 80}>
                    <TierCard
                      tier={tier}
                      cta={category.primary}
                      ctaProps={ctaProps}
                      amountOverride={cycle === "annual" ? annual : undefined}
                      cadenceNote={cycle === "annual" ? tk("cat.price.billedAnnually") : undefined}
                    />
                  </Reveal>
                );
              })}
            </div>
          ) : (
            <TierGrid tiers={pricing.managed} cta={{ labelKey: "cat.price.quoteCta", to: "/marketplace/post-project" }} ctaProps={ctaProps} />
          )}
        </div>
        <div className="mt-8 grid gap-2 text-sm text-white/60">
          {mode === "software" && (
            <>
              <p>{tk("cat.price.xAddon", { price: money(lang, SOCIAL_X_ADDON_MONTHLY) })}</p>
              <p>
                {tk("cat.price.moreBrands")}{" "}
                <Link to={category.secondary.to} className="font-semibold text-white underline-offset-4 hover:underline">
                  {tk("cat.social.cta2")} <ArrowRight size={13} className="inline" aria-hidden />
                </Link>
              </p>
            </>
          )}
          <p className="text-xs text-white/45">{tk("cat.price.note")}</p>
        </div>
      </>
    );
  }

  if (pricing.kind === "quote") {
    return (
      <div className="grid gap-10">
        <Panel icon={<MessageSquareText size={22} />} title={tk("cat.price.quoteTitle")} body={tk("cat.price.quoteBody")}>
          <CtaButton cta={{ labelKey: "cat.price.quoteCta", to: "/marketplace/post-project" }} {...ctaProps} />
          <CtaButton cta={{ labelKey: "cat.common.talk", to: "", action: "chat" }} variant="ghost" {...ctaProps} />
        </Panel>
        {pricing.related && (
          <div>
            <h3 className="mb-6 text-xl font-bold text-white">{tk("cat.price.related")}</h3>
            <TierGrid tiers={pricing.related} cta={{ labelKey: "cat.price.quoteCta", to: "/marketplace/post-project" }} ctaProps={ctaProps} />
            <p className="mt-6 text-xs text-white/45">{tk("cat.price.note")}</p>
          </div>
        )}
      </div>
    );
  }

  // Planned: no price until launch.
  return (
    <Panel icon={<Clock3 size={22} />} title={tk("cat.price.plannedTitle")} body={tk("cat.price.plannedBody")}>
      <CtaButton cta={category.primary} {...ctaProps} />
      <button
        type="button"
        onClick={() => openLiveChat({ page: category.route, intent: "voip_waitlist", lang })}
        className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold"
      >
        <Headset size={16} aria-hidden /> {tk(category.secondary.labelKey)}
      </button>
    </Panel>
  );
}
