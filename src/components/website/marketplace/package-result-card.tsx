"use client";

import Link from "next/link";
import { Clock, ShieldCheck } from "lucide-react";

import { ServiceThumbnail } from "@/components/website/marketplace/ServiceThumbnail";
import type { MarketplacePackage } from "@/lib/website/marketplace-catalog";
import { categoryName, fastestDelivery, packageTitle, startingPrice } from "@/lib/website/marketplace-i18n";
import { useLanguage } from "@/lib/website/use-language";

const COPY = {
  quote: { fr: "Demander un prix", en: "Request quote" },
  view: { fr: "Voir", en: "View" },
  managed: { fr: "Géré par TAKATAK · paiement versé après approbation", en: "TAKATAK-managed · payment released after approval" },
} as const;

/** One package in search and category results: real title, price and delivery from the catalog. */
export function PackageResultCard({ pkg }: { pkg: MarketplacePackage }) {
  const { lang } = useLanguage();
  const title = packageTitle(pkg, lang);
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-primary/50 hover:shadow-lg">
      <Link href={`/marketplace/gigs/${pkg.id}`} tabIndex={-1} aria-hidden>
        <ServiceThumbnail kind={pkg.thumb} />
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
          {categoryName(pkg.category, pkg.categoryName, lang)}
        </p>

        <Link
          href={`/marketplace/gigs/${pkg.id}`}
          className="mt-1 line-clamp-2 font-semibold leading-snug text-slate-950 transition hover:text-primary"
        >
          {title}
        </Link>

        {lang === "en" && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{pkg.blurb}</p>}

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden />
            {fastestDelivery(pkg, lang)}
          </span>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3">
          <p className="text-base font-bold text-slate-950">{startingPrice(pkg, lang)}</p>

          <div className="flex items-center gap-2">
            <Link
              href={`/marketplace/post-project?package=${encodeURIComponent(pkg.id)}`}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {COPY.quote[lang]}
              <span className="sr-only"> : {title}</span>
            </Link>

            <Link
              href={`/marketplace/gigs/${pkg.id}`}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary/90"
            >
              {COPY.view[lang]}
              <span className="sr-only"> : {title}</span>
            </Link>
          </div>
        </div>

        <p className="mt-3 inline-flex items-center gap-1 text-[10px] text-slate-500">
          <ShieldCheck size={11} className="text-primary" aria-hidden />
          {COPY.managed[lang]}
        </p>
      </div>
    </article>
  );
}
