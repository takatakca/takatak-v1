import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  cadenceLabel,
  featuredPrices,
  formatCAD,
} from "@/lib/website/pricing";

export function FeaturedPricingSection() {
  return (
    <section className="relative py-16 md:py-24">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Featured pricing (CAD)
            </p>

            <h2 className="mt-3 text-3xl font-bold leading-tight text-foreground md:text-4xl">
              Transparent pricing across
              every service
            </h2>

            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Real starting prices for
              every TAKATAK service —
              hosting, websites, apps,
              marketing, and more. Custom
              scope always available.
            </p>
          </div>

          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:border-primary/40"
          >
            See all services
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {featuredPrices.map(
            (price) => (
              <Link
                key={price.key}
                href={price.href}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-primary/45"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    {price.category}
                  </p>

                  <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Starting at
                  </span>
                </div>

                <h3 className="mt-3 text-base font-semibold leading-snug text-foreground">
                  {price.headline}
                </h3>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-bold tracking-tight text-foreground">
                    {formatCAD(price.from)}
                  </span>

                  <span className="text-sm font-medium text-muted-foreground">
                    {cadenceLabel(
                      price.cadence,
                    ) ||
                      (price.suffix ?? "")}
                  </span>

                  {price.suffix &&
                  cadenceLabel(
                    price.cadence,
                  ) ? (
                    <span className="text-sm font-medium text-muted-foreground">
                      {price.suffix}
                    </span>
                  ) : null}
                </div>

                <div className="mt-auto pt-5">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    {price.cta}

                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </Link>
            ),
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Final pricing depends on scope,
          integrations, timeline, and
          business requirements. All
          prices in CAD.
        </p>
      </div>
    </section>
  );
}