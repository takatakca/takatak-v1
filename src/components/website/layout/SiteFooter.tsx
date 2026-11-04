"use client";

import { Link } from "@/lib/website/nav";
import { brand } from "@/lib/website/brand";
import { TakatakLogo } from "@/components/brand/takatak-logo";
import { hasOwnedBrands } from "@/lib/website/owned-brands";
import { useLanguage } from "@/lib/website/use-language";

type Bi = { en: string; fr: string };
type FooterLink = { to: string; label: Bi; params?: Record<string, string> };

const cols: { title: Bi; links: FooterLink[] }[] = [
  {
    title: { en: "Categories", fr: "Catégories" },
    links: [
      { to: "/marketplace/category/$slug", params: { slug: "logo_design" }, label: { en: "Graphics & Design", fr: "Graphisme et design" } },
      { to: "/marketplace/category/$slug", params: { slug: "website_design" }, label: { en: "Programming & Tech", fr: "Programmation et tech" } },
      { to: "/marketplace/category/$slug", params: { slug: "online_advertising" }, label: { en: "Digital Marketing", fr: "Marketing numérique" } },
      { to: "/marketplace/category/$slug", params: { slug: "content_writing" }, label: { en: "Writing & Translation", fr: "Rédaction et traduction" } },
      { to: "/marketplace/category/$slug", params: { slug: "ai_tool_setup" }, label: { en: "AI Services", fr: "Services d'IA" } },
      { to: "/marketplace/category/$slug", params: { slug: "data_entry" }, label: { en: "Data", fr: "Données" } },
    ],
  },
  {
    title: { en: "For Clients", fr: "Pour les clients" },
    links: [
      { to: "/marketplace", label: { en: "How TAKATAK works", fr: "Comment fonctionne TAKATAK" } },
      { to: "/marketplace/post-project", label: { en: "Post a project", fr: "Décrire un projet" } },
      { to: "/dashboard", label: { en: "Manage projects", fr: "Gérer mes projets" } },
      { to: "/dashboard/support", label: { en: "Support", fr: "Soutien" } },
    ],
  },
  {
    title: { en: "For Groupe TAKATAK Freelancers", fr: "Pour les pigistes de Groupe TAKATAK" },
    links: [
      { to: "/dashboard/freelancer", label: { en: "Become a freelancer", fr: "Devenir pigiste" } },
      { to: "/dashboard/freelancer/contracts", label: { en: "Contracts", fr: "Contrats" } },
      { to: "/dashboard/freelancer/deliveries", label: { en: "Deliveries", fr: "Livraisons" } },
      { to: "/dashboard/freelancer/payouts", label: { en: "Payouts", fr: "Paiements" } },
    ],
  },
  {
    title: { en: "Business Solutions", fr: "Solutions d'affaires" },
    links: [
      // The TAKATAK core, in the owner's order (src/lib/website/core-categories.ts).
      { to: "/services/websites", label: { en: "Websites", fr: "Sites web" } },
      { to: "/domain", label: { en: "Domains", fr: "Domaines" } },
      { to: "/hosting", label: { en: "Hosting", fr: "Hébergement" } },
      { to: "/monitoring", label: { en: "Website Monitoring", fr: "Surveillance de sites web" } },
      { to: "/services/marketing", label: { en: "Marketing & ads", fr: "Marketing et publicité" } },
      { to: "/services/social-media", label: { en: "Social media", fr: "Réseaux sociaux" } },
      { to: "/services/local-listings", label: { en: "Local listings", fr: "Fiches locales" } },
      { to: "/seo", label: { en: "SEO TAKATAK", fr: "SEO TAKATAK" } },
      { to: "/foodhub", label: { en: "Food Hub", fr: "Food Hub" } },
      { to: "/clover", label: { en: "Clover suite", fr: "Suite Clover" } },
      { to: "/services/reviews", label: { en: "Reviews & reputation", fr: "Avis et réputation" } },
      { to: "/services/ai-studio", label: { en: "AI Studio", fr: "AI Studio" } },
      { to: "/takbot", label: { en: "TAK-TAK AI", fr: "TAK-TAK IA" } },
      { to: "/services/billing", label: { en: "Billing & invoicing", fr: "Facturation" } },
      { to: "/services/voip", label: { en: "Business phone · MIMT", fr: "Téléphonie d'affaires · MIMT" } },
    ],
  },
  {
    title: { en: "Company", fr: "Entreprise" },
    links: [
      { to: "/", label: { en: "About TAKATAK", fr: "À propos de TAKATAK" } },
      // Shown once src/lib/website/owned-brands.ts lists a confirmed brand.
      ...(hasOwnedBrands ? [{ to: "/ecosystem", label: { en: "Our brands", fr: "Nos marques" } }] : []),
      { to: "/deals", label: { en: "Today's Deals", fr: "Offres du jour" } },
      { to: "/login", label: { en: "Sign in", fr: "Connexion" } },
      { to: "/register", label: { en: "Get started", fr: "Commencer" } },
      { to: "/privacy-manager", label: { en: "Privacy manager", fr: "Gestion de la confidentialité" } },
      { to: "/terms", label: { en: "Terms of Service", fr: "Conditions d'utilisation" } },
      { to: "/privacy", label: { en: "Privacy Policy", fr: "Politique de confidentialité" } },
    ],
  },
];

const POSITIONING: Bi = { en: brand.positioning, fr: "Des services en ligne gérés pour les entreprises en croissance." };

export function SiteFooter() {
  const { lang } = useLanguage();
  const l = lang === "fr" ? "fr" : "en";
  return (
    <footer className="brand-dark border-t border-border mt-24 relative">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, var(--brand-accent-cyan), var(--brand-accent-violet), transparent)" }}
      />
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-10">
          <div className="col-span-2 md:col-span-1">
            <h3 className="flex items-center gap-1.5">
              <TakatakLogo />
            </h3>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">{POSITIONING[l]}</p>
            <p className="mt-6 text-xs text-muted-foreground">{brand.supportEmail}</p>
          </div>
          {cols.map((col) => (
            <div key={col.title.en}>
              <h4 className="text-sm font-semibold mb-4">{col.title[l]}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map((link) => {
                  const linkProps = link.params ? { to: link.to, params: link.params as never } : { to: link.to };
                  return (
                    <li key={`${col.title.en}-${link.label.en}`}>
                      <Link {...linkProps} className="hover:text-foreground transition-colors">
                        {link.label[l]}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-12 pt-8 flex flex-col sm:flex-row gap-3 justify-between text-xs text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {brand.legalName}. {brand.domain}
          </p>
          <p>{POSITIONING[l]}</p>
          <nav aria-label={l === "fr" ? "Langue de la page d'accueil" : "Homepage language"} className="flex gap-4">
            {/* Full document navigation also refreshes the root HTML language and server metadata. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/?lang=fr" hrefLang="fr-CA" lang="fr" className="hover:text-foreground">Français</a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/?lang=en" hrefLang="en-CA" lang="en" className="hover:text-foreground">English</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
