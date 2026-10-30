"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";

import { Kicker, SegmentedTabs, cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { writeSelection } from "@/lib/website/domain-hosting-selection";
import { fill, homeCopy } from "@/lib/website/home-funnel";
import { pricing, type Cadence } from "@/lib/website/pricing";
import { TAKBOT_PACKS } from "@/lib/takbot/catalog";
import { Link } from "@/lib/website/nav";
import { sectionId } from "./HomeSectionNav";

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

/** Real catalog prices in tabs, each card one click from checkout or sign-up. */
export function PricingTabs() {
  const { tk, lang } = useCopy();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("hosting");
  const t = homeCopy.pricing;

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
            action: { kind: "link", to: `/register?plan=website` },
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
              action: { kind: "link", to: `/register?plan=marketing` },
              label: fill(t.start[lang], { name: m.name }),
            }))
          : TAKBOT_PACKS.map((p) => ({
              key: p.key,
              name: p.label,
              amount: p.priceCad,
              cadence: "one-time" as Cadence,
              lines: [fill(t.credits[lang], { n: p.credits.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA") }), fill(t.perCredit[lang], { price: money(lang, Math.round((p.priceCad / p.credits) * 1000) / 1000) })],
              featured: p.key === "growth",
              action: { kind: "link", to: "/takbot#credits" },
              label: fill(t.start[lang], { name: p.label }),
            }));

  const choose = (card: Card) => {
    if (card.action.kind === "checkout") {
      writeSelection({ hostingPlan: card.action.plan });
      router.push("/checkout");
    }
  };

  return (
    <section
      id={sectionId("pricing")}
      aria-labelledby="home-pricing-title"
      className="relative border-t border-white/[0.06] py-16 sm:py-24"
      style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 60px)" }}
    >
      <div className="mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Kicker>{t.kicker[lang]}</Kicker>
          <h2 id="home-pricing-title" className="mt-4 text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.025em] text-white sm:text-[44px]">
            {t.title[lang]}
          </h2>
          <p className="mt-4 text-base leading-7 text-white/68">{t.subtitle[lang]}</p>
          <SegmentedTabs
            className="mt-8"
            items={(Object.keys(t.tabs) as TabKey[]).map((k) => ({ id: k, label: t.tabs[k][lang] }))}
            value={tab}
            onChange={(id) => setTab(id as TabKey)}
            idBase="home-pricing"
            label={t.kicker[lang]}
          />
        </div>

        <ul
          id="home-pricing-panel"
          role="tabpanel"
          aria-labelledby={`home-pricing-tab-${tab}`}
          key={tab}
          className={`mt-10 grid gap-4 sm:grid-cols-2 ${cards.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
        >
          {cards.map((card, i) => (
            <li key={card.key} className="tk-stagger" style={{ animationDelay: `${i * 70}ms` }}>
              <div
                className={`relative flex h-full flex-col rounded-[24px] border p-6 transition-transform duration-300 hover:-translate-y-1 ${
                  card.featured
                    ? "border-[#1F8BFF]/70 bg-[linear-gradient(160deg,rgb(31_139_255/0.22),rgb(11_27_61/0.9)_55%)] shadow-[0_30px_60px_-30px_#1F8BFF]"
                    : "border-white/10 bg-white/[0.035]"
                }`}
              >
                {card.featured && (
                  <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-[#1F8BFF] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                    <Sparkles size={11} aria-hidden /> {t.popular[lang]}
                  </span>
                )}
                <p className="text-[15px] font-bold text-white">{card.name}</p>
                <p className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-white">{money(lang, card.amount)}</span>
                  <span className="text-sm text-white/55">{cadenceSuffix(tk, card.cadence)}</span>
                </p>
                {card.suffix && <p className="mt-1 text-xs text-white/50">{card.suffix}</p>}
                <ul className="mt-5 grid gap-2 text-[13.5px] text-white/75">
                  {card.lines.map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <Check size={14} className="mt-0.5 shrink-0 text-[#29C3FF]" aria-hidden /> {line}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  {card.action.kind === "checkout" ? (
                    <button
                      type="button"
                      onClick={() => choose(card)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${card.featured ? "tk-btn-primary" : "tk-btn-ghost"}`}
                    >
                      {card.label} <ArrowRight size={15} aria-hidden />
                    </button>
                  ) : (
                    <Link
                      to={card.action.to}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${card.featured ? "tk-btn-primary" : "tk-btn-ghost"}`}
                    >
                      {card.label} <ArrowRight size={15} aria-hidden />
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-xs text-white/45">{tab === "credits" ? t.draftCredits[lang] : tk("cat.price.note")}</p>
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#7CC4FF] hover:text-white">
            {t.all[lang]} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
