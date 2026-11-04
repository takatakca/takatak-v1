"use client";

import {
  ArrowRight,
  BadgeCheck,
  Ban,
  Check,
  ChevronDown,
  Clock3,
  FileSearch,
  FileText,
  Gauge,
  Globe2,
  Link2,
  ListChecks,
  Lock,
  MapPin,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";

import { Reveal } from "@/components/website/home/Reveal";
import { useHeaderHeight } from "@/components/website/premium/CategoryNavigator";
import { LiveLaptop, useScenePlayer } from "@/components/website/premium/LiveScenes";
import { NavyBackdrop } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { SEO_FREE_TOOLS, type SeoTool } from "@/lib/seo/free-tools-catalog";
import { SEO_CATEGORY_FR, SEO_TOOL_FR } from "@/lib/seo/free-tools-fr";
import { MARKETPLACE_PACKAGES } from "@/lib/website/marketplace-packages";
import { fastestDelivery, packageTitle, startingPrice } from "@/lib/website/marketplace-i18n";
import { Link } from "@/lib/website/nav";
import { useInViewport } from "@/lib/website/use-in-viewport";
import { useLanguage } from "@/lib/website/use-language";

type T = { fr: string; en: string };
type State = "live" | "early" | "provider" | "planned";

const STATE: Record<State, { label: T; cls: string }> = {
  live: { label: { fr: "En ligne", en: "Live" }, cls: "bg-emerald-400/15 text-emerald-300 ring-emerald-300/30" },
  early: { label: { fr: "Accès anticipé", en: "Early access" }, cls: "bg-sky-400/15 text-sky-300 ring-sky-300/30" },
  provider: { label: { fr: "Avec une source de données branchée", en: "With a connected data source" }, cls: "bg-white/10 text-white/70 ring-white/20" },
  planned: { label: { fr: "Prévu", en: "Planned" }, cls: "bg-amber-400/15 text-amber-300 ring-amber-300/30" },
};

function Pill({ state }: { state: State }) {
  const { tx } = useLanguage();
  const s = STATE[state];
  return <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${s.cls}`}>{tx(s.label)}</span>;
}

const SECTIONS: { id: string; label: T }[] = [
  { id: "seo-why", label: { fr: "Pourquoi", en: "Why" } },
  { id: "seo-included", label: { fr: "Inclus", en: "Included" } },
  { id: "seo-how", label: { fr: "Comment ça marche", en: "How it works" } },
  { id: "seo-dashboard", label: { fr: "Tableau de bord", en: "Dashboard" } },
  { id: "seo-tools", label: { fr: "Outils gratuits", en: "Free tools" } },
  { id: "seo-start", label: { fr: "Forfaits", en: "Packages" } },
  { id: "seo-data", label: { fr: "Données", en: "Data" } },
  { id: "seo-faq", label: { fr: "FAQ", en: "FAQ" } },
];

/** What SEO TAKATAK does, each with its real state (src/app/dashboard/seo, the SEOTAKATAK service). */
const FEATURES: { icon: typeof Search; state: State; t: T; d: T }[] = [
  {
    icon: FileSearch,
    state: "live",
    t: { fr: "Audit de site", en: "Site audit" },
    d: {
      fr: "Contrôle la page, le fichier robots.txt et le plan du site (sitemap). Le score est gardé dans votre espace pour suivre les progrès, avec un rapport PDF. Le code HTML de votre page n’est pas conservé.",
      en: "Checks the page, robots.txt and the sitemap. The score is kept in your workspace to follow progress, with a PDF report. Your page's HTML is not stored.",
    },
  },
  {
    icon: Gauge,
    state: "live",
    t: { fr: "Vitesse et Core Web Vitals", en: "Speed and Core Web Vitals" },
    d: {
      fr: "Les mêmes mesures de vitesse que Google utilise (Google PageSpeed Insights), sur mobile et ordinateur, avec ce qu’il faut corriger en premier.",
      en: "The same speed measures Google uses (Google PageSpeed Insights), on mobile and desktop, with what to fix first.",
    },
  },
  {
    icon: Wrench,
    state: "live",
    t: { fr: "15 outils gratuits", en: "15 free tools" },
    d: {
      fr: "robots.txt, sitemap, balise canonique, H1, méta-description, Open Graph, schéma JSON-LD, llms.txt, aperçu Google et plus, avec votre compte TAKATAK gratuit.",
      en: "robots.txt, sitemap, canonical tag, H1, meta description, Open Graph, JSON-LD schema, llms.txt, Google preview and more, with your free TAKATAK account.",
    },
  },
  {
    icon: BadgeCheck,
    state: "early",
    t: { fr: "Vos sites, prouvés à vous", en: "Your sites, proven yours" },
    d: {
      fr: "Chaque site est ajouté à votre espace et vérifié par un enregistrement DNS (TXT) valide sept jours. Personne d’autre ne voit vos données.",
      en: "Each site is added to your workspace and verified with a DNS record (TXT) valid seven days. Nobody else sees your data.",
    },
  },
  {
    icon: Search,
    state: "early",
    t: { fr: "Opportunités Search Console", en: "Search Console opportunities" },
    d: {
      fr: "Vos vraies requêtes Google (clics, impressions, position) avec un score de priorité expliqué : on voit pourquoi un mot-clé passe avant un autre. Export CSV.",
      en: "Your real Google queries (clicks, impressions, position) with an explained priority score: you see why one keyword comes first. CSV export.",
    },
  },
  {
    icon: FileText,
    state: "early",
    t: { fr: "Briefs de contenu relus", en: "Reviewed content briefs" },
    d: {
      fr: "Chaque idée d’article commence en brouillon et passe par une personne qui l’approuve ou la refuse avec une raison. Rien n’est publié tout seul.",
      en: "Every article idea starts as a draft and goes through a person who approves it or turns it down with a reason. Nothing is published on its own.",
    },
  },
  {
    icon: Link2,
    state: "early",
    t: { fr: "Liens éditoriaux, sans achat", en: "Editorial links, never bought" },
    d: {
      fr: "Suivi des sites à approcher (repéré, en recherche, contacté, refusé). Aucun paquet de liens acheté, aucun échange automatique.",
      en: "Tracking of the sites to approach (found, researching, contacted, declined). No bought link packages, no automated swaps.",
    },
  },
  {
    icon: MapPin,
    state: "provider",
    t: { fr: "Mots-clés et carte locale", en: "Keywords and the local map" },
    d: {
      fr: "Où vous sortez sur Google et dans le « map pack » de votre quartier, une fois une source de classement branchée. Avec QMAPS et vos fiches locales.",
      en: "Where you show on Google and in your area's map pack, once a ranking source is connected. With QMAPS and your local listings.",
    },
  },
  {
    icon: Sparkles,
    state: "provider",
    t: { fr: "Visibilité dans les réponses d’IA", en: "Visibility in AI answers" },
    d: {
      fr: "Préparation de votre site pour les assistants d’IA (GEO), en ligne aujourd’hui. Les citations réelles dans ChatGPT, Perplexity ou les aperçus IA de Google se mesurent avec une source vérifiée.",
      en: "Getting your site ready for AI assistants (GEO), live today. Real citations in ChatGPT, Perplexity or Google's AI Overviews are measured with a verified source.",
    },
  },
];

const STEPS: { t: T; d: T }[] = [
  { t: { fr: "Créez votre compte", en: "Create your account" }, d: { fr: "Un seul compte TAKATAK, gratuit. Pas de carte pour les outils gratuits.", en: "One free TAKATAK account. No card for the free tools." } },
  { t: { fr: "Ajoutez votre site", en: "Add your site" }, d: { fr: "Vous prouvez qu’il est à vous avec un enregistrement DNS ; on vous montre quoi copier.", en: "You prove it is yours with a DNS record; we show you what to copy." } },
  { t: { fr: "Audit et vitesse", en: "Audit and speed" }, d: { fr: "Score, pages lentes, balises manquantes : la liste de ce qui bloque, par ordre d’importance.", en: "Score, slow pages, missing tags: the list of what holds you back, by importance." } },
  { t: { fr: "Branchez Search Console", en: "Connect Search Console" }, d: { fr: "Vos vraies données Google entrent ; les opportunités sont classées avec leur raison.", en: "Your real Google data comes in; opportunities are ranked with their reason." } },
  { t: { fr: "Plan d’action", en: "Action plan" }, d: { fr: "Contenu à écrire, liens à approcher, fiches locales à corriger. On le fait avec vous, ou pour vous.", en: "Content to write, links to approach, local listings to fix. Done with you, or for you." } },
];

const SCREENS: { screen: T; shows: T; state: State }[] = [
  { screen: { fr: "SEO · Audit de site", en: "SEO · Site audit" }, shows: { fr: "Score, contrôles de page, robots.txt, sitemap, rapport PDF", en: "Score, page checks, robots.txt, sitemap, PDF report" }, state: "live" },
  { screen: { fr: "SEO · Vitesse", en: "SEO · Speed" }, shows: { fr: "Core Web Vitals mobile et ordinateur (PageSpeed)", en: "Core Web Vitals, mobile and desktop (PageSpeed)" }, state: "live" },
  { screen: { fr: "SEO · Historique", en: "SEO · History" }, shows: { fr: "Scores dans le temps, par site", en: "Scores over time, per site" }, state: "live" },
  { screen: { fr: "SEO · Outils gratuits", en: "SEO · Free tools" }, shows: { fr: "Les outils qui fonctionnent aujourd’hui, et ceux qui attendent une source de données", en: "The tools that work today, and those waiting for a data source" }, state: "live" },
  { screen: { fr: "SEO · Portefeuille", en: "SEO · Portfolio" }, shows: { fr: "Vos sites vérifiés, requêtes Search Console importées", en: "Your verified sites, imported Search Console queries" }, state: "early" },
  { screen: { fr: "SEO · Exports", en: "SEO · Exports" }, shows: { fr: "Sites, opportunités, prospects, briefs en JSON ou CSV", en: "Sites, opportunities, prospects, briefs as JSON or CSV" }, state: "early" },
  { screen: { fr: "SEO · Mots-clés", en: "SEO · Keywords" }, shows: { fr: "Positions Google et carte locale", en: "Google positions and the local map" }, state: "provider" },
  { screen: { fr: "SEO · Liens", en: "SEO · Backlinks" }, shows: { fr: "Liens gagnés, vérifiés par une source indépendante", en: "Earned links, verified by an independent source" }, state: "planned" },
];

const START_PACKAGES = ["local-seo-setup", "gbp-optimization", "citation-package", "qmaps-listing-setup"];

const NEVER: T[] = [
  { fr: "Aucune première place garantie sur Google : personne ne peut la promettre honnêtement.", en: "No guaranteed first place on Google: nobody can honestly promise it." },
  { fr: "Aucun lien acheté, aucun réseau de sites, aucun échange automatique.", en: "No bought links, no site networks, no automated swaps." },
  { fr: "Aucun chiffre inventé : une mesure vient d’une source branchée, ou elle n’est pas affichée.", en: "No invented numbers: a measure comes from a connected source, or it is not shown." },
  { fr: "Aucun texte publié sans qu’une personne l’ait relu.", en: "No text published without a person reading it." },
];

const FAQ: { q: T; a: T }[] = [
  {
    q: { fr: "Combien de temps avant de voir des résultats ?", en: "How long before results show?" },
    a: {
      fr: "Les corrections techniques (vitesse, balises, sitemap) se voient dans les outils en quelques jours. Le classement dans Google bouge en général sur plusieurs semaines ou mois, selon votre secteur et votre concurrence. On vous montre l’évolution avec vos vraies données Search Console.",
      en: "Technical fixes (speed, tags, sitemap) show in the tools within days. Google rankings usually move over weeks or months, depending on your field and competition. We show the trend with your real Search Console data.",
    },
  },
  {
    q: { fr: "Est-ce que je dois donner mon mot de passe Google ?", en: "Do I have to give my Google password?" },
    a: {
      fr: "Non. Dans votre Search Console, vous donnez à TAKATAK un accès en lecture à votre site, comme à un employé ; votre site se prouve par un enregistrement DNS. Vous retirez l’accès en tout temps, dans Google.",
      en: "No. In your Search Console, you give TAKATAK read access to your site, like you would an employee; your site is proven with a DNS record. You remove access at any time, in Google.",
    },
  },
  {
    q: { fr: "Les outils gratuits sont-ils vraiment gratuits ?", en: "Are the free tools really free?" },
    a: {
      fr: "Oui, avec un compte TAKATAK gratuit, sans carte. Ceux qui ont besoin d’une source de données externe (citations IA, classements) l’indiquent clairement.",
      en: "Yes, with a free TAKATAK account and no card. The ones that need an outside data source (AI citations, rankings) say so clearly.",
    },
  },
  {
    q: { fr: "Faites-vous le SEO local (Google Maps) ?", en: "Do you do local SEO (Google Maps)?" },
    a: {
      fr: "Oui : fiche d’entreprise Google, inscriptions dans les annuaires, QMAPS, heures et photos à jour partout. C’est souvent le gain le plus rapide pour un commerce de quartier.",
      en: "Yes: Google Business Profile, directory listings, QMAPS, hours and photos up to date everywhere. It is often the fastest win for a neighbourhood business.",
    },
  },
  {
    q: { fr: "Qui voit mes données ?", en: "Who sees my data?" },
    a: {
      fr: "Votre espace seulement. Chaque demande au service SEO porte un jeton signé valide 60 secondes, lié à votre espace ; un autre client ne peut ni lire ni comparer vos chiffres. Vous pouvez exporter ou supprimer vos données SEO.",
      en: "Your workspace only. Every request to the SEO service carries a signed token valid 60 seconds, tied to your workspace; another client cannot read or compare your numbers. You can export or delete your SEO data.",
    },
  },
  {
    q: { fr: "Je n’ai pas de site TAKATAK. Est-ce que ça marche quand même ?", en: "I don't have a TAKATAK site. Does it still work?" },
    a: {
      fr: "Oui. L’audit, la vitesse et Search Console marchent avec n’importe quel site public (WordPress, Shopify, Wix ou sur mesure). Les corrections dans le code se font par votre développeur ou par notre équipe.",
      en: "Yes. The audit, speed and Search Console work with any public site (WordPress, Shopify, Wix or custom). Code fixes are made by your developer or by our team.",
    },
  },
];

function Section({ id, title, sub, tinted = false, children }: { id: string; title: string; sub?: string; tinted?: boolean; children: React.ReactNode }) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`relative py-16 sm:py-24 ${tinted ? "bg-[linear-gradient(180deg,rgb(11_27_61/0.55),rgb(11_27_61/0.25))]" : ""}`}
      style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.06]" />
      <div className="mx-auto max-w-7xl px-4">
        <Reveal className="mb-10 max-w-3xl sm:mb-12">
          <h2 id={`${id}-title`} className="text-3xl font-extrabold tracking-[-0.025em] text-white sm:text-[40px]">
            {title}
          </h2>
          {sub && <p className="mt-3 text-base leading-7 text-white/65">{sub}</p>}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function HeroScreen() {
  const { tx, lang } = useLanguage();
  const [ref, inView] = useInViewport<HTMLDivElement>({ once: false, threshold: 0.2 });
  const step = useScenePlayer(inView, "seo");
  return (
    <div ref={ref}>
      <LiveLaptop scene="seo" step={step} business="" lang={lang} address="takatak.ca/dashboard/seo" tab="SEO TAKATAK" />
      <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/35">{tx({ fr: "Aperçu à titre illustratif", en: "Illustrative preview" })}</p>
    </div>
  );
}

/** The full SEO TAKATAK product page (/seo): what it does today, how, for how much, and what it never does. */
export function SeoProductPage() {
  const { tx, lang } = useLanguage();
  useHeaderHeight();
  const liveTools = SEO_FREE_TOOLS.filter((t) => t.mode !== "provider").length;
  const providerTools = SEO_FREE_TOOLS.length - liveTools;
  const categories = Array.from(new Set(SEO_FREE_TOOLS.map((t) => t.category)));
  const packages = START_PACKAGES.map((id) => MARKETPLACE_PACKAGES.find((p) => p.id === id)).filter((p): p is (typeof MARKETPLACE_PACKAGES)[number] => Boolean(p));
  const toolName = (t: SeoTool) => (lang === "fr" ? SEO_TOOL_FR[t.id]?.title ?? t.title : t.title);

  return (
    <div className="tk-page tk-premium brand-dark bg-[#060D1F] text-white">
      {/* 1. Promise */}
      <section aria-labelledby="seo-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden /> SEO TAKATAK · {tx({ fr: "Accès anticipé", en: "Early access" })}
            </p>
            <h1 id="seo-title" className="tk-gradient-text mt-6 text-balance text-[38px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
              {tx({ fr: "Soyez trouvé sur Google, sur la carte et dans les réponses d’IA.", en: "Get found on Google, on the map and in AI answers." })}
            </h1>
            <p className="mt-5 text-base leading-7 text-white/72 sm:text-[17px]">
              {tx({
                fr: "Un audit de votre site, la vitesse que Google mesure, vos vraies données Search Console et un plan d’action clair. Fait avec vous ou pour vous, en français et en anglais, sans promesse impossible.",
                en: "An audit of your site, the speed Google measures, your real Search Console data and a clear action plan. Done with you or for you, in French and English, with no impossible promise.",
              })}
            </p>
            <ul className="mt-6 grid gap-2.5 text-[15px] text-white/88">
              {[
                { fr: `${liveTools} outils gratuits qui fonctionnent aujourd’hui`, en: `${liveTools} free tools that work today` },
                { fr: "Audit de site et Core Web Vitals en ligne", en: "Site audit and Core Web Vitals live" },
                { fr: "Aucun lien acheté, aucun chiffre inventé", en: "No bought links, no invented numbers" },
              ].map((l) => (
                <li key={l.fr} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                    <Check size={12} strokeWidth={3} aria-hidden />
                  </span>
                  {tx(l)}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                {tx({ fr: "Faire l’audit gratuit", en: "Run the free audit" })} <ArrowRight size={16} aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/seo", intent: "seo_page", lang })}
                className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold"
              >
                {tx({ fr: "Parler à un spécialiste", en: "Talk to a specialist" })}
              </button>
            </div>
          </div>
          <div className="lg:col-span-7">
            <HeroScreen />
          </div>
        </div>
      </section>

      {/* In-page menu */}
      <nav aria-label={tx({ fr: "Sur cette page", en: "On this page" })} className="sticky z-30 border-y border-white/[0.08] bg-[#060D1F]/95 backdrop-blur-xl" style={{ top: "var(--tk-header-h, 64px)" }}>
        <ul className="tk-no-scrollbar mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-2.5">
          {SECTIONS.map((s) => (
            <li key={s.id} className="shrink-0">
              <a href={`#${s.id}`} className="inline-flex rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white/65 transition-colors hover:border-sky-300/50 hover:text-white">
                {tx(s.label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 2. Why */}
      <Section
        id="seo-why"
        title={tx({ fr: "Pourquoi le SEO, avant la publicité", en: "Why SEO, before ads" })}
        sub={tx({
          fr: "La publicité s’arrête quand le budget s’arrête. Le référencement naturel continue de vous amener des clients : ceux qui tapent « près de moi », comparent les avis, ou demandent à une IA quoi choisir.",
          en: "Ads stop when the budget stops. Organic search keeps bringing customers: people who type \"near me\", compare reviews, or ask an AI what to choose.",
        })}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Globe2, t: { fr: "Google", en: "Google" }, d: { fr: "Les pages rapides, claires et bien balisées sortent mieux. C’est la base, et c’est mesurable.", en: "Fast, clear, well-tagged pages show better. It is the base, and it is measurable." } },
            { icon: MapPin, t: { fr: "La carte locale", en: "The local map" }, d: { fr: "Fiche Google, annuaires, QMAPS, avis : c’est là que se choisit le resto ou le plombier du quartier.", en: "Google profile, directories, QMAPS, reviews: that's where the neighbourhood restaurant or plumber gets picked." } },
            { icon: Sparkles, t: { fr: "Les réponses d’IA", en: "AI answers" }, d: { fr: "Les assistants citent les sites qu’ils comprennent. On prépare le vôtre (données structurées, llms.txt, contenu clair).", en: "Assistants cite the sites they understand. We get yours ready (structured data, llms.txt, clear content)." } },
          ].map((c, i) => (
            <Reveal key={c.t.en} delay={i * 80}>
              <div className="tk-glass h-full rounded-2xl p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
                  <c.icon size={20} aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-bold">{tx(c.t)}</h3>
                <p className="mt-2 text-[15px] leading-6 text-white/65">{tx(c.d)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* 3. Included */}
      <Section
        id="seo-included"
        tinted
        title={tx({ fr: "Ce qui est inclus, avec son état réel", en: "What's included, with its real state" })}
        sub={tx({ fr: "« En ligne » fonctionne aujourd’hui. « Accès anticipé » est ouvert à nos premiers clients. Rien n’est caché.", en: "\"Live\" works today. \"Early access\" is open to our first clients. Nothing is hidden." })}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal as="li" key={f.t.en} delay={(i % 3) * 80}>
              <div className="tk-glass tk-lift h-full rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
                    <f.icon size={20} aria-hidden />
                  </span>
                  <Pill state={f.state} />
                </div>
                <h3 className="mt-5 text-lg font-bold">{tx(f.t)}</h3>
                <p className="mt-2 text-[15px] leading-6 text-white/65">{tx(f.d)}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Section>

      {/* 4. How */}
      <Section id="seo-how" title={tx({ fr: "Comment ça marche", en: "How it works" })} sub={tx({ fr: "Cinq étapes, du premier audit au plan du mois.", en: "Five steps, from the first audit to the monthly plan." })}>
        <ol className="relative grid gap-4 md:grid-cols-5">
          <span aria-hidden className="absolute left-0 right-0 top-[27px] hidden h-px bg-[linear-gradient(90deg,transparent,rgb(41_195_255/0.6),transparent)] md:block" />
          {STEPS.map((s, i) => (
            <Reveal as="li" key={s.t.en} delay={i * 80} className="relative">
              <span className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1565D8,#29C3FF)] text-lg font-extrabold shadow-[0_14px_30px_-12px_#1F8BFF]">{i + 1}</span>
              <h3 className="mt-5 text-lg font-bold">{tx(s.t)}</h3>
              <p className="mt-2 text-[15px] leading-6 text-white/65">{tx(s.d)}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* 5. Dashboard table */}
      <Section
        id="seo-dashboard"
        tinted
        title={tx({ fr: "Ce que vous voyez dans le tableau de bord", en: "What you see in the dashboard" })}
        sub={tx({ fr: "Chaque écran du menu SEO, ce qu’il montre et son état.", en: "Each screen of the SEO menu, what it shows and its state." })}
      >
        <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-white/[0.06] text-[12px] uppercase tracking-[0.14em] text-white/55">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{tx({ fr: "Écran", en: "Screen" })}</th>
                <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">{tx({ fr: "Ce qu’il montre", en: "What it shows" })}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{tx({ fr: "État", en: "State" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {SCREENS.map((r) => (
                <tr key={r.screen.en} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3.5 font-semibold">
                    {tx(r.screen)}
                    <span className="mt-0.5 block text-[13px] font-normal text-white/55 sm:hidden">{tx(r.shows)}</span>
                  </td>
                  <td className="hidden px-4 py-3.5 text-white/70 sm:table-cell">{tx(r.shows)}</td>
                  <td className="px-4 py-3.5 text-right">
                    <Pill state={r.state} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 6. Free tools */}
      <Section
        id="seo-tools"
        title={tx({ fr: "Les outils gratuits", en: "The free tools" })}
        sub={tx({
          fr: `${liveTools} outils fonctionnent aujourd’hui avec votre compte gratuit. ${providerTools} autres attendent une source de données vérifiée, et le disent.`,
          en: `${liveTools} tools work today with your free account. ${providerTools} more wait for a verified data source, and say so.`,
        })}
      >
        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((c) => (
            <details key={c} className="tk-faq tk-glass group rounded-2xl px-5 py-4 open:bg-white/[0.06]" open={c === "Technical SEO"}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[16px] font-bold">
                <span className="flex items-center gap-2">
                  <ListChecks size={18} className="text-sky-300" aria-hidden />
                  {lang === "fr" ? SEO_CATEGORY_FR[c] ?? c : c}
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/70">{SEO_FREE_TOOLS.filter((t) => t.category === c).length}</span>
                </span>
                <ChevronDown size={18} className="tk-faq-chevron shrink-0 text-white/50" aria-hidden />
              </summary>
              <ul className="mt-3 grid gap-2">
                {SEO_FREE_TOOLS.filter((t) => t.category === c).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.04] px-3 py-2 text-[14px]">
                    <span>{toolName(t)}</span>
                    <Pill state={t.mode === "provider" ? "provider" : "live"} />
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/free-tools" className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold">
            {tx({ fr: "Voir tous les outils", en: "See every tool" })} <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </Section>

      {/* 7. Packages to start */}
      <Section
        id="seo-start"
        tinted
        title={tx({ fr: "Pour démarrer : forfaits faits pour vous", en: "To start: packages done for you" })}
        sub={tx({ fr: "Prix de départ du catalogue, avant taxes. Le détail de chaque forfait s’ouvre en un clic.", en: "Catalog starting prices, before taxes. Each package's details open in one click." })}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {packages.map((p) => (
            <Link
              key={p.id}
              to="/marketplace/gigs/$id"
              params={{ id: p.slug }}
              className="group flex items-center justify-between gap-4 rounded-2xl bg-white/[0.04] px-5 py-4 ring-1 ring-white/10 transition-all hover:-translate-y-0.5 hover:bg-white/[0.07] hover:ring-sky-300/40"
            >
              <span>
                <span className="block text-[16px] font-bold">{packageTitle(p, lang)}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[13px] text-white/55">
                  <Clock3 size={12} aria-hidden /> {fastestDelivery(p, lang)}
                </span>
              </span>
              <span className="rounded-full bg-sky-400/15 px-3 py-1.5 text-[13px] font-semibold text-sky-200 transition-colors group-hover:bg-[#1F8BFF] group-hover:text-white">
                {startingPrice(p, lang)}
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-5 flex items-center gap-2 text-[14px] text-white/60">
          <Star size={14} className="text-amber-300" aria-hidden />
          {tx({ fr: "Avec QMAPS, votre commerce est ajouté sans frais au répertoire local du Québec.", en: "With QMAPS, your business is added at no cost to Québec's local directory." })}
        </p>
      </Section>

      {/* 8. Data and promises */}
      <Section id="seo-data" title={tx({ fr: "Vos données, et ce qu’on ne promet jamais", en: "Your data, and what we never promise" })}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="tk-glass rounded-2xl p-6">
            <p className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck size={20} className="text-emerald-300" aria-hidden /> {tx({ fr: "Vos données", en: "Your data" })}
            </p>
            <ul className="mt-4 grid gap-3 text-[15px] leading-6 text-white/72">
              {[
                { fr: "Votre espace seulement : un autre client ne voit jamais vos chiffres.", en: "Your workspace only: another client never sees your numbers." },
                { fr: "Chaque demande au service SEO porte un jeton signé qui expire en 60 secondes.", en: "Each request to the SEO service carries a signed token that expires in 60 seconds." },
                { fr: "Le code HTML de vos pages n’est pas conservé après l’audit.", en: "Your pages' HTML is not kept after the audit." },
                { fr: "Export de vos données en JSON ou CSV, et suppression d’un site avec reçu.", en: "Export your data as JSON or CSV, and delete a site with a receipt." },
              ].map((l) => (
                <li key={l.fr} className="flex gap-3">
                  <Lock size={15} className="mt-1 shrink-0 text-emerald-300" aria-hidden />
                  {tx(l)}
                </li>
              ))}
            </ul>
          </div>
          <div className="tk-glass rounded-2xl p-6">
            <p className="flex items-center gap-2 text-lg font-bold">
              <Ban size={20} className="text-amber-300" aria-hidden /> {tx({ fr: "Ce qu’on ne promet jamais", en: "What we never promise" })}
            </p>
            <ul className="mt-4 grid gap-3 text-[15px] leading-6 text-white/72">
              {NEVER.map((l) => (
                <li key={l.fr} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" aria-hidden />
                  {tx(l)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 9. FAQ */}
      <Section id="seo-faq" tinted title={tx({ fr: "Questions fréquentes", en: "Frequently asked questions" })}>
        <div className="mx-auto grid max-w-3xl gap-3">
          {FAQ.map((f) => (
            <details key={f.q.en} className="tk-faq tk-glass group rounded-2xl px-5 py-4 open:bg-white/[0.06]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-[15px] font-semibold">
                {tx(f.q)}
                <ChevronDown size={18} className="tk-faq-chevron shrink-0 text-white/50" aria-hidden />
              </summary>
              <p className="mt-3 text-[15px] leading-7 text-white/68">{tx(f.a)}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* 10. Start */}
      <section className="px-4 pb-20 pt-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0B1B3D,#1565D8_60%,#29C3FF)] p-8 text-center sm:p-12">
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">
            {tx({ fr: "Commencez par l’audit gratuit.", en: "Start with the free audit." })}
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-[16px] leading-7 text-white/80">
            {tx({ fr: "Compte gratuit, sans carte. Vous voyez votre score et la liste de ce qui bloque en quelques minutes.", en: "Free account, no card. You see your score and what holds you back in a few minutes." })}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link to="/register" className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[15px] font-bold text-[#0B1B3D] hover:bg-blue-50">
              {tx({ fr: "Créer mon compte", en: "Create my account" })} <ArrowRight size={16} aria-hidden />
            </Link>
            <Link to="/services/marketing" className="inline-flex items-center gap-2 rounded-xl border border-white/50 px-6 py-3.5 text-[15px] font-semibold hover:bg-white/10">
              {tx({ fr: "Voir le marketing", en: "See marketing" })}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
