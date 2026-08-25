"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, Check, Headset, MessageSquare } from "lucide-react";
import { ServiceFlowDiagram } from "@/components/website/services/ServiceFlowDiagram";
import { useLanguage } from "@/lib/website/use-language";
import { openLiveChat } from "@/lib/website/chat-provider";
import { formatCAD, cadenceLabel } from "@/lib/website/pricing";
import type { ServicePage } from "@/lib/website/service-pages";

export function ServiceProductPage({ page }: { page: ServicePage }) {
  const { t, tx, lang } = useLanguage();
  const cheapest = page.packages.reduce(
    (min, p) => (p.amount < min ? p.amount : min),
    page.packages[0]?.amount ?? 0,
  );

  return (
    <>
      <article>
        {/* Hero */}
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {tx(page.eyebrow)}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold text-foreground md:text-5xl">
              {tx(page.title)}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
              {tx(page.tagline)}
            </p>

            {page.packages.length > 0 && (
              <p className="mt-6 text-sm text-muted-foreground">
                {t("service.startingAt")}{" "}
                <span className="text-lg font-bold text-foreground">{formatCAD(cheapest)}</span>{" "}
                CAD
              </p>
            )}

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to={page.cta.to as never}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {tx(page.cta.label)} <ArrowRight size={15} />
              </Link>
              <button
                type="button"
                onClick={() =>
                  openLiveChat({
                    query: tx(page.title),
                    intent: page.slug,
                    page: page.route,
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-5 py-3 text-sm font-semibold text-foreground hover:border-primary/45"
              >
                <Headset size={15} /> {t("service.talkToTakatak")}
              </button>
              <Link
                to="/marketplace/post-project"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/60 px-5 py-3 text-sm font-semibold text-foreground hover:border-primary/45"
              >
                <MessageSquare size={15} /> {t("service.requestQuote")}
              </Link>
            </div>
          </div>
        </section>

        {/* What it does + flow */}
        <section className="border-b border-border bg-background">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <h2 className="text-xl font-bold text-foreground md:text-2xl">
              {t("service.whatItDoes")}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              {tx(page.intro)}
            </p>

            <h3 className="mt-10 text-lg font-semibold text-foreground">
              {t("service.howItWorks")}
            </h3>
            <div className="mt-4">
              <ServiceFlowDiagram flow={page.flow} steps={page.steps.map((s) => tx(s))} />
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="border-b border-border bg-secondary/20">
          <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
            <h2 className="text-xl font-bold text-foreground md:text-2xl">
              {t("service.benefits")}
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {page.benefits.map((b) => (
                <li
                  key={b.en}
                  className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-4"
                >
                  <Check size={15} className="mt-0.5 shrink-0 text-primary" />
                  <span className="text-sm text-foreground">{tx(b)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Packages */}
        {page.packages.length > 0 && (
          <section className="border-b border-border bg-background">
            <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
              <h2 className="text-xl font-bold text-foreground md:text-2xl">
                {t("service.packages")}
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {page.packages.map((p) => (
                  <div
                    key={p.key}
                    className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
                  >
                    <p className="text-sm font-semibold text-foreground">{tx(p.name)}</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">
                      {formatCAD(p.amount)}
                      <span className="text-xs font-medium text-muted-foreground">
                        {cadenceLabel(p.cadence)}
                        {p.suffix ? ` ${p.suffix}` : ""} CAD
                      </span>
                    </p>
                    <Link
                      to={page.cta.to as never}
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      {tx(page.cta.label)} <ArrowRight size={13} />
                    </Link>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{t("service.cadNote")}</p>
            </div>
          </section>
        )}

        {/* FAQ */}
        <section className="border-b border-border bg-secondary/20">
          <div className="mx-auto max-w-3xl px-4 py-12 md:py-16">
            <h2 className="text-xl font-bold text-foreground md:text-2xl">{t("service.faq")}</h2>
            <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
              {page.faq.map((f) => (
                <details key={f.q.en} className="group p-5">
                  <summary className="cursor-pointer list-none text-sm font-semibold text-foreground marker:hidden">
                    {tx(f.q)}
                  </summary>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(f.a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-background">
          <div className="mx-auto max-w-4xl px-4 py-14 text-center md:py-20">
            <h2 className="text-2xl font-bold text-foreground md:text-3xl">{t("cta.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">{t("cta.body")}</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                to={page.cta.to as never}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                {tx(page.cta.label)} <ArrowRight size={15} />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:border-primary/45"
              >
                {t("service.seeAll")}
              </Link>
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:border-primary/45"
              >
                {t("common.viewPricing")}
              </Link>
            </div>
            <p className="sr-only">{lang}</p>
          </div>
        </section>
      </article>
    </>
  );
}