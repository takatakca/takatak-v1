import Link from "next/link";
import {
  ArrowRight,
  Globe2,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Zap,
} from "lucide-react";

const quickLinks = [
  {
    label: "Search domains",
    href: "/domain",
    icon: Globe2,
  },
  {
    label: "Hosting plans",
    href: "/hosting",
    icon: Server,
  },
  {
    label: "Build a website",
    href: "/services/websites",
    icon: Rocket,
  },
  {
    label: "Browse marketplace",
    href: "/marketplace",
    icon: Store,
  },
] as const;

export function PremiumHero() {
  return (
    <section className="brand-dark relative overflow-hidden border-b border-border">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(1200px 500px at 85% -10%, color-mix(in oklab, var(--brand-accent-violet) 22%, transparent), transparent 60%), radial-gradient(900px 500px at -10% 110%, color-mix(in oklab, var(--brand-accent-cyan) 20%, transparent), transparent 60%)",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)",
        }}
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "linear-gradient(var(--brand-dark-border) 1px, transparent 1px), linear-gradient(90deg, var(--brand-dark-border) 1px, transparent 1px)",

          backgroundSize: "48px 48px",

          maskImage:
            "radial-gradient(ellipse at center, black 45%, transparent 85%)",
        }}
      />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/85 backdrop-blur">
            <Sparkles
              size={12}
              className="text-primary"
            />

            The Canadian business
            operating platform
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[58px]">
            Launch, manage, and grow
            your business online with{" "}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--brand-accent-cyan), var(--brand-accent-violet))",
              }}
            >
              TAKATAK
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
            Domains, hosting, websites,
            apps, marketing, automation,
            VoIP, lead generation, and
            managed service delivery —
            connected in one professional
            platform.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_50px_-18px_color-mix(in_oklab,var(--brand-accent-cyan)_60%,transparent)]"
              style={{
                backgroundImage:
                  "var(--gradient-hero)",
              }}
            >
              Explore services
              <ArrowRight size={16} />
            </Link>

            <Link
              href="/marketplace/post-project"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-white/10"
            >
              Start a project
            </Link>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {quickLinks.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:border-white/25 hover:bg-white/10"
                >
                  <Icon
                    size={13}
                    className="text-primary"
                  />

                  {item.label}

                  <ArrowRight
                    size={11}
                    className="opacity-60 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              );
            })}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck
                size={13}
                className="text-primary"
              />
              Escrow on every order
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Star
                size={13}
                className="text-primary"
              />
              Managed delivery & review
            </span>

            <span className="inline-flex items-center gap-1.5">
              <Zap
                size={13}
                className="text-primary"
              />
              CAD billing · Canadian
              support
            </span>
          </div>
        </div>

        <div className="relative hidden lg:block">
          <div className="relative h-[520px] w-full">
            <div className="absolute inset-4 rounded-3xl border border-white/10 bg-white/[0.04]" />

            <div className="absolute right-0 top-6 w-[86%] rounded-2xl border border-white/10 bg-[color:var(--brand-dark-surface,rgba(20,20,28,0.9))] p-4 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                  <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                </div>

                <div className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-foreground/80">
                  dashboard.takatak.ca
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  {
                    label:
                      "Active services",
                    value: "12",
                  },
                  {
                    label:
                      "Open projects",
                    value: "4",
                  },
                  {
                    label: "MRR",
                    value: "$2,847",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </div>

                    <div className="mt-1 text-lg font-bold text-foreground">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground">
                    Delivery pipeline
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    This week
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {[
                    {
                      name:
                        "yourbrand.ca — DNS live",
                      percent: 100,
                      tone: "cyan",
                    },
                    {
                      name:
                        "Silver hosting provisioned",
                      percent: 82,
                      tone: "violet",
                    },
                    {
                      name:
                        "Business website — design",
                      percent: 54,
                      tone: "cyan",
                    },
                    {
                      name:
                        "Local listings — Maps",
                      percent: 32,
                      tone: "violet",
                    },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="grid grid-cols-[1fr_auto] items-center gap-2 text-[11px]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-foreground/90">
                          {row.name}
                        </div>

                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${row.percent}%`,

                              background:
                                row.tone ===
                                "cyan"
                                  ? "linear-gradient(90deg, var(--brand-accent-cyan), color-mix(in oklab, var(--brand-accent-cyan) 40%, transparent))"
                                  : "linear-gradient(90deg, var(--brand-accent-violet), color-mix(in oklab, var(--brand-accent-violet) 40%, transparent))",
                            }}
                          />
                        </div>
                      </div>

                      <span className="text-muted-foreground">
                        {row.percent}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute left-0 top-40 w-56 rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-[0_25px_60px_-25px_rgba(0,0,0,0.6)] backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Server size={16} />
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Silver hosting
                  </div>

                  <div className="truncate text-sm font-bold text-foreground">
                    $39.99
                    <span className="text-xs font-medium text-muted-foreground">
                      /mo
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-8 left-6 w-64 rounded-2xl border border-white/10 bg-white/[0.06] p-3 shadow-[0_25px_60px_-25px_rgba(0,0,0,0.6)] backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
                  <Rocket size={16} />
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Business Website
                  </div>

                  <div className="truncate text-sm font-bold text-foreground">
                    from $1,499{" "}
                    <span className="text-xs font-medium text-muted-foreground">
                      CAD
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}