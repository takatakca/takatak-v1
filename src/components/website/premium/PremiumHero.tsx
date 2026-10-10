"use client";

import Image from "next/image";
import { ArrowDown, ArrowRight, AtSign, Headset, ReceiptText, ShieldCheck, Star } from "lucide-react";

import { AiServiceSearch } from "@/components/website/home/AiServiceSearch";
import { openLiveChat } from "@/lib/website/chat-provider";
import { getCoreCategory } from "@/lib/website/core-categories";
import { Link } from "@/lib/website/nav";
import { FloatCard } from "./mockups";
import { NavyBackdrop, accentStyle, useCopy } from "./ui";

/** Homepage hero: brand promise, start actions, service search and a layered product preview. */
export function PremiumHero() {
  const { tk, lang } = useCopy();
  const domains = accentStyle(getCoreCategory("domains"));
  const reviews = accentStyle(getCoreCategory("reviews"));

  return (
    <section aria-labelledby="home-hero-title" className="relative overflow-hidden">
      <NavyBackdrop grid />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 pb-16 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10 lg:pb-24 lg:pt-20">
        <div>
          <p className="tk-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/80 sm:text-[11px]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--tk-cyan)] shadow-[0_0_12px_var(--tk-cyan)]" />
            {tk("home.lead.eyebrow")}
          </p>
          <h1
            id="home-hero-title"
            className="tk-gradient-text mt-6 text-balance text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[68px]"
          >
            {tk("home.lead.title")}
          </h1>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-[var(--tk-cyan)] sm:text-[13px] sm:tracking-[0.32em]">
            {tk("home.lead.tagline")}
          </p>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/72 sm:text-[17px]">{tk("home.p.subtitle")}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/register"
              className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tk-navy)]"
            >
              {tk("home.p.ctaStart")} <ArrowRight size={16} aria-hidden />
            </Link>
            <a
              href="#core"
              className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)]"
            >
              {tk("home.p.ctaExplore")} <ArrowDown size={16} aria-hidden />
            </a>
          </div>
          <button
            type="button"
            onClick={() => openLiveChat({ page: "/", intent: "hero_concierge", lang })}
            className="mt-4 inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-white/80 underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tk-cyan)]"
          >
            <Headset size={16} className="text-[var(--tk-cyan)]" aria-hidden /> {tk("home.hero.ctaChat")}
          </button>

          <div className="tk-glass mt-8 max-w-xl rounded-2xl p-4">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">{tk("home.lead.searchLabel")}</p>
            <AiServiceSearch />
          </div>
        </div>

        {/* Layered product preview */}
        <div className="relative mx-auto w-full max-w-[640px] lg:max-w-none">
          <div aria-hidden className="pointer-events-none absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(31_139_255/0.35),transparent)] blur-2xl" />
          <div className="group tk-glass relative rounded-[28px] p-2.5">
            <div className="flex items-center gap-2 px-2 pb-2.5 pt-1">
              <span className="flex gap-1.5" aria-hidden>
                <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/18" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/12" />
              </span>
              <span className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] text-white/60">
                <ShieldCheck size={11} className="text-emerald-300" aria-hidden /> yourbrand.ca
              </span>
            </div>
            <div className="tk-zoom relative aspect-[16/10] overflow-hidden rounded-[20px]">
              <Image
                src="/marketplace/visuals/website.jpg"
                alt={tk("home.p.alt")}
                fill
                preload
                sizes="(min-width: 1280px) 660px, (min-width: 1024px) 52vw, 100vw"
                className="object-cover"
              />
              <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,rgb(31_139_255/0.18),transparent_40%,rgb(6_13_31/0.35))]" />
            </div>
          </div>

          <div style={domains} className="tk-drift absolute -left-2 top-12 w-[200px] sm:-left-8 sm:w-[230px]">
            <FloatCard icon={<AtSign size={15} />} title={tk("mock.domainConnected")} subtitle="yourbrand.ca" />
          </div>
          <div className="tk-drift-late absolute -right-2 top-[42%] hidden w-[230px] sm:block lg:-right-6">
            <FloatCard tone="ok" icon={<ShieldCheck size={15} />} title={tk("mock.sslActive")} subtitle={tk("cat.hosting.h2")} />
          </div>
          <div style={reviews} className="tk-drift-late absolute -bottom-6 left-4 w-[220px] sm:-left-6 sm:w-[250px]">
            <FloatCard
              icon={<Star size={15} className="fill-white" />}
              title={tk("mock.newReview")}
              subtitle="★★★★★"
            />
          </div>
          <div className="tk-drift absolute -bottom-8 right-3 hidden w-[200px] sm:block lg:-right-4">
            <FloatCard tone="ok" icon={<ReceiptText size={15} />} title={tk("mock.invoicePaid")} subtitle="#1042" />
          </div>
          <p className="absolute -bottom-16 right-0 text-[10px] uppercase tracking-[0.18em] text-white/35">{tk("home.p.preview")}</p>
        </div>
      </div>
    </section>
  );
}
