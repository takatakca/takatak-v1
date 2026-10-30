"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, Headset, Plus } from "lucide-react";

import { CategoryIcon, Kicker, accentStyle, money, useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { CORE_CATEGORIES, type CategoryKey } from "@/lib/website/core-categories";
import { BUSINESS_TYPES, GOALS, fill, homeCopy } from "@/lib/website/home-funnel";
import { useHomePlan } from "@/lib/website/home-plan";
import { Link } from "@/lib/website/nav";
import { sectionId } from "./HomeSectionNav";

type Step = 0 | 1 | 2;

/** The plan's starting totals, shared by the builder and the sticky dock. */
export function PlanPrice({ compact = false }: { compact?: boolean }) {
  const { lang } = useCopy();
  const { totals } = useHomePlan();
  const parts = [
    totals.monthly > 0 && { amount: totals.monthly, label: homeCopy.plan.monthly[lang] },
    totals.yearly > 0 && { amount: totals.yearly, label: homeCopy.plan.yearly[lang] },
    totals.oneTime > 0 && { amount: totals.oneTime, label: homeCopy.plan.oneTime[lang] },
  ].filter(Boolean) as { amount: number; label: string }[];
  if (compact) {
    const first = parts[0];
    return first ? (
      <span className="whitespace-nowrap">
        <span className="font-bold text-white">{money(lang, first.amount)}</span> <span className="text-white/55">{first.label}</span>
        {parts.length > 1 && <span className="text-white/55"> +{parts.length - 1}</span>}
      </span>
    ) : totals.quoted ? (
      <span className="text-white/70">{fill(homeCopy.plan.quoted[lang], { n: totals.quoted })}</span>
    ) : null;
  }
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{homeCopy.plan.from[lang]}</p>
      <dl className="mt-2 grid gap-1.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-white/60">{p.label}</dt>
            <dd className="tk-gradient-text text-2xl font-extrabold tabular-nums tracking-tight">{money(lang, p.amount)}</dd>
          </div>
        ))}
        {totals.quoted > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-white/60">{fill(homeCopy.plan.quoted[lang], { n: totals.quoted })}</dt>
            <dd className="text-sm text-white/50">—</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** Two questions, then a plan the visitor can edit and take to /register. */
export function PlanBuilder() {
  const { tk, lang } = useCopy();
  const plan = useHomePlan();
  const [step, setStep] = useState<Step>(0);
  const [business, setBusiness] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>([]);

  const recommend = (biz: string | null, picked: string[]) => {
    const base = BUSINESS_TYPES.find((b) => b.key === biz)?.base ?? [];
    const adds = GOALS.filter((g) => picked.includes(g.key)).flatMap((g) => g.adds);
    plan.set(Array.from(new Set<CategoryKey>([...base, ...adds])));
  };

  const steps = [homeCopy.plan.step1, homeCopy.plan.step2, homeCopy.plan.step3];

  return (
    <section
      id={sectionId("plan")}
      aria-labelledby="home-plan-title"
      className="relative border-t border-white/[0.06] py-16 sm:py-24"
      style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 60px)" }}
    >
      <div aria-hidden className="tk-dot-map pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative mx-auto max-w-7xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Kicker>{homeCopy.plan.kicker[lang]}</Kicker>
          <h2 id="home-plan-title" className="mt-4 text-balance text-3xl font-extrabold leading-[1.08] tracking-[-0.025em] text-white sm:text-[44px]">
            {homeCopy.plan.title[lang]}
          </h2>
          <p className="mt-4 text-base leading-7 text-white/68">{homeCopy.plan.subtitle[lang]}</p>
        </div>

        {/* Stepper */}
        <ol className="mx-auto mt-10 flex max-w-xl items-center justify-between gap-2">
          {steps.map((s, i) => (
            <li key={s.en} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => (i <= step || (i === 1 && business) || (i === 2 && plan.keys.length) ? setStep(i as Step) : undefined)}
                aria-current={i === step ? "step" : undefined}
                className="flex items-center gap-2 text-left"
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold transition-colors ${
                    i < step ? "bg-emerald-400/20 text-emerald-200" : i === step ? "bg-[#1F8BFF] text-white shadow-[0_0_20px_#1F8BFF]" : "bg-white/[0.06] text-white/45"
                  }`}
                >
                  {i < step ? <Check size={14} aria-hidden /> : i + 1}
                </span>
                <span className={`hidden text-[13px] font-semibold sm:inline ${i === step ? "text-white" : "text-white/50"}`}>{s[lang]}</span>
              </button>
              {i < 2 && <span aria-hidden className={`h-px flex-1 ${i < step ? "bg-emerald-300/40" : "bg-white/10"}`} />}
            </li>
          ))}
        </ol>

        <div className="tk-glass mx-auto mt-8 max-w-5xl rounded-[28px] p-5 sm:p-8">
          {step === 0 && (
            <div key="s0" className="tk-slide-in">
              <p className="text-lg font-bold text-white">{homeCopy.plan.q1[lang]}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {BUSINESS_TYPES.map((b) => {
                  const on = business === b.key;
                  return (
                    <button
                      key={b.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        setBusiness(b.key);
                        recommend(b.key, goals);
                        setStep(1);
                      }}
                      className={`group relative overflow-hidden rounded-2xl border text-left transition-all ${
                        on ? "border-[#1F8BFF] shadow-[0_0_0_1px_#1F8BFF,0_20px_40px_-20px_#1F8BFF]" : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <div className="tk-zoom relative aspect-[4/3]">
                        <Image src={b.image} alt="" fill sizes="(min-width: 1024px) 260px, 50vw" className="object-cover" />
                        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(6_13_31/0.92))]" />
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <p className="font-bold text-white">{b.label[lang]}</p>
                        <p className="mt-0.5 text-[13px] text-white/65">{b.hint[lang]}</p>
                      </div>
                      {on && (
                        <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-[#1F8BFF] text-white">
                          <Check size={14} aria-hidden />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div key="s1" className="tk-slide-in">
              <p className="text-lg font-bold text-white">{homeCopy.plan.q2[lang]}</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {GOALS.map((g) => {
                  const on = goals.includes(g.key);
                  return (
                    <button
                      key={g.key}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        const next = on ? goals.filter((x) => x !== g.key) : [...goals, g.key];
                        setGoals(next);
                        recommend(business, next);
                      }}
                      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] font-semibold transition-all ${
                        on ? "border-[#1F8BFF] bg-[#1F8BFF]/20 text-white" : "border-white/15 text-white/75 hover:border-white/35 hover:text-white"
                      }`}
                    >
                      {on ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />}
                      {g.label[lang]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-8 flex items-center justify-between">
                <button type="button" onClick={() => setStep(0)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white">
                  <ArrowLeft size={15} aria-hidden /> {homeCopy.plan.back[lang]}
                </button>
                <button type="button" onClick={() => setStep(2)} className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold">
                  {homeCopy.plan.seePlan[lang]} <ArrowRight size={15} aria-hidden />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div key="s2" className="tk-slide-in grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
              <div>
                <p className="text-lg font-bold text-white">{homeCopy.plan.q3[lang]}</p>
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {CORE_CATEGORIES.map((c) => {
                    const on = plan.has(c.key);
                    return (
                      <li key={c.key} style={accentStyle(c)}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => plan.toggle(c.key)}
                          className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all ${
                            on ? "border-[color-mix(in_oklab,var(--tk-accent)_60%,transparent)] bg-[color-mix(in_oklab,var(--tk-accent)_12%,transparent)]" : "border-white/10 opacity-70 hover:opacity-100"
                          }`}
                        >
                          <CategoryIcon category={c} size={34} />
                          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">{tk(`cat.${c.key}.name`)}</span>
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${on ? "bg-emerald-400/25 text-emerald-200" : "bg-white/[0.06] text-white/50"}`}
                          >
                            {on ? <Check size={13} aria-hidden /> : <Plus size={13} aria-hidden />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" onClick={() => setStep(1)} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white/60 hover:text-white">
                  <ArrowLeft size={15} aria-hidden /> {homeCopy.plan.back[lang]}
                </button>
              </div>

              <aside className="flex flex-col rounded-2xl border border-white/10 bg-[#081430]/80 p-5">
                <PlanPrice />
                <p className="mt-4 text-xs leading-5 text-white/45">{homeCopy.plan.note[lang]}</p>
                <div className="mt-auto grid gap-2 pt-6">
                  {plan.keys.length ? (
                    <Link to={plan.registerHref} className="tk-btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold">
                      {homeCopy.plan.cta[lang]} <ArrowRight size={16} aria-hidden />
                    </Link>
                  ) : (
                    <p className="text-center text-sm text-amber-100/80">{homeCopy.plan.empty[lang]}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => openLiveChat({ page: "/", intent: "plan_builder", lang })}
                    className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white/75 hover:text-white"
                  >
                    <Headset size={15} className="text-[var(--tk-cyan)]" aria-hidden /> {homeCopy.plan.chat[lang]}
                  </button>
                </div>
              </aside>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
