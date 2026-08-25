"use client";

import { Link } from "@/lib/website/nav";
import { ArrowRight, ArrowUpRight, BadgeCheck } from "lucide-react";
import { getPackage, formatStartingPrice } from "@/lib/website/marketplace-packages";
import { useLanguage } from "@/lib/website/use-language";
import { Reveal } from "@/components/website/motion/Reveal";
import { QMAPS, FLEXS, externalLinkProps, type ProductDestination } from "@/lib/website/product-destinations";
import {
  WebsiteScene,
  LogoScene,
  MenuScene,
  LocalScene,
  SocialScene,
  LeadScene,
  AutomationScene,
  BrandKitScene,
} from "@/components/website/home/trending/TrendingScenes";

type Bilingual = { en: string; fr: string };

interface TrendingEntry {
  id: string;
  scene: () => React.ReactElement;
  label: Bilingual;
  note: Bilingual;
  /** Set when the package is delivered through a named TAKATAK product. */
  product?: ProductDestination;
}

/** Real catalogue packages only — no invented ratings, totals or urgency. */
const ENTRIES: readonly TrendingEntry[] = [
  {
    id: "website-starter",
    scene: WebsiteScene,
    label: { en: "Featured project", fr: "Projet en vedette" },
    note: {
      en: "A complete business website, designed, built and launched by the TAKATAK delivery team.",
      fr: "Un site d'entreprise complet, conçu, construit et lancé par l'équipe de livraison TAKATAK.",
    },
  },
  {
    id: "local-seo-setup",
    scene: LocalScene,
    label: { en: "Local visibility", fr: "Visibilité locale" },
    note: {
      en: "Listings, maps and directory data kept consistent so nearby customers find you first.",
      fr: "Fiches, cartes et annuaires cohérents pour que les clients à proximité vous trouvent d'abord.",
    },
    product: QMAPS,
  },
  {
    id: "lead-funnel",
    scene: LeadScene,
    label: { en: "Lead capture", fr: "Capture de prospects" },
    note: {
      en: "Turn interest into tracked opportunities with a structured intake and follow-up path.",
      fr: "Transformez l'intérêt en occasions suivies grâce à un parcours d'accueil structuré.",
    },
    product: FLEXS,
  },
  {
    id: "logo-design",
    scene: LogoScene,
    label: { en: "Brand mark", fr: "Marque visuelle" },
    note: { en: "Concept to final files.", fr: "Du concept aux fichiers finaux." },
  },
  {
    id: "menu-design",
    scene: MenuScene,
    label: { en: "Print & digital", fr: "Imprimé et numérique" },
    note: { en: "Menus built for counter and phone.", fr: "Des menus pensés pour le comptoir et le mobile." },
  },
  {
    id: "social-content-pack",
    scene: SocialScene,
    label: { en: "Always-on content", fr: "Contenu continu" },
    note: { en: "Planned, produced and scheduled.", fr: "Planifié, produit et programmé." },
  },
  {
    id: "workflow-automation",
    scene: AutomationScene,
    label: { en: "Operations", fr: "Opérations" },
    note: { en: "Repetitive work handled automatically.", fr: "Les tâches répétitives gérées automatiquement." },
  },
  {
    id: "brand-identity-kit",
    scene: BrandKitScene,
    label: { en: "Full identity", fr: "Identité complète" },
    note: { en: "Mark, type, colour and applications.", fr: "Marque, typographie, couleurs et applications." },
  },
];

function EntryCard({ entry, featured = false }: { entry: TrendingEntry; featured?: boolean }) {
  const { tx } = useLanguage();
  const pkg = getPackage(entry.id);
  if (!pkg) return null;
  const Scene = entry.scene;

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-[0_18px_40px_-24px_color-mix(in_oklab,var(--foreground)_45%,transparent)] ${
        featured ? "md:flex-row" : ""
      }`}
    >
      <div className={featured ? "relative aspect-[16/10] md:aspect-auto md:w-[56%]" : "relative aspect-[16/10]"}>
        <div className="absolute inset-0 p-2 transition-transform duration-700 group-hover:scale-[1.02]">
          <Scene />
        </div>
      </div>

      <div className={`flex flex-1 flex-col p-4 ${featured ? "md:justify-center md:p-7" : ""}`}>
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <BadgeCheck size={10} aria-hidden /> {tx(entry.label)}
        </span>

        <h3 className={`mt-2.5 font-semibold leading-tight text-foreground ${featured ? "text-xl md:text-2xl" : "text-sm"}`}>
          <Link
            to="/marketplace/gigs/$id"
            params={{ id: pkg.id }}
            className="after:absolute after:inset-0 hover:text-primary focus-visible:outline-none"
          >
            {pkg.title}
          </Link>
        </h3>

        <p className={`mt-1.5 text-muted-foreground ${featured ? "text-sm md:max-w-md" : "line-clamp-2 text-xs"}`}>
          {tx(entry.note)}
        </p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-3">
          <span className={`font-bold text-foreground ${featured ? "text-base" : "text-sm"}`}>
            {formatStartingPrice(pkg)}
          </span>
          <span className="text-xs text-muted-foreground">{pkg.categoryName}</span>
          {entry.product && (
            <a
              href={entry.product.productUrl}
              {...externalLinkProps}
              className="relative z-10 ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {tx({ en: entry.product.en.open, fr: entry.product.fr.open })}
              <ArrowUpRight size={12} aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

/**
 * Trending: a curated merchandising window onto the real catalogue, laid out
 * as an editorial grid — one featured project, two signature product stories,
 * then a supporting row of starting points.
 */
export function TrendingProjectsRail() {
  const { tx } = useLanguage();
  const [featured, ...rest] = ENTRIES;
  const signature = rest.slice(0, 2);
  const supporting = rest.slice(2);

  return (
    <section className="relative overflow-hidden border-b border-border bg-background">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-6 top-4 select-none text-[16vw] font-black leading-none tracking-tighter text-foreground/[0.035] md:text-[11rem]"
      >
        TRENDING
      </span>

      <div className="relative mx-auto max-w-7xl px-4 py-12 md:py-16">
        <Reveal className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
              {tx({ en: "Curated by TAKATAK", fr: "Sélection TAKATAK" })}
            </p>
            <h2 className="mt-1.5 text-2xl font-black tracking-tight text-foreground md:text-3xl">
              {tx({ en: "What businesses start with", fr: "Ce par quoi les entreprises commencent" })}
            </h2>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              {tx({
                en: "Real packages from our catalogue, delivered and managed end to end.",
                fr: "De vrais forfaits de notre catalogue, livrés et encadrés de bout en bout.",
              })}
            </p>
          </div>
          <Link
            to="/marketplace"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:underline sm:inline-flex"
          >
            {tx({ en: "Browse all", fr: "Tout parcourir" })} <ArrowRight size={14} aria-hidden />
          </Link>
        </Reveal>

        <Reveal className="mt-7 grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">{featured && <EntryCard entry={featured} featured />}</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {signature.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
        </Reveal>

        <Reveal className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {supporting.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </Reveal>

        <Link
          to="/marketplace"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline sm:hidden"
        >
          {tx({ en: "Browse all", fr: "Tout parcourir" })} <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
