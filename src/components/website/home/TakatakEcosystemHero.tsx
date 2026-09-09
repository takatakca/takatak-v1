"use client";

import { useState } from "react";
import { Link } from "@/lib/website/nav";
import { ArrowRight, Headset, ShieldCheck, UserCheck, Languages, Lock, Sparkles, Compass } from "lucide-react";
import { AiServiceSearch } from "./AiServiceSearch";
import { HeroFlagshipScene } from "./hero/HeroFlagshipScene";
import { HeroBackdrop } from "./hero/HeroBackdrop";
import { SectionTransition } from "@/components/website/motion/SectionTransition";
import { PointerGlow } from "@/components/website/motion/PointerGlow";
import { openLiveChat } from "@/lib/website/chat-provider";
import { useLanguage } from "@/lib/website/use-language";
import { pricing } from "@/lib/website/pricing";

const TRUST = [
  { icon: ShieldCheck, label: { en: "Managed delivery", fr: "Livraison encadrée" } },
  { icon: UserCheck, label: { en: "Human review", fr: "Révision humaine" } },
  { icon: Languages, label: { en: "Bilingual support", fr: "Soutien bilingue" } },
  { icon: Lock, label: { en: "Secure workspace", fr: "Espace de travail sécurisé" } },
] as const;

/** Signature TAKATAK hero: sales zone on the left, connected business system on the right. */
export function TakatakEcosystemHero() {
  const { tx, lang } = useLanguage();
  const [explore, setExplore] = useState(false);

  const money = (n: number) =>
    lang === "fr"
      ? `${n.toFixed(n % 1 ? 2 : 0).replace(".", ",")} $`
      : `$${n.toFixed(n % 1 ? 2 : 0)}`;

  const priceSignals = [
    { to: "/services/websites", label: { en: `Websites from ${money(pricing.websites[0].amount)}`, fr: `Sites web à partir de ${money(pricing.websites[0].amount)}` } },
    { to: "/hosting", label: { en: `Hosting from ${money(pricing.hosting[0].amount)}/month`, fr: `Hébergement à partir de ${money(pricing.hosting[0].amount)}/mois` } },
    { to: "/domain", label: { en: `Domains from ${money(pricing.domain.register.amount)}/year`, fr: `Domaines à partir de ${money(pricing.domain.register.amount)}/année` } },
  ];

  return (
    <section id="tk-hero" className="brand-dark relative overflow-hidden border-b border-border">
      <SectionTransition direction="to-dark" className="absolute inset-x-0 top-0" />
      <HeroBackdrop />

      <PointerGlow className="relative">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-10 px-4 py-14 md:py-20 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)] lg:gap-8 xl:gap-12">
          {/* Sales zone */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/85 backdrop-blur">
              <Sparkles size={12} className="text-primary" aria-hidden />
              {tx({ en: "The digital system behind your business", fr: "Le système numérique derrière votre entreprise" })}
            </span>

            <h1 className="mt-5 text-[32px] font-semibold leading-[1.04] tracking-[-0.02em] text-foreground sm:text-[42px] lg:text-[52px] xl:text-[58px]">
              <span className="block text-foreground/85">
                {tx({ en: "Bring your business to the", fr: "Amenez votre entreprise au" })}
              </span>
              <span className="relative mt-1 block font-black tracking-[-0.035em] text-foreground">
                {tx({ en: "TAKATAK level.", fr: "niveau TAKATAK." })}
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-[3px] w-[42%] rounded-full bg-[linear-gradient(90deg,var(--primary),transparent)]"
                />
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-7 text-muted-foreground md:text-base">
              {tx({
                en: "Websites, domains, hosting, visibility, leads, communications and automation — connected around your business and managed by our team.",
                fr: "Sites web, domaines, hébergement, visibilité, clients potentiels, communications et automatisation — connectés autour de votre entreprise et gérés par notre équipe.",
              })}
            </p>

            <div className="tk-hero-console mt-7 rounded-2xl border border-white/12 bg-white/10 p-3 backdrop-blur-md sm:p-4">
              <p className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span>{tx({ en: "Describe what your business needs", fr: "Décrivez ce dont votre entreprise a besoin" })}</span>
                <kbd className="hidden rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] tracking-normal text-foreground/70 sm:inline">
                  ↵
                </kbd>
              </p>
              <AiServiceSearch />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/marketplace/post-project"
                className="tk-glow-cta inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[0_20px_48px_-22px_color-mix(in_oklab,var(--primary)_85%,transparent)] transition-opacity hover:opacity-90"
              >
                {tx({ en: "Start my TAKATAK setup", fr: "Démarrer ma configuration TAKATAK" })} <ArrowRight size={15} aria-hidden />
              </Link>
              <Link
                to="/marketplace"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:border-white/35 hover:bg-white/[0.06]"
              >
                {tx({ en: "Browse the marketplace", fr: "Explorer la place de marché" })}
              </Link>
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/", intent: "hero_concierge", lang })}
                className="inline-flex items-center gap-2 px-1 py-3 text-[13px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                <Headset size={14} className="text-primary" aria-hidden />
                {tx({ en: "Talk to a TAKATAK specialist", fr: "Parler à un spécialiste TAKATAK" })}
              </button>
            </div>

            {/* Starting points — one connected commerce baseline, not three pills */}
            <div className="mt-8 border-t border-white/10 pt-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                {tx({ en: "Starting points", fr: "Points de départ" })}
              </p>
              <ul className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
                {priceSignals.map((p) => (
                  <li key={p.to}>
                    <Link
                      to={p.to as never}
                      className="group inline-flex items-center gap-2 text-[13px] font-medium text-foreground/85 transition-colors hover:text-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/70 transition-transform group-hover:scale-125" aria-hidden />
                      {tx(p.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-muted-foreground">
              {TRUST.map((item) => (
                <li key={item.label.en} className="inline-flex items-center gap-1.5">
                  <item.icon size={12} className="text-primary" aria-hidden /> {tx(item.label)}
                </li>
              ))}
            </ul>
          </div>

          {/* Signature visual zone */}
          <div className="relative">
            <div className="mb-3 flex items-center justify-end gap-1 rounded-full border border-white/12 bg-white/10 p-1 text-[11px] font-semibold md:ml-auto md:w-fit">
              <button
                type="button"
                onClick={() => setExplore(false)}
                aria-pressed={!explore}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${!explore ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Sparkles size={12} aria-hidden /> {tx({ en: "See how TAKATAK works", fr: "Voir comment TAKATAK fonctionne" })}
              </button>
              <button
                type="button"
                onClick={() => setExplore(true)}
                aria-pressed={explore}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${explore ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Compass size={12} aria-hidden /> {tx({ en: "Explore services", fr: "Explorer les services" })}
              </button>
            </div>
            <HeroFlagshipScene explore={explore} />
          </div>
        </div>
      </PointerGlow>
    </section>
  );
}
