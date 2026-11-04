"use client";

import { Clock, ShieldCheck } from "lucide-react";

import { categoryName, fastestDelivery, packageTitle, startingPrice } from "@/lib/website/marketplace-i18n";
import { getPackage } from "@/lib/website/marketplace-packages";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";
import { ServiceThumbnail } from "./ServiceThumbnail";

/** One real package per kind of work; prices and delivery times come from the catalog. */
const PICKS = [
  "website-starter",
  "app-ui-prototype",
  "logo-design",
  "brand-identity-kit",
  "social-content-pack",
  "local-seo-setup",
  "data-entry",
  "menu-design",
  "flyer-design",
  "ecommerce-shopify",
  "automation-setup",
  "ai-chatbot-setup",
];

const COPY = {
  managed: { fr: "Géré par TAKATAK", en: "Managed by TAKATAK" },
} as const;

export function PopularServicesGrid() {
  const { lang } = useLanguage();
  const packages = PICKS.map((id) => getPackage(id)).filter((p) => p !== undefined);
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {packages.map((p) => (
        <Link
          key={p.id}
          to={`/marketplace/gigs/${p.id}`}
          className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-[var(--shadow-card)]"
        >
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 z-10 h-[3px]"
            style={{ background: "linear-gradient(90deg, var(--brand-dark), var(--brand-accent-cyan) 60%, var(--brand-accent-violet))" }}
          />
          <ServiceThumbnail kind={p.thumb} />
          <div className="flex flex-1 flex-col p-4">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {categoryName(p.category, p.categoryName, lang)}
            </div>
            <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
              {packageTitle(p, lang)}
            </h3>
            {lang === "en" && <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{p.blurb}</p>}
            <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ShieldCheck size={11} className="text-primary" aria-hidden />
              {COPY.managed[lang]}
            </div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} aria-hidden />
              {fastestDelivery(p, lang)}
            </div>
            <div className="mt-auto flex items-center justify-end border-t border-border pt-3">
              <div className="text-base font-bold text-foreground">{startingPrice(p, lang)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
