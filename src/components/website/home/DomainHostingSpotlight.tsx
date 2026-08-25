"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, Search } from "lucide-react";
import { pricing, formatCAD } from "@/lib/website/pricing";
import { HostingPlanSelector } from "./HostingPlanSelector";
import { useLanguage } from "@/lib/website/use-language";

export function DomainHostingSpotlight() {
  const { t } = useLanguage();
  return (
    <section className="relative overflow-hidden border-y border-border bg-secondary/30">
      <svg aria-hidden viewBox="0 0 1200 400" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full text-primary opacity-[0.16]">
        <path d="M 60 340 C 320 340, 320 90, 600 90 C 880 90, 880 320, 1140 320" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M 60 90 C 340 90, 340 300, 600 300 C 860 300, 860 120, 1140 120" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="6 10" />
        {[60, 320, 600, 880, 1140].map((x) => (
          <circle key={x} cx={x} cy={x === 600 ? 90 : 200} r="4" fill="currentColor" />
        ))}
      </svg>
      <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-20">
        <h2 className="text-2xl font-bold text-foreground md:text-3xl">{t("home.spot.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("home.spot.subtitle")}</p>

        <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">{t("home.spot.domainTitle")}</h3>
              <span className="text-sm font-bold text-foreground">
                {t("price.from")} {formatCAD(pricing.domain.register.amount)}
                <span className="text-xs font-medium text-muted-foreground">{t("cadence.yearly")}</span>
              </span>
            </div>
            <div className="mt-5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-3">
              <Search size={16} className="shrink-0 text-primary" />
              <span className="min-w-0 truncate text-sm text-muted-foreground">yourbusiness.ca</span>
              <span className="ml-auto shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">{t("home.spot.search")}</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {t("home.spot.domainTags").split(",").map((tag) => (
                <span key={tag} className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">{tag}</span>
              ))}
            </div>
            <Link to="/domain" className="mt-auto inline-flex w-fit items-center gap-2 pt-6 text-sm font-semibold text-primary hover:underline">
              {t("home.spot.domainCta")} <ArrowRight size={14} />
            </Link>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-foreground">{t("home.spot.hostingTitle")}</h3>
              <span className="text-sm font-bold text-foreground">
                {t("price.from")} {formatCAD(pricing.hosting[0].amount)}
                <span className="text-xs font-medium text-muted-foreground">{t("cadence.monthly")}</span>
              </span>
            </div>
            <div className="mt-5">
              <HostingPlanSelector />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
