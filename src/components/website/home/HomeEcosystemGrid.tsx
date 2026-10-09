"use client";

import {
  ArrowRight,
  AtSign,
  LayoutTemplate,
  MapPin,
  Megaphone,
  Server,
  Share2,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/lib/website/nav";
import type { TranslationKey } from "@/lib/website/i18n";
import { hasOwnedBrands } from "@/lib/website/owned-brands";
import { useLanguage } from "@/lib/website/use-language";
import { Reveal } from "./Reveal";

type ServiceKey = "websites" | "domains" | "hosting" | "marketing" | "social" | "local" | "leads" | "ai";

// Each card links to an existing service page (src/lib/website/service-pages.ts, /domain, /hosting).
const SERVICES: readonly { key: ServiceKey; icon: LucideIcon; to: string }[] = [
  { key: "websites", icon: LayoutTemplate, to: "/services/websites" },
  { key: "domains", icon: AtSign, to: "/domain" },
  { key: "hosting", icon: Server, to: "/hosting" },
  { key: "marketing", icon: Megaphone, to: "/services/marketing" },
  { key: "social", icon: Share2, to: "/services/social-media" },
  { key: "local", icon: MapPin, to: "/services/local-listings" },
  { key: "leads", icon: Users, to: "/services/lead-generation" },
  { key: "ai", icon: Sparkles, to: "/services/ai-business-tools" },
];

/** What TAKATAK does, as one clean grid of service cards. */
export function HomeEcosystemGrid() {
  const { t } = useLanguage();
  return (
    <section aria-labelledby="home-eco-title" className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 md:py-24">
        <Reveal className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("home.eco.kicker")}</p>
          <h2 id="home-eco-title" className="mt-3 text-balance text-3xl font-bold leading-tight text-foreground md:text-4xl">
            {t("home.eco.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground">{t("home.eco.subtitle")}</p>
        </Reveal>

        <ul className="mt-8 grid grid-cols-1 gap-2.5 sm:mt-10 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
          {SERVICES.map(({ key, icon: Icon, to }) => (
            <li key={key}>
              <Link
                to={to}
                className="group flex h-full items-start gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-[var(--shadow-card)] transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:flex-col sm:gap-0"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary" aria-hidden>
                  <Icon size={20} />
                </span>
                <span className="min-w-0 sm:mt-4">
                  <span className="flex items-center gap-1.5 text-base font-semibold text-foreground">
                    {t(`home.eco.${key}.title` as TranslationKey)}
                    <ArrowRight
                      size={14}
                      className="text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                      aria-hidden
                    />
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-muted-foreground sm:mt-1.5">
                    {t(`home.eco.${key}.desc` as TranslationKey)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link to="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            {t("home.eco.all")} <ArrowRight size={14} aria-hidden />
          </Link>
          {hasOwnedBrands && (
            <Link to="/ecosystem" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              {t("home.eco.brands")} <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
