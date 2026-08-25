"use client";

import type { ReactNode } from "react";
import { Link } from "@/lib/website/nav";
import { ArrowRight, ExternalLink } from "lucide-react";
import { useLanguage } from "@/lib/website/use-language";
import { formatCAD } from "@/lib/website/pricing";
import { PROMO_CODE } from "@/lib/website/promotions";
import { externalLinkProps } from "@/lib/website/product-destinations";

/**
 * Shared commerce furniture for the Popular Upgrades storefront: price
 * treatment, CTA shapes, product labels and the contextual FIRST10 prompt.
 * Every control here is a real link and keyboard reachable.
 */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">{children}</p>
  );
}

export function PriceTag({ amount, className = "" }: { amount: number; className?: string }) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {t("upg.startingAt")}
      </span>
      <span className="text-base font-bold text-foreground">{formatCAD(amount)} CAD</span>
    </span>
  );
}

export function ProductLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border bg-secondary/70 px-2.5 py-1 text-[11px] font-medium text-foreground">
      {children}
    </span>
  );
}

/** Primary commerce CTA: restrained depth, arrow advances on hover/focus. */
export function PrimaryCta({
  to,
  search,
  label,
}: {
  to: string;
  search?: Record<string, string>;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      search={search as never}
      className="tk-cta group/cta inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
      <ArrowRight size={14} className="transition-transform duration-300 group-hover/cta:translate-x-1" />
    </Link>
  );
}

export function SecondaryCta({
  to,
  search,
  label,
}: {
  to: string;
  search?: Record<string, string>;
  label: string;
}) {
  return (
    <Link
      to={to as never}
      search={search as never}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/70 px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors duration-300 hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {label}
    </Link>
  );
}

/** External product action (QMAPS / FLEXS) with an explicit destination name. */
export function ProductExternalCta({
  href,
  name,
  accessibleName,
}: {
  href: string;
  name: string;
  accessibleName: string;
}) {
  return (
    <a
      href={href}
      {...externalLinkProps}
      aria-label={accessibleName}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-3 py-1.5 text-[12px] font-semibold text-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      {name}
      <ExternalLink size={12} aria-hidden />
    </a>
  );
}

/**
 * Restrained welcome-offer prompt. It preserves the selected upgrade by
 * carrying the registry service key and its return route into /signup, where
 * the existing FIRST10 flow takes over.
 */
export function WelcomeOfferPrompt({
  serviceKey,
  next,
  extra,
}: {
  serviceKey: string;
  next: string;
  extra?: Record<string, string>;
}) {
  const { t, lang } = useLanguage();
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
      <span>{t("upg.offer.hint")}</span>
      <Link
        to={"/signup" as never}
        search={{ promo: PROMO_CODE, service: serviceKey, next, lang, ...extra } as never}
        className="font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {t("upg.offer.cta")}
      </Link>
    </p>
  );
}