"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { writeSelection } from "@/lib/website/domain-hosting-selection";
import { fill, homeCopy, homeV2 } from "@/lib/website/home-funnel";
import { pricing, type Cadence } from "@/lib/website/pricing";
import { TAKBOT_PACKS } from "@/lib/takbot/catalog";
import { Link } from "@/lib/website/nav";
import { sectionId } from "./HomeSectionNav";
import { Eyebrow, Rise, Section, TwoTone } from "./primitives";

type TabKey = "hosting" | "websites" | "marketing" | "credits";

interface Card {
  key: string;
  name: string;
  amount: number;
  cadence: Cadence;
  suffix?: string;
  lines: readonly string[];
  featured?: boolean;
  action: { kind: "checkout"; plan: string } | { kind: "link"; to: string };
  label: string;
}

/** Real catalog prices on a light page, each card one click from checkout or sign-up. */
export function PricingTabs() {
  const { tk, lang } = useCopy();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("hosting");
  const t = homeCopy.pricing;
  const locale = lang === "fr" ? "fr-CA" : "en-CA";

  const cards: Card[] =
    tab === "hosting"
      ? pricing.hosting.map((h) => ({
          key: h.key,
          name: h.name,
          amount: h.amount,
          cadence: h.cadence,
          lines: [h.description, ...h.features],
          featured: h.key === "silver",
          action: { kind: "checkout", plan: h.key },
          label: fill(t.choose[lang], { name: h.name }),
        }))
      : tab === "websites"
        ? pricing.websites.map((w) => ({
            key: w.key,
            name: w.name,
            amount: w.amount,
            cadence: w.cadence,
            lines: [w.description],
            featured: w.key === "business",
            action: { kind: "link", to: "/register?plan=website" },
            label: fill(t.start[lang], { name: w.name }),
          }))
        : tab === "marketing"
          ? pricing.marketing.map((m) => ({
              key: m.key,
              name: m.name,
              amount: m.amount,
              cadence: m.cadence,
              suffix: "suffix" in m ? m.suffix : undefined,
              lines: [],
              featured: m.key === "monthly",
              action: { kind: "link", to: "/register?plan=marketing" },
              label: fill(t.start[lang], { name: m.name }),
            }))
          : TAKBOT_PACKS.map((p) => ({
              key: p.key,
              name: p.label,
              amount: p.priceCad,
              cadence: "one-time" as Cadence,
              lines: [
                fill(t.credits[lang], { n: p.credits.toLocaleString(locale) }),
                fill(t.perCredit[lang], { price: money(lang, Math.round((p.priceCad / p.credits) * 1000) / 1000) }),
              ],
              featured: p.key === "growth",
              action: { kind: "link", to: "/takbot#credits" },
              label: fill(t.start[lang], { name: p.label }),
            }));

  const choose = (card: Card) => {
    if (card.action.kind !== "checkout") return;
    writeSelection({ hostingPlan: card.action.plan });
    router.push("/checkout");
  };

  const tabs = Object.keys(t.tabs) as TabKey[];

  return (
    <Section id={sectionId("pricing")} labelledBy="home-pricing-title" className="hp-alt py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <Rise className="max-w-2xl">
            <Eyebrow>{homeV2.pricing.eyebrow[lang]}</Eyebrow>
            <TwoTone id="home-pricing-title" lead={homeV2.pricing.lead[lang]} rest={homeV2.pricing.rest[lang]} />
          </Rise>
          <div role="tablist" aria-label={homeV2.pricing.eyebrow[lang]} className="inline-flex w-fit rounded-full bg-[var(--hp-line)] p-1">
            {tabs.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                id={`home-pricing-tab-${k}`}
                aria-selected={tab === k}
                aria-controls="home-pricing-panel"
                onClick={() => setTab(k)}
                className={`rounded-full px-4 py-2 text-[13.5px] font-semibold transition-all ${
                  tab === k ? "hp-raised hp-ink" : "hp-ink-2 hover:text-[var(--hp-ink)]"
                }`}
              >
                {t.tabs[k][lang]}
              </button>
            ))}
          </div>
        </div>

        <ul
          id="home-pricing-panel"
          role="tabpanel"
          aria-labelledby={`home-pricing-tab-${tab}`}
          key={tab}
          className={`mt-12 grid gap-4 sm:grid-cols-2 ${cards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
        >
          {cards.map((card, i) => {
            const dark = card.featured;
            const btn = `inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-semibold transition-all ${
              dark ? "hp-cta" : "hp-btn"
            }`;
            return (
              <li key={card.key} className="tk-stagger" style={{ animationDelay: `${i * 70}ms` }}>
                <div
                  className={`relative flex h-full flex-col rounded-[26px] p-7 transition-all duration-500 hover:-translate-y-1 ${
                    dark ? "hp-raised hp-ink ring-2 ring-[var(--hp-cta)]" : "hp-raised hp-ink"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-semibold">{card.name}</p>
                    {dark && <span className="rounded-full bg-[var(--hp-cta)] px-2.5 py-0.5 text-[11px] font-semibold text-white">{t.popular[lang]}</span>}
                  </div>
                  <p className="mt-6 flex items-baseline gap-1">
                    <span className="hp-display text-[44px] leading-none">{money(lang, card.amount)}</span>
                    <span className="hp-ink-2 text-[14px]">{cadenceSuffix(tk, card.cadence)}</span>
                  </p>
                  {card.suffix && <p className="hp-ink-3 mt-1 text-[12px]">{card.suffix}</p>}
                  <ul className="hp-line hp-ink-2 mt-6 grid gap-2.5 border-t pt-6 text-[14px]">
                    {card.lines.map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check size={15} className="hp-accent mt-0.5 shrink-0" strokeWidth={2.5} aria-hidden /> {line}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-8">
                    {card.action.kind === "checkout" ? (
                      <button type="button" onClick={() => choose(card)} className={btn}>
                        {card.label} <ArrowRight size={15} aria-hidden />
                      </button>
                    ) : (
                      <Link to={card.action.to} className={btn}>
                        {card.label} <ArrowRight size={15} aria-hidden />
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="hp-line mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-center sm:flex-row sm:text-left">
          <p className="hp-ink-3 text-[13px]">{tab === "credits" ? t.draftCredits[lang] : tk("cat.price.note")}</p>
          <Link to="/pricing" className="hp-accent inline-flex items-center gap-1.5 text-[14px] font-semibold hover:underline">
            {t.all[lang]} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </Section>
  );
}
