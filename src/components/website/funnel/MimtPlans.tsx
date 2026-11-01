"use client";

import { ArrowUpRight, Check, MessageSquareText, Phone, PhoneCall, PhoneIncoming, Sparkles, Video } from "lucide-react";

import { money } from "@/components/website/premium/ui";
import { MIMT_LINKS, MIMT_PLANS, MIMT_YEARLY_MONTHS_PAID } from "@/lib/website/mimt-plans";
import { externalLinkProps } from "@/lib/website/product-destinations";
import { useLanguage } from "@/lib/website/use-language";
import { openConcierge } from "./OfferRail";
import { Eyebrow, Rise, Section, TwoTone } from "./primitives";

const T = {
  eyebrow: { fr: "MIMT · téléphonie d'affaires", en: "MIMT · business phone" },
  lead: { fr: "Votre numéro d'affaires,", en: "Your business number," },
  rest: { fr: "dans votre poche.", en: "in your pocket." },
  body: {
    fr: "Appels, textos, boîte vocale, standard automatique, réunions vidéo et IA, sur votre cellulaire et votre ordinateur. Fait au Canada, opéré avec TAKATAK.",
    en: "Calls, texts, voicemail, auto attendant, video meetings and AI, on your cell phone and your computer. Made in Canada, run with TAKATAK.",
  },
  month: { fr: "/mois", en: "/mo" },
  line: { fr: "par ligne", en: "per line" },
  minutes: (o: number, i: number) => ({ fr: `${o} min sortantes · ${i} min entrantes`, en: `${o} min outbound · ${i} min inbound` }),
  messages: (n: number) => ({ fr: `${n} textos par mois`, en: `${n} texts per month` }),
  choose: { fr: "Choisir", en: "Choose" },
  popular: { fr: "Pour les équipes", en: "For teams" },
  yearly: { fr: `À l'année : 12 mois pour le prix de ${MIMT_YEARLY_MONTHS_PAID}.`, en: `Yearly: 12 months for the price of ${MIMT_YEARLY_MONTHS_PAID}.` },
  taxes: { fr: "Prix avant taxes ; TPS, TVQ et taxe municipale 9-1-1 en sus.", en: "Prices before taxes; GST, QST and the 9-1-1 municipal tax are extra." },
  where: { fr: "Les forfaits s’achètent sur mimt.ca ; le numéro est activé dès le paiement.", en: "Plans are bought on mimt.ca; the number is activated once payment goes through." },
  ask: { fr: "Quel forfait pour moi ?", en: "Which plan for me?" },
  compare: { fr: "Comparer tous les forfaits", en: "Compare all plans" },
  live: { fr: "Appel entrant · Ventes", en: "Incoming call · Sales" },
  ai: { fr: "IA : « Rappeler demain 10 h »", en: "AI: “Call back tomorrow 10 am”" },
  meet: { fr: "Réunion vidéo · 4 personnes", en: "Video meeting · 4 people" },
} as const;

