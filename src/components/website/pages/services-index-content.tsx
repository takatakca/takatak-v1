"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { formatCAD, cadenceLabel } from "@/lib/website/pricing";
import { servicePages } from "@/lib/website/service-pages";
import { useLanguage } from "@/lib/website/use-language";

export function ServicesIndexContent() {
  const { t, tx, lang } = useLanguage();
  const groups = Array.from(new Set(servicePages.map((page) => page.eyebrow.en)));

  return (
    <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
      <h1 className="text-3xl font-bold text-foreground md:text-4xl">
        {lang === "fr" ? "Tous les services" : "All services"}
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground">
        {lang === "fr"
          ? "Tous les services livrés par TAKATAK, avec configuration gérée et soutien canadien. Prix en CAD."
          : "Every service TAKATAK delivers, with managed setup and Canadian support. Prices in CAD."}
      </p>
      <Link
        to="/pricing"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        {t("common.viewPricing")} <ArrowRight size={14} />
      </Link>

      {groups.map((group) => {
        const items = servicePages.filter((page) => page.eyebrow.en === group);
        if (!items.length) return null;
        const groupLabel = tx(items[0]!.eyebrow);
        return (
          <section key={group} className="mt-12">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {groupLabel}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {items.map((service) => {
                const amount = service.packages.reduce(
                  (min, pack) => (pack.amount < min ? pack.amount : min),
                  service.packages[0]?.amount ?? 0,
                );
                const cadence = service.packages.find((pack) => pack.amount === amount)?.cadence;
                return (
                  <Link
                    key={service.slug}
                    to={service.route}
                    className="group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/45"
                  >
                    <h3 className="text-base font-semibold text-foreground">{tx(service.title)}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(service.tagline)}</p>
                    <div className="mt-auto flex items-center justify-between pt-5">
                      {amount > 0 && (
                        <span className="text-sm font-bold text-foreground">
                          {t("service.startingAt")} {formatCAD(amount)}
                          <span className="text-xs font-medium text-muted-foreground">
                            {cadence ? cadenceLabel(cadence) : ""}
                          </span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                        {t("common.explore")}{" "}
                        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
