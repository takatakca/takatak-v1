"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Globe,
  Languages,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  Receipt,
  Server,
  Share2,
  Sparkles,
  Store,
  Users,
  Wrench,
  MapPin,
  type LucideIcon,
} from "lucide-react";

import { NavyBackdrop } from "@/components/website/premium/ui";
import { homeCopy, SUITE_GROUPS, type SuiteGroup, type SuiteProduct, type SuiteStatus } from "@/lib/website/home-funnel";
import { Link } from "@/lib/website/nav";
import { externalLinkProps } from "@/lib/website/product-destinations";
import { useLanguage } from "@/lib/website/use-language";

type Bi = { en: string; fr: string };

/** The services, in the order of the brand reference (BRAND.md). */
const SERVICES: readonly { icon: LucideIcon; label: Bi; to: string }[] = [
  { icon: Globe, label: { en: "Websites", fr: "Sites web" }, to: "/services/websites" },
  { icon: Server, label: { en: "Hosting", fr: "Hébergement" }, to: "/hosting" },
  { icon: Globe, label: { en: "Domains", fr: "Domaines" }, to: "/domain" },
  { icon: Megaphone, label: { en: "Marketing and ads", fr: "Marketing et publicité" }, to: "/services/marketing" },
  { icon: Share2, label: { en: "Social media", fr: "Réseaux sociaux" }, to: "/services/social-media" },
  { icon: MapPin, label: { en: "Local listings", fr: "Fiches locales" }, to: "/services/local-listings" },
  { icon: Users, label: { en: "CRM and leads", fr: "CRM et prospects" }, to: "/services/lead-generation" },
  { icon: Sparkles, label: { en: "AI tools", fr: "Outils d’IA" }, to: "/services/ai-business-tools" },
  { icon: Store, label: { en: "Marketplace", fr: "Marketplace" }, to: "/marketplace" },
  { icon: MessagesSquare, label: { en: "Support", fr: "Soutien" }, to: "/contact" },
];

/** Where each TAKATAK product is described on this site. Products without a page here open their own site. */
const PRODUCT_PAGE: Partial<Record<string, string>> = {
  foodhub: "/foodhub",
  c4isse: "/clover",
  t4ctile: "/clover",
  "4ccounting": "/clover",
  tr4cker: "/clover",
  st4ff: "/clover",
  m4rketing: "/clover",
  loy4lty: "/clover",
  rew4rd: "/clover",
  ch4t: "/clover",
  seo: "/seo",
};

const PRINCIPLES: readonly { icon: LucideIcon; title: Bi; body: Bi }[] = [
  {
    icon: Languages,
    title: { en: "French first, English alongside", fr: "En français d’abord, en anglais aussi" },
    body: { en: "Every page, dashboard and message exists in both languages.", fr: "Chaque page, tableau de bord et message existe dans les deux langues." },
  },
  {
    icon: Receipt,
    title: { en: "The price before you buy", fr: "Le prix avant d’acheter" },
    body: { en: "Starting prices are public, in Canadian dollars before taxes. Custom work gets a quote first.", fr: "Les prix de départ sont publics, en dollars canadiens avant taxes. Le travail sur mesure reçoit d’abord une soumission." },
  },
  {
    icon: LayoutDashboard,
    title: { en: "One dashboard for everything", fr: "Un seul tableau de bord" },
    body: { en: "Websites, domains, campaigns, invoices and support live in the same account.", fr: "Sites, domaines, campagnes, factures et soutien vivent dans le même compte." },
  },
  {
    icon: Wrench,
    title: { en: "We set it up with you", fr: "On met tout en place avec vous" },
    body: { en: "After you sign up, the team follows up to set up your services.", fr: "Après l’inscription, l’équipe fait le suivi pour mettre vos services en place." },
  },
];

const DOT: Record<SuiteStatus, string> = {
  live: "bg-emerald-400",
  early: "bg-sky-300",
  clover: "bg-slate-400",
  soon: "bg-amber-300",
  planned: "bg-amber-300",
};