/** The MIMT business phone plans, with the real prices from the MIMT repository. */
export function MimtPlans() {
  const { lang } = useLanguage();
  return (
    <Section id="home-mimt" labelledBy="home-mimt-title" className="hp-bg relative overflow-hidden py-20 sm:py-28">
      <div className="relative mx-auto max-w-7xl px-4">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <Rise>
            <Eyebrow>{T.eyebrow[lang]}</Eyebrow>
            <TwoTone id="home-mimt-title" lead={T.lead[lang]} rest={T.rest[lang]} size="md" />
            <p className="hp-ink-2 mt-5 max-w-xl text-[17px] leading-8">{T.body[lang]}</p>
          </Rise>
          {/* A phone that is busy working */}
          <Rise delay={120} className="hidden lg:block">
            <div className="relative mx-auto h-[220px] w-[360px]">
              {[
                { Icon: PhoneIncoming, text: T.live[lang], cls: "left-0 top-0", d: "0s" },
                { Icon: Sparkles, text: T.ai[lang], cls: "right-0 top-[78px]", d: "1.2s" },
                { Icon: Video, text: T.meet[lang], cls: "left-6 bottom-0", d: "2.4s" },
              ].map(({ Icon, text, cls, d }) => (
                <span
                  key={text}
                  className={`hp-card hp-ink absolute flex items-center gap-2.5 rounded-2xl px-4 py-3 text-[14px] font-semibold shadow-[0_20px_50px_-24px_rgb(6_13_31/0.45)] ring-1 ring-[var(--hp-line)] ${cls}`}
                  style={{ animation: `tk-float 6s ease-in-out ${d} infinite` }}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--hp-cta)] text-white">
                    <Icon size={15} aria-hidden />
                  </span>
                  {text}
                </span>
              ))}
            </div>
          </Rise>
        </div>

        <ul className="mt-12 grid gap-4 lg:grid-cols-3">
          {MIMT_PLANS.map((p, i) => (
            <Rise key={p.code} as="li" delay={i * 90} className={`hp-glow hp-build relative flex flex-col rounded-[26px] p-6 ${p.featured ? "bg-[#060D1F] text-white shadow-[0_40px_90px_-40px_rgb(30_107_255/0.9)]" : "hp-card ring-1 ring-[var(--hp-line)]"}`}>
              {p.featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--hp-cta)] px-3 py-1 text-[12px] font-semibold text-white">{T.popular[lang]}</span>
              )}
              <p className={`flex items-center gap-2 text-[15px] font-semibold ${p.featured ? "text-white" : "hp-ink"}`}>
                <Phone size={16} aria-hidden /> MIMT {p.name[lang]}
              </p>
              <p className={`mt-1 text-[14px] ${p.featured ? "text-white/70" : "hp-ink-3"}`}>{p.pitch[lang]}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className={`hp-display text-[44px] leading-none ${p.featured ? "text-white" : "hp-ink"}`}>{money(lang, p.monthlyCents / 100)}</span>
                <span className={`text-[14px] ${p.featured ? "text-white/60" : "hp-ink-3"}`}>
                  {T.month[lang]}
                  {p.perLine ? ` · ${T.line[lang]}` : ""}
                </span>
              </p>
              <ul className={`mt-5 grid gap-2 text-[14px] ${p.featured ? "text-white/85" : "hp-ink-2"}`}>
                <li className="flex gap-2">
                  <PhoneCall size={15} className="mt-0.5 shrink-0 text-[var(--hp-cta)]" aria-hidden /> {T.minutes(p.minutes.out, p.minutes.in)[lang]}
                </li>
                <li className="flex gap-2">
                  <MessageSquareText size={15} className="mt-0.5 shrink-0 text-[var(--hp-cta)]" aria-hidden /> {T.messages(p.messages)[lang]}
                </li>
                {p.features.map((f) => (
                  <li key={f.fr} className="flex gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden /> {f[lang]}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                <a
                  href={p.perLine ? MIMT_LINKS.business[lang] : MIMT_LINKS.plans[lang]}
                  {...externalLinkProps}
                  className={`hp-focus inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition-transform hover:scale-[1.02] ${p.featured ? "bg-white text-[#060D1F]" : "hp-cta"}`}
                >
                  {T.choose[lang]} MIMT {p.name[lang]} <ArrowUpRight size={16} aria-hidden />
                </a>
              </div>
            </Rise>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="hp-ink-3 text-[13.5px]">
            {T.yearly[lang]} {T.taxes[lang]} {T.where[lang]}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openConcierge({ first: lang === "fr" ? "Téléphonie MIMT pour mon entreprise" : "MIMT business phone for my company" })} className="hp-ghost hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold">
              <Sparkles size={15} aria-hidden /> {T.ask[lang]}
            </button>
            <a href={MIMT_LINKS.plans[lang]} {...externalLinkProps} className="hp-ink hp-focus inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[14px] font-semibold underline-offset-4 hover:underline">
              {T.compare[lang]} <ArrowUpRight size={15} aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
