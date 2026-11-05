"use client";

import { ArrowRight, Tag } from "lucide-react";

import { useCopy } from "@/components/website/premium/ui";
import { PROMO_CODE, PROMO_PERCENT } from "@/lib/website/promotions";
import { Link } from "@/lib/website/nav";
import type { Campaign } from "./Campaign";
import { DealAlert } from "./NewsletterSignup";

const COPY = {
  title: { fr: "Offres du moment", en: "Current offers" },
  lead: {
    fr: "Seulement les offres qui existent vraiment aujourd’hui. Le rabais est calculé par nos serveurs à la commande.",
    en: "Only the offers that really exist today. The discount is calculated by our servers when you order.",
  },
  first: {
    name: { fr: "Premier service", en: "First service" },
    body: {
      fr: "{p} % de rabais sur votre premier service TAKATAK, une fois par compte.",
      en: "{p}% off your first TAKATAK service, once per account.",
    },
    cta: { fr: "Commander avec le rabais", en: "Order with the discount" },
  },
  campaign: {
    body: { fr: "{p} % de rabais avec le code {code}, jusqu’au {date}.", en: "{p}% off with code {code}, until {date}." },
    cta: { fr: "Voir l’offre", en: "See the offer" },
  },
  none: {
    fr: "Aucune offre saisonnière en ce moment. Recevez la prochaine en premier :",
    en: "No seasonal offer right now. Get the next one first:",
  },
  code: { fr: "Code", en: "Code" },
} as const;

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** /deals: the always-on first-service offer and the seasonal campaigns live right now (server catalog). */
export function DealsBoard({ campaigns }: { campaigns: Campaign[] }) {
  const { lang } = useCopy();
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeZone: "America/Montreal" });

  return (
    <section className="hp-bg">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:py-20">
        <div className="text-center">
          <Tag className="hp-accent mx-auto" aria-hidden />
          <h1 className="hp-display hp-ink mt-4 text-[40px] sm:text-[52px]">{COPY.title[lang]}</h1>
          <p className="hp-ink-2 mx-auto mt-3 max-w-2xl text-[17px] leading-8">{COPY.lead[lang]}</p>
        </div>

        <ul className="mt-12 grid gap-4 md:grid-cols-2">
          <li className="hp-card flex flex-col rounded-3xl p-6">
            <p className="hp-accent text-[14px] font-semibold">{COPY.first.name[lang]}</p>
            <p className="hp-display hp-ink mt-2 text-[44px] leading-none">−{PROMO_PERCENT} %</p>
            <p className="hp-ink-2 mt-3 text-[15.5px] leading-7">{fill(COPY.first.body[lang], { p: PROMO_PERCENT })}</p>
            <p className="hp-ink-2 mt-1 text-[14px]">
              {COPY.code[lang]} <span className="hp-ink font-semibold">{PROMO_CODE}</span>
            </p>
            <Link
              to={`/commander?promo=${encodeURIComponent(PROMO_CODE)}`}
              className="hp-cta hp-focus mt-6 inline-flex items-center gap-2 self-start rounded-full px-6 py-3 text-[15px] font-semibold"
            >
              {COPY.first.cta[lang]} <ArrowRight size={16} aria-hidden />
            </Link>
          </li>
          {campaigns.map((c) => (
            <li key={c.code} className="hp-card flex flex-col rounded-3xl p-6">
              <p className="hp-accent text-[14px] font-semibold">{c.title?.[lang] ?? c.code}</p>
              <p className="hp-display hp-ink mt-2 text-[44px] leading-none">−{c.percentOff} %</p>
              <p className="hp-ink-2 mt-3 text-[15.5px] leading-7">
                {fill(COPY.campaign.body[lang], { p: c.percentOff, code: c.code, date: date(c.endsAt) })}
              </p>
              <Link
                to={`/offres/${encodeURIComponent(c.code)}`}
                className="hp-btn hp-focus mt-6 inline-flex items-center gap-2 self-start rounded-full px-6 py-3 text-[15px] font-semibold"
              >
                {COPY.campaign.cta[lang]} <ArrowRight size={16} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>

        {campaigns.length === 0 ? (
          <div className="mx-auto mt-10 max-w-xl text-center">
            <p className="hp-ink-2 text-[15.5px]">{COPY.none[lang]}</p>
            <DealAlert sourcePage="/deals" className="mt-4" />
          </div>
        ) : null}
      </div>
    </section>
  );
}
