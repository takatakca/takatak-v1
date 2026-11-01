"use client";

import { useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Check, Sparkles } from "lucide-react";

import { money } from "@/components/website/premium/ui";
import { MIMT_LINKS, MIMT_MORE_PLANS, MIMT_START_PLANS, MIMT_YEARLY_MONTHS_PAID, type MimtPlan } from "@/lib/website/mimt-plans";
import type { HoldPlan } from "@/lib/website/mimt-numbers";
import { externalLinkProps } from "@/lib/website/product-destinations";
import { useLanguage } from "@/lib/website/use-language";
import { sectionId } from "./HomeSectionNav";
import { MimtNumberPicker } from "./MimtNumberPicker";
import { openConcierge } from "./OfferRail";
import { Eyebrow, Rise, Section, TwoTone, useSpotlight } from "./primitives";
import { TelecomScene } from "./TelecomScene";

type Lang = "fr" | "en";

const T = {
  eyebrow: { fr: "Téléphonie TAKATAK · propulsée par MIMT", en: "TAKATAK phone · powered by MIMT" },
  lead: { fr: "Votre entreprise, joignable partout.", en: "Your business, reachable anywhere." },
  rest: { fr: "Appels, textos, vidéo et IA.", en: "Calls, texts, video and AI." },
  body: {
    fr: "Le nouveau système téléphonique de TAKATAK : un vrai numéro local, un standard, la boîte vocale en texte, les réunions vidéo et une réceptionniste IA, sur votre cellulaire et votre ordinateur. Sans matériel, sans contrat. Fait au Canada.",
    en: "TAKATAK's new phone system: a real local number, an auto attendant, voicemail as text, video meetings and an AI receptionist, on your cell phone and your computer. No hardware, no contract. Made in Canada.",
  },
  pickerTitle: { fr: "Trouvez votre numéro maintenant", en: "Find your number now" },
  planFor: { fr: "Forfait de ce numéro", en: "Plan for this number" },
  start: { fr: "Pour commencer", en: "To start" },
  month: { fr: "/mois", en: "/mo" },
  line: { fr: "par ligne", en: "per line" },
  free: { fr: "Commencer à 0 $", en: "Start at $0" },
  choose: { fr: "Choisir mon numéro", en: "Choose my number" },
  popular: { fr: "Pour les équipes", en: "For teams" },
  more: { fr: "Aussi offerts :", en: "Also available:" },
  compare: { fr: "Comparer tous les forfaits", en: "Compare all plans" },
  ask: { fr: "Quel forfait pour moi ?", en: "Which plan for me?" },
  fine: {
    fr: `Prix avant taxes ; TPS, TVQ et taxe municipale 9-1-1 en sus. À l'année : 12 mois pour le prix de ${MIMT_YEARLY_MONTHS_PAID}. Inscription et paiement dans l'app MIMT ; le numéro est activé dès le paiement.`,
    en: `Prices before taxes; GST, QST and the 9-1-1 municipal tax are extra. Yearly: 12 months for the price of ${MIMT_YEARLY_MONTHS_PAID}. Sign-up and payment in the MIMT app; the number is activated once payment goes through.`,
  },
} as const;

const HOLD_PLANS: { plan: HoldPlan; name: Record<Lang, string> }[] = [
  { plan: "lock", name: { fr: "Essentiel", en: "Essential" } },
  { plan: "premium", name: { fr: "Premium", en: "Premium" } },
  { plan: "business", name: { fr: "Affaires", en: "Business" } },
];

function price(lang: Lang, p: MimtPlan) {
  return p.monthlyCents === 0 ? (lang === "fr" ? "0 $" : "$0") : money(lang, p.monthlyCents / 100);
}

