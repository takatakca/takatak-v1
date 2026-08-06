import Link from "next/link";
import {
  ArrowRight,
  Check,
  Server,
} from "lucide-react";

import {
  formatCAD,
  pricing,
} from "@/lib/website/pricing";

export function HostingSpotlight() {
  return (
    <section className="brand-dark relative overflow-hidden border-y border-border py-16 md:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(700px 300px at 80% 20%, color-mix(in oklab, var(--brand-accent-violet) 18%, transparent), transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              Managed hosting
            </p>

            <h2 className="mt-3 text-3xl font-bold leading-tight text-foreground md:text-4xl">
              Fast, secure hosting from
              portfolio to ecommerce
            </h2>

            <p className="mt-3 text-base leading-7 text-muted-foreground">
              LiteSpeed-powered plans with
              SSL, backups, email, and
              TAKATAK-managed support
              paths. Change plans anytime.
            </p>
          </div>

          <Link
            href="/hosting"
            className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/10"
          >
            View all hosting plans
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pricing.hosting.map(
            (plan, index) => {
              const featured =
                plan.key === "silver";

              return (
                <div
                  key={plan.key}
                  className={`relative flex flex-col rounded-2xl border p-5 transition-colors ${
                    featured
                      ? "border-primary/50 bg-white/[0.06] shadow-[0_30px_60px_-30px_color-mix(in_oklab,var(--brand-accent-cyan)_60%,transparent)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/25"
                  }`}
                >
                  {featured ? (
                    <span
                      className="absolute -top-3 left-5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground"
                      style={{
                        backgroundImage:
                          "var(--gradient-hero)",
                      }}
                    >
                      Most popular
                    </span>
                  ) : null}

                  <div className="flex items-center gap-2">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
                      <Server size={16} />
                    </div>

                    <div className="text-sm font-bold text-foreground">
                      {plan.name}
                    </div>
                  </div>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight text-foreground">
                      {formatCAD(
                        plan.amount,
                      )}
                    </span>

                    <span className="text-sm font-medium text-muted-foreground">
                      /month
                    </span>
                  </div>

                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {plan.description}
                  </p>

                  <ul className="mt-4 space-y-2 text-sm text-foreground/90">
                    {plan.features.map(
                      (feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2"
                        >
                          <Check
                            size={14}
                            className="mt-0.5 shrink-0 text-primary"
                          />

                          <span>
                            {feature}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>

                  <Link
                    href="/hosting"
                    className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                      featured
                        ? "text-primary-foreground"
                        : "border border-white/15 bg-white/5 text-foreground hover:bg-white/10"
                    }`}
                    style={
                      featured
                        ? {
                            backgroundImage:
                              "var(--gradient-hero)",
                          }
                        : undefined
                    }
                  >
                    Choose {plan.name}
                    <ArrowRight size={14} />
                  </Link>

                  <div className="mt-3 text-center text-[10px] uppercase tracking-wider text-muted-foreground">
                    Plan {index + 1} of{" "}
                    {pricing.hosting.length}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>
    </section>
  );
}