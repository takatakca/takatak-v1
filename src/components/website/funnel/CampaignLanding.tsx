"use client";

import { ArrowRight, Check } from "lucide-react";

import { useCopy } from "@/components/website/premium/ui";
import { Link } from "@/lib/website/nav";
import { CampaignCountdown, type Campaign } from "./Campaign";
import { MediaLoop } from "./MediaLoop";
import { Rise } from "./primitives";

const COPY = {
  off: { en: "off your order", fr: "de rabais sur votre commande" },
  lead: {
    en: "Website, hosting, social media, marketing and more, set up by our team in Montréal.",
    fr: "Site web, hébergement, réseaux sociaux, marketing et plus, mis en place par notre équipe à Montréal.",
  },
  cta: { en: "Get the deal", fr: "Profiter de l’offre" },
  how: [
    { en: "Pick your services and tiers", fr: "Choisissez vos services et vos forfaits" },
    { en: "Create your account", fr: "Créez votre compte" },
    { en: "Use the code before the end", fr: "Utilisez le code avant la fin" },
  ],
  terms: {
    en: "Code {code} · ends {date} · off the regular catalog prices · once per account · taxes extra",
    fr: "Code {code} · se termine le {date} · sur les prix réguliers du catalogue · une fois par compte · taxes en sus",
  },
} as const;

/** The landing page of a live, time-limited campaign: offer, real countdown, one button. */
export function CampaignLanding({ campaign }: { campaign: Campaign }) {
  const { lang } = useCopy();
  const end = new Date(campaign.endsAt);
  const date = end.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA", { dateStyle: "long", timeStyle: "short", timeZone: "America/Montreal" });
  const name = campaign.title?.[lang] ?? campaign.code;
  return (
    <section className="hp-bg">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-24">
        <Rise>
          <p className="hp-accent text-[14px] font-semibold">{name}</p>
          <h1 className="hp-display hp-ink mt-3 text-[64px] leading-none sm:text-[96px]">−{campaign.percentOff} %</h1>
          <p className="hp-display hp-ink mt-2 text-[28px] sm:text-[36px]">{COPY.off[lang]}</p>
          <p className="hp-ink-2 mt-5 max-w-lg text-[17px] leading-8">{COPY.lead[lang]}</p>
          <CampaignCountdown campaign={campaign} lang={lang} className="mt-7" />
          <div className="mt-8">
            <Link
              to={`/commander?promo=${encodeURIComponent(campaign.code)}`}
              className="hp-cta hp-halo hp-focus inline-flex items-center gap-2 rounded-full px-9 py-5 text-[18px] font-semibold"
            >
              {COPY.cta[lang]} <ArrowRight size={19} aria-hidden />
            </Link>
          </div>
          <ol className="mt-8 grid gap-2">
            {COPY.how.map((s, i) => (
              <li key={s.en} className="hp-ink flex items-center gap-3 text-[15px]">
                <span className="hp-btn grid h-7 w-7 place-items-center rounded-full text-[12.5px] font-bold">{i + 1}</span>
                {s[lang]}
              </li>
            ))}
          </ol>
          <p className="hp-ink-3 mt-6 flex items-start gap-1.5 text-[12.5px]">
            <Check size={14} className="mt-0.5 shrink-0" aria-hidden />
            {COPY.terms[lang].replace("{code}", campaign.code).replace("{date}", date)}
          </p>
        </Rise>
        <Rise delay={120}>
          <MediaLoop photo="/photos/hero-cafe.webp" alt="" videoKey="domains" sizes="(min-width: 1024px) 600px, 100vw" className="aspect-[4/5] rounded-[32px]" priority />
        </Rise>
      </div>
    </section>
  );
}