/** The phone chapter: the system at work, a live number search, and three ways to start, from $0. */
export function PhoneChapter() {
  const { lang: l } = useLanguage();
  const lang = l as Lang;
  const spot = useSpotlight<HTMLDivElement>();
  const [holdPlan, setHoldPlan] = useState<HoldPlan>("lock");
  const input = useRef<HTMLInputElement>(null);

  const choose = (plan: HoldPlan) => {
    setHoldPlan(plan);
    document.getElementById("home-mimt-picker")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => input.current?.focus({ preventScroll: true }), 500);
  };

  return (
    <div className="hp" data-theme="dark" {...spot}>
      <Section id={sectionId("phone")} labelledBy="home-phone-title" className="tk-grain relative overflow-hidden bg-[#030812] pb-20 pt-16 sm:pb-28 sm:pt-20">
        <div aria-hidden className="hp-tech-grid" />
        <div aria-hidden className="hp-spot-layer" />
        <div aria-hidden className="absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-[#1E6BFF]/20 blur-[120px]" />
        <div className="relative mx-auto max-w-7xl px-4">
          <Rise className="max-w-3xl">
            <Eyebrow>{T.eyebrow[lang]}</Eyebrow>
            <TwoTone id="home-phone-title" lead={T.lead[lang]} rest={T.rest[lang]} size="md" />
            <p className="mt-6 max-w-2xl text-[16.5px] leading-8 text-white/65">{T.body[lang]}</p>
          </Rise>

          <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12 [&>*]:min-w-0">
            <Rise delay={80}>
              <TelecomScene />
            </Rise>
            <Rise delay={160}>
              <div id="home-mimt-picker" className="hp-glow rounded-[28px] bg-[#0B1220]/90 p-5 shadow-[0_50px_120px_-40px_rgb(0_0_0/0.9)] ring-1 ring-white/10 backdrop-blur sm:p-6">
                <p className="hp-display text-[24px] leading-tight text-white">{T.pickerTitle[lang]}</p>
                <div className="mt-4" role="radiogroup" aria-label={T.planFor[lang]}>
                  <p className="text-[12px] text-white/45">{T.planFor[lang]}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {HOLD_PLANS.map((h) => (
                      <button
                        key={h.plan}
                        type="button"
                        role="radio"
                        aria-checked={holdPlan === h.plan}
                        onClick={() => setHoldPlan(h.plan)}
                        className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${holdPlan === h.plan ? "bg-white text-[#060D1F]" : "bg-white/[0.06] text-white/70 hover:text-white"}`}
                      >
                        {h.name[lang]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-5">
                  <MimtNumberPicker ref={input} lang={lang} plan={holdPlan} />
                </div>
              </div>
            </Rise>
          </div>

          {/* Three ways to start, from $0 */}
          <p className="mt-16 text-[11.5px] font-semibold uppercase tracking-[0.18em] text-white/40">{T.start[lang]}</p>
          <ul className="mt-4 grid gap-4 lg:grid-cols-3">
            {MIMT_START_PLANS.map((p, i) => (
              <Rise key={p.code} as="li" delay={i * 90} className={`hp-glow hp-build relative flex flex-col rounded-[26px] p-6 ${p.featured ? "bg-white text-[#060D1F] shadow-[0_40px_90px_-40px_rgb(41_195_255/0.8)]" : "bg-white/[0.04] text-white ring-1 ring-white/10"}`}>
                {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-[#1E6BFF] px-3 py-1 text-[12px] font-semibold text-white">{T.popular[lang]}</span>}
                <p className="text-[15px] font-semibold">MIMT {p.name[lang]}</p>
                <p className={`mt-1 text-[14px] ${p.featured ? "text-[#2A3142]" : "text-white/60"}`}>{p.pitch[lang]}</p>
                <p className="mt-5 flex items-baseline gap-1.5">
                  <span className="hp-display text-[46px] leading-none">{price(lang, p)}</span>
                  {p.monthlyCents > 0 && (
                    <span className={`text-[14px] ${p.featured ? "text-[#4F586C]" : "text-white/55"}`}>
                      {T.month[lang]}
                      {p.perLine ? ` · ${T.line[lang]}` : ""}
                    </span>
                  )}
                </p>
                <ul className={`mt-5 grid gap-2 text-[14px] ${p.featured ? "text-[#2A3142]" : "text-white/80"}`}>
                  {[...p.caps, ...p.features].map((f) => (
                    <li key={f.fr} className="flex gap-2">
                      <Check size={15} className={`mt-0.5 shrink-0 ${p.featured ? "text-[#1E6BFF]" : "text-[#29C3FF]"}`} aria-hidden /> {f[lang]}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-6">
                  {p.code === "free" ? (
                    <a
                      href={MIMT_LINKS.signup[lang]}
                      {...externalLinkProps}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-[15px] font-semibold text-[#060D1F] transition-transform hover:scale-[1.02]"
                    >
                      {T.free[lang]} <ArrowUpRight size={16} aria-hidden />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => choose(p.code === "business" ? "business" : "lock")}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition-transform hover:scale-[1.02] ${p.featured ? "bg-[#060D1F] text-white" : "bg-[#1E6BFF] text-white"}`}
                    >
                      {T.choose[lang]} <ArrowRight size={16} aria-hidden />
                    </button>
                  )}
                </div>
              </Rise>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className="text-[14px] text-white/70">
              {T.more[lang]}{" "}
              {MIMT_MORE_PLANS.map((p, i) => (
                <span key={p.code}>
                  {i > 0 && " · "}
                  <strong className="text-white">MIMT {p.name[lang]}</strong> {price(lang, p)}
                  {p.perLine ? (lang === "fr" ? " / ligne" : " / line") : lang === "fr" ? " / mois" : " / mo"}
                </span>
              ))}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openConcierge({ first: lang === "fr" ? "Téléphonie pour mon entreprise" : "Phone system for my business" })}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-[14px] font-semibold text-white ring-1 ring-white/15 hover:bg-white/15"
              >
                <Sparkles size={15} aria-hidden /> {T.ask[lang]}
              </button>
              <a href={MIMT_LINKS.plans[lang]} {...externalLinkProps} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline">
                {T.compare[lang]} <ArrowUpRight size={15} aria-hidden />
              </a>
            </div>
          </div>
          <p className="mt-4 max-w-4xl text-[12.5px] leading-6 text-white/45">{T.fine[lang]}</p>
        </div>
      </Section>
    </div>
  );
}
