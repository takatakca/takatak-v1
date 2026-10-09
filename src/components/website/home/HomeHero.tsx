"use client";

import { ArrowRight, Headset, Languages, ShieldCheck, UserCheck } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { openLiveChat } from "@/lib/website/chat-provider";
import { pricing } from "@/lib/website/pricing";
import { useLanguage } from "@/lib/website/use-language";
import { AiServiceSearch } from "./AiServiceSearch";

/** Homepage hero: one message, one primary action, the service search and starting prices. */
export function HomeHero() {
  const { t, lang } = useLanguage();

  const money = (n: number) =>
    lang === "fr"
      ? `${n.toFixed(n % 1 ? 2 : 0).replace(".", ",")} $`
      : `$${n.toFixed(n % 1 ? 2 : 0)}`;

  const prices = [
    { to: "/services/websites", label: t("home.lead.price.websites", { price: money(pricing.websites[0].amount) }) },
    { to: "/hosting", label: t("home.lead.price.hosting", { price: money(pricing.hosting[0].amount) }) },
    { to: "/domain", label: t("home.lead.price.domains", { price: money(pricing.domain.register.amount) }) },
  ];

  const trust = [
    { icon: ShieldCheck, label: t("home.hero.trust.managed") },
    { icon: UserCheck, label: t("home.lead.trust.review") },
    { icon: Languages, label: t("home.lead.trust.bilingual") },
  ];

  return (
    <section aria-labelledby="home-hero-title" className="brand-dark relative overflow-hidden border-b border-border">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 520px at 85% -10%, color-mix(in oklab, var(--primary) 30%, transparent), transparent 62%), radial-gradient(700px 420px at -10% 110%, color-mix(in oklab, var(--brand-accent-cyan) 12%, transparent), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(color-mix(in oklab, var(--brand-accent-cyan) 50%, transparent) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(ellipse at 70% 30%, black 10%, transparent 70%)",
          }}
        />
      </div>

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-14 pt-12 md:pb-20 md:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {t("home.lead.eyebrow")}
          </p>
          <h1
            id="home-hero-title"
            className="mt-4 text-balance text-[34px] font-extrabold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-5xl lg:text-[56px]"
          >
            {t("home.lead.title")}
          </h1>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-accent-cyan)]">
            {t("home.lead.tagline")}
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">{t("home.lead.subtitle")}</p>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              to="/marketplace/post-project"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-[var(--shadow-glow)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("home.lead.cta")} <ArrowRight size={16} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => openLiveChat({ page: "/", intent: "hero_concierge", lang })}
              className="inline-flex items-center gap-2 rounded-lg px-2 py-3 text-sm font-semibold text-foreground/90 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Headset size={16} className="text-[var(--brand-accent-cyan)]" aria-hidden />
              {t("home.hero.ctaChat")}
            </button>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            {trust.map((item) => (
              <li key={item.label} className="inline-flex items-center gap-1.5">
                <item.icon size={14} className="text-[var(--brand-accent-cyan)]" aria-hidden /> {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] backdrop-blur-md sm:p-6">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("home.lead.searchLabel")}
          </p>
          <AiServiceSearch />

          <div className="mt-6 border-t border-white/10 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {t("home.lead.startingPoints")}
            </p>
            <ul className="mt-2 grid gap-1">
              {prices.map((p) => (
                <li key={p.to}>
                  <Link
                    to={p.to}
                    className="group flex items-center justify-between rounded-lg px-2 py-2 text-sm font-medium text-foreground/90 transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {p.label}
                    <ArrowRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