function ProductRow({ p }: { p: SuiteProduct }) {
  const { lang } = useLanguage();
  const page = PRODUCT_PAGE[p.key];
  const inner = (
    <>
      <span className="flex items-center gap-2 text-[15px] font-bold text-white">
        {p.name}
        {p.url && !page && <ArrowUpRight size={14} className="text-white/55" aria-hidden />}
      </span>
      <span className="mt-0.5 block text-[13.5px] leading-5 text-white/65">{p.desc[lang]}</span>
      <span className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-white/70">
        <span className={`h-1.5 w-1.5 rounded-full ${DOT[p.status]}`} aria-hidden />
        {homeCopy.suite.status[p.status][lang]}
      </span>
    </>
  );
  const cls = "flex h-full flex-col rounded-2xl px-4 py-3.5 transition-colors";
  if (page) {
    return (
      <Link to={page} className={`${cls} hover:bg-white/[0.05]`}>
        {inner}
      </Link>
    );
  }
  if (p.url) {
    return (
      <a href={p.url} {...externalLinkProps} className={`${cls} hover:bg-white/[0.05]`}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function ProductGroup({ group, wide = false }: { group: SuiteGroup; wide?: boolean }) {
  const { lang } = useLanguage();
  return (
    <div className={`tk-glass rounded-3xl p-3 sm:p-4 ${wide ? "lg:col-span-2" : ""}`}>
      <h3 className="px-4 pb-1 pt-2 text-[17px] font-bold text-white">{group.title[lang]}</h3>
      <p className="max-w-2xl px-4 pb-2 text-[13.5px] leading-5 text-white/60">{group.lead[lang]}</p>
      <div className={`grid grid-cols-1 ${wide ? "sm:grid-cols-2" : ""}`}>
        {group.products.map((p) => (
          <ProductRow key={p.key} p={p} />
        ))}
      </div>
    </div>
  );
}

/** /about: who GROUPE TAKATAK is, what it delivers and the products it builds. */
export function AboutContent() {
  const { lang } = useLanguage();
  const c = (v: Bi) => v[lang];

  return (
    <div className="tk-page tk-premium brand-dark bg-[#060D1F] text-white">
      <section aria-labelledby="about-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-12 sm:pt-16 lg:pb-16 lg:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden /> GROUPE TAKATAK · Montréal
          </p>
          <h1 id="about-title" className="tk-gradient-text mt-6 max-w-4xl text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
            {lang === "fr" ? "Solutions numériques. Vrais résultats." : "Digital Solutions. Real Results."}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-[17px]">
            {lang === "fr"
              ? "TAKATAK est une entreprise de Montréal qui bâtit, héberge et fait grandir la présence en ligne des entreprises, avec ses propres logiciels : sites web, marketing, automatisation, IA et outils pour les restaurants."
              : "TAKATAK is a Montréal company that builds, hosts and grows businesses online with its own software: websites, marketing, automation, AI and tools for restaurants."}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/services" className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold">
              {lang === "fr" ? "Voir les services" : "See the services"} <ArrowRight size={15} aria-hidden />
            </Link>
            <Link to="/contact" className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold">
              {lang === "fr" ? "Nous écrire" : "Write to us"}
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-20">
        <section aria-labelledby="about-services" className="mt-4">
          <h2 id="about-services" className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-300">
            {lang === "fr" ? "Ce que nous faisons" : "What we do"}
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {SERVICES.map((s) => (
              <li key={s.to}>
                <Link to={s.to} className="tk-glass tk-lift flex h-full items-center gap-3 rounded-2xl p-4">
                  <s.icon size={18} className="shrink-0 text-sky-300" aria-hidden />
                  <span className="text-[14.5px] font-semibold text-white">{c(s.label)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="about-products" className="mt-14">
          <h2 id="about-products" className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-300">
            {lang === "fr" ? "Nos produits" : "Our products"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            {lang === "fr"
              ? "Chaque produit affiche son vrai statut. Ceux qui ont leur propre site s’ouvrent dans un nouvel onglet (flèche)."
              : "Each product shows its real status. Those with their own site open in a new tab (arrow)."}
          </p>
          {/* Restaurants (ten products) take two columns; the two shorter groups share the third. */}
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {SUITE_GROUPS.slice(0, 1).map((group) => (
              <ProductGroup key={group.key} group={group} wide />
            ))}
            <div className="flex flex-col gap-4">
              {SUITE_GROUPS.slice(1).map((group) => (
                <ProductGroup key={group.key} group={group} />
              ))}
            </div>
          </div>
          <Link to="/takbot" className="tk-glass tk-lift group mt-4 flex items-center gap-4 rounded-3xl p-5">
            <span aria-hidden className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1F8BFF,#29C3FF)] text-white">
              <Bot size={19} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-bold text-white">TAK-TAK {lang === "fr" ? "IA" : "AI"}</span>
              <span className="mt-0.5 block text-[14px] leading-6 text-white/65">
                {lang === "fr" ? "L’assistant IA de TAKATAK : écrire, chercher, créer des images et plus, avec des crédits." : "TAKATAK’s AI assistant: write, research, create images and more, with credits."}
              </span>
            </span>
            <ArrowRight size={16} className="shrink-0 text-sky-300 transition-transform group-hover:translate-x-1" aria-hidden />
          </Link>
        </section>

        <section aria-labelledby="about-how" className="mt-14">
          <h2 id="about-how" className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-300">
            {lang === "fr" ? "Notre façon de travailler" : "How we work"}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((p) => (
              <div key={p.title.en} className="tk-glass rounded-2xl p-5">
                <p.icon size={20} className="text-sky-300" aria-hidden />
                <h3 className="mt-3 text-[16px] font-bold text-white">{c(p.title)}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-white/65">{c(p.body)}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="about-next" className="tk-glass mt-14 flex flex-col items-start justify-between gap-5 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <h2 id="about-next" className="text-xl font-bold text-white">
              {lang === "fr" ? "Un projet, une question ?" : "A project, a question?"}
            </h2>
            <p className="mt-1.5 text-sm text-white/65">
              {lang === "fr" ? "Écrivez-nous ou décrivez votre projet : une personne vous répond." : "Write to us or describe your project: a person answers."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/contact" className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold">
              {lang === "fr" ? "Nous joindre" : "Contact us"} <ArrowRight size={15} aria-hidden />
            </Link>
            <Link to="/freelancers" className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold">
              {lang === "fr" ? "Travailler avec nous" : "Work with us"}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
