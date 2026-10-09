"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "@/lib/website/nav";
import { ownedBrands } from "@/lib/website/owned-brands";
import { useLanguage } from "@/lib/website/use-language";

/** /ecosystem: the brands GROUPE TAKATAK owns and operates (data: src/lib/website/owned-brands.ts). */
export function OwnedBrandsContent() {
  const { t, tx } = useLanguage();

  return (
    <>
      <section aria-labelledby="brands-title" className="brand-dark relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 420px at 80% -20%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 62%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 py-14 md:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">GROUPE TAKATAK</p>
          <h1 id="brands-title" className="mt-4 text-4xl font-extrabold tracking-[-0.02em] text-foreground md:text-5xl">
            {t("brands.title")}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">{t("brands.intro")}</p>
        </div>
      </section>

      <section aria-label={t("brands.title")} className="mx-auto max-w-7xl px-4 py-12 md:py-16">
        {ownedBrands.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ownedBrands.map((b) => (
              <li key={b.id} className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
                <h2 className="text-lg font-bold text-foreground">{b.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{tx(b.description)}</p>
                {b.domain && (
                  <a
                    href={`https://${b.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex w-fit items-center gap-1.5 pt-5 text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("brands.visit", { domain: b.domain })} <ExternalLink size={14} aria-hidden />
                    <span className="sr-only">{t("brands.newTab")}</span>
                  </a>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/40 p-8 text-center md:p-12">
            <h2 className="text-xl font-semibold text-foreground">{t("brands.empty.title")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">{t("brands.empty.body")}</p>
          </div>
        )}

        <div className="mt-10">
          <Link to="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {t("brands.cta")} <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}
