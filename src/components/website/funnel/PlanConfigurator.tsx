"use client";

import Image from "next/image";
import { ArrowRight, Check, Headset } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { CORE_CATEGORIES, type CoreCategory } from "@/lib/website/core-categories";
import { BUSINESS_TYPES, GOALS, fill, homeCopy, homeV2 } from "@/lib/website/home-funnel";
import { SERVICE_MEDIA } from "@/lib/website/home-media";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { WelcomeSaving } from "./Campaign";
import { sectionId } from "./HomeSectionNav";
import { Eyebrow, Rise, Section, Ticker, TwoTone } from "./primitives";

function linePrice(c: CoreCategory, tk: (k: string) => string, lang: "en" | "fr"): string {
  if (c.from === "quote") return tk("cat.onQuote");
  if (c.from === "planned") return tk("cat.planned");
  return `${money(lang, c.from.amount)}${cadenceSuffix(tk, c.from.cadence)}`;
}

/** Services on the left, a live receipt on the right: the plan is the sign-up. */
export function PlanConfigurator() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const fmt = (n: number) => money(lang, Math.round(n * 100) / 100);

  const applyPreset = (key: string) => {
    const base = BUSINESS_TYPES.find((b) => b.key === key)?.base ?? [];
    plan.set([...base]);
  };
  const activePreset = BUSINESS_TYPES.find((b) => b.base.length === plan.keys.length && b.base.every((k) => plan.has(k)))?.key;

  const totals = plan.totals;
  const rows = [
    { label: homeCopy.plan.monthly[lang], value: totals.monthly },
    { label: homeCopy.plan.yearly[lang], value: totals.yearly },
    { label: homeCopy.plan.oneTime[lang], value: totals.oneTime },
  ];

  return (
    <Section id={sectionId("plan")} labelledBy="home-plan-title" className="hp-bg py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4">
        <Rise className="max-w-3xl">
          <Eyebrow>{homeV2.plan.eyebrow[lang]}</Eyebrow>
          <TwoTone id="home-plan-title" lead={homeV2.plan.lead[lang]} rest={homeV2.plan.rest[lang]} />
        </Rise>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
          <div className="min-w-0">
            <p className="hp-ink-3 text-[13px] font-semibold">{homeV2.plan.presets[lang]}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {BUSINESS_TYPES.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  aria-pressed={activePreset === b.key}
                  onClick={() => applyPreset(b.key)}
                  className={`rounded-full px-4 py-2 text-[14px] font-medium transition-all ${
                    activePreset === b.key ? "hp-btn" : "hp-card hp-ink hover:shadow-[var(--hp-shadow)]"
                  }`}
                >
                  {b.label[lang]}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
              {GOALS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => plan.set(Array.from(new Set([...plan.keys, ...g.adds])))}
                  className="hp-accent text-[13.5px] font-medium underline-offset-4 hover:underline"
                >
                  + {g.label[lang]}
                </button>
              ))}
            </div>

            <ul className="hp-divide hp-line mt-8 border-y">
              {CORE_CATEGORIES.map((c) => {
                const on = plan.has(c.key);
                const media = SERVICE_MEDIA[c.key];
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      onClick={() => plan.toggle(c.key)}
                      className="group flex w-full items-center gap-4 py-4 text-left"
                    >
                      <span className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-xl transition-all duration-300 ${on ? "opacity-100 ring-2 ring-[var(--hp-cta)]" : "opacity-60 grayscale"}`}>
                        <Image src={media.photo} alt="" fill sizes="44px" className="object-cover" style={{ objectPosition: media.focus, transform: `scale(${media.zoom})` }} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-[16px] font-semibold transition-colors ${on ? "hp-ink" : "hp-ink-2"}`}>{tk(`cat.${c.key}.name`)}</span>
                        <span className="hp-ink-3 block truncate text-[13px]">{tk(`cat.${c.key}.h1`)}</span>
                      </span>
                      <span className="hp-ink-2 hidden text-[13.5px] tabular-nums sm:block">{linePrice(c, tk, lang)}</span>
                      <span
                        aria-hidden
                        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${on ? "bg-[var(--hp-cta)]" : "hp-switch-off"}`}
                      >
                        <span
                          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ease-[cubic-bezier(.2,.8,.2,1)] ${on ? "left-6" : "left-1"}`}
                        />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Receipt */}
          <div className="lg:sticky lg:top-[calc(var(--tk-header-h,64px)+76px)] lg:self-start">
            <div className="hp-card hp-ink relative overflow-hidden rounded-[28px] p-7">
              <div className="flex items-baseline justify-between">
                <p className="hp-display text-[24px]">{homeV2.plan.receipt[lang]}</p>
                <p className="text-[12px] font-medium hp-ink-3">TAKATAK · CAD</p>
              </div>

              {plan.categories.length ? (
                <ul className="hp-line mt-5 grid gap-2.5 border-b border-dashed pb-5">
                  {plan.categories.map((c) => (
                    <li key={c.key} className="tk-stagger flex items-center justify-between gap-3 text-[14px]">
                      <span className="flex items-center gap-2 font-medium">
                        <Check size={14} className="hp-accent" strokeWidth={3} aria-hidden />
                        {tk(`cat.${c.key}.name`)}
                      </span>
                      <span className="tabular-nums hp-ink-2">{linePrice(c, tk, lang)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="hp-line hp-ink-2 mt-5 border-b border-dashed pb-5 text-[14px]">{homeV2.plan.empty[lang]}</p>
              )}

              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.2em] hp-ink-3">{homeV2.plan.lines[lang]}</p>
              <dl className="mt-3 grid gap-2">
                {rows.filter((r) => r.value > 0).map((r) => (
                  <div key={r.label} className="tk-stagger flex items-baseline justify-between gap-4">
                    <dt className="text-[14px] hp-ink-2">{r.label}</dt>
                    <dd className="hp-display text-[32px]">
                      <Ticker value={r.value} format={fmt} />
                    </dd>
                  </div>
                ))}
                {!rows.some((r) => r.value > 0) && !totals.quoted && (
                  <div className="flex items-baseline justify-between gap-4 opacity-35">
                    <dt className="text-[14px] hp-ink-2">{homeCopy.plan.monthly[lang]}</dt>
                    <dd className="hp-display text-[32px]">{fmt(0)}</dd>
                  </div>
                )}
                {totals.quoted > 0 && (
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-[14px] hp-ink-2">{fill(homeCopy.plan.quoted[lang], { n: totals.quoted })}</dt>
                    <dd className="text-[14px] font-medium hp-ink-2">{homeV2.plan.custom[lang]}</dd>
                  </div>
                )}
              </dl>

              {plan.keys.length > 0 && (
                <div className="mt-5">
                  <WelcomeSaving keys={plan.keys} lang={lang} serviceName={(k) => tk(`cat.${k}.name`)} />
                </div>
              )}
              <div className="mt-7 grid gap-2">
                <Link
                  to={plan.registerHref}
                  aria-disabled={!plan.keys.length}
                  className={`hp-focus inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 text-[15px] font-semibold ${
                    plan.keys.length ? "hp-cta hp-halo" : "hp-ink-3 pointer-events-none bg-[var(--hp-line)]"
                  }`}
                >
                  {homeCopy.plan.cta[lang]} <ArrowRight size={16} aria-hidden />
                </Link>
                <button
                  type="button"
                  onClick={() => openLiveChat({ page: "/", intent: "plan_builder", lang })}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-semibold hp-ink-2 hover:underline"
                >
                  <Headset size={15} aria-hidden /> {homeCopy.plan.chat[lang]}
                </button>
              </div>
              <p className="mt-3 text-[11.5px] leading-5 hp-ink-3">{homeCopy.plan.note[lang]}</p>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
