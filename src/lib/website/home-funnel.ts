// Copy and data for the homepage below the hero (Oct 30 2026 funnel).
// English and Canadian French side by side. Prices are never written here:
// they come from core-categories.ts / pricing.ts / the AI credit catalog.
// Product statuses come from each product's own repository README.

import type { CategoryKey } from "./core-categories";
import type { Bi } from "./service-pages";

export type HomeSectionId = "services" | "plan" | "takbot" | "suite" | "pricing" | "faq";

export const HOME_SECTIONS: readonly { id: HomeSectionId; label: Bi }[] = [
  { id: "services", label: { en: "Services", fr: "Services" } },
  { id: "plan", label: { en: "Build my plan", fr: "Mon forfait" } },
  { id: "takbot", label: { en: "TAK bot AI", fr: "TAK bot IA" } },
  { id: "suite", label: { en: "Product suite", fr: "Nos produits" } },
  { id: "pricing", label: { en: "Pricing", fr: "Tarifs" } },
  { id: "faq", label: { en: "FAQ", fr: "FAQ" } },
];

export const homeCopy = {
  nav: {
    label: { en: "Homepage sections", fr: "Sections de la page" },
    start: { en: "Create my account", fr: "Créer mon compte" },
  },
  marquee: {
    label: { en: "One account. Every tool.", fr: "Un compte. Tous les outils." },
  },
  services: {
    kicker: { en: "01 · Services", fr: "01 · Services" },
    title: { en: "Everything your business runs on, in one place.", fr: "Tout ce qui fait tourner votre entreprise, au même endroit." },
    subtitle: {
      en: "Swipe through the ten services. Add the ones you need to your plan; the price updates as you go.",
      fr: "Faites défiler les dix services. Ajoutez ceux qu’il vous faut à votre forfait : le prix se met à jour en direct.",
    },
    add: { en: "Add to my plan", fr: "Ajouter au forfait" },
    added: { en: "In my plan", fr: "Dans mon forfait" },
    prev: { en: "Previous service", fr: "Service précédent" },
    next: { en: "Next service", fr: "Service suivant" },
    pause: { en: "Pause the slideshow", fr: "Mettre en pause" },
    play: { en: "Play the slideshow", fr: "Lancer le défilement" },
    slide: { en: "Service {n} of {total}", fr: "Service {n} sur {total}" },
  },
  plan: {
    kicker: { en: "02 · Build my plan", fr: "02 · Mon forfait" },
    title: { en: "Answer two questions. Get your plan and your price.", fr: "Deux questions. Votre forfait et votre prix." },
    subtitle: {
      en: "Our plan builder picks the services a business like yours starts with. Change anything, then create your account with it.",
      fr: "Notre outil choisit les services par lesquels une entreprise comme la vôtre commence. Modifiez tout, puis créez votre compte avec.",
    },
    step1: { en: "Your business", fr: "Votre entreprise" },
    step2: { en: "Your goals", fr: "Vos objectifs" },
    step3: { en: "Your plan", fr: "Votre forfait" },
    q1: { en: "What kind of business do you run?", fr: "Quel genre d’entreprise avez-vous ?" },
    q2: { en: "What do you want first? Pick one or more.", fr: "Que voulez-vous d’abord ? Choisissez-en un ou plusieurs." },
    q3: { en: "Here is your plan. Tap a service to add or remove it.", fr: "Voici votre forfait. Touchez un service pour l’ajouter ou l’enlever." },
    back: { en: "Back", fr: "Retour" },
    nextStep: { en: "Next", fr: "Suivant" },
    seePlan: { en: "See my plan", fr: "Voir mon forfait" },
    oneTime: { en: "one-time setup", fr: "mise en place unique" },
    monthly: { en: "per month", fr: "par mois" },
    yearly: { en: "per year", fr: "par année" },
    quoted: { en: "{n} on quote", fr: "{n} sur devis" },
    from: { en: "Starting from", fr: "À partir de" },
    note: {
      en: "Starting prices from our catalog, in Canadian dollars, before taxes. Services on quote are priced with you before any work.",
      fr: "Prix de départ de notre catalogue, en dollars canadiens, avant taxes. Les services sur devis sont chiffrés avec vous avant tout travail.",
    },
    cta: { en: "Create my account with this plan", fr: "Créer mon compte avec ce forfait" },
    chat: { en: "Review it with a person", fr: "Le revoir avec une personne" },
    empty: { en: "Pick at least one service.", fr: "Choisissez au moins un service." },
  },
  dock: {
    label: { en: "My plan", fr: "Mon forfait" },
    empty: { en: "Build your plan in 30 seconds", fr: "Votre forfait en 30 secondes" },
    services: { en: "{n} services", fr: "{n} services" },
    service: { en: "1 service", fr: "1 service" },
    build: { en: "Build my plan", fr: "Mon forfait" },
    cta: { en: "Create my account", fr: "Créer mon compte" },
    clear: { en: "Clear my plan", fr: "Vider mon forfait" },
  },
  takbot: {
    kicker: { en: "03 · TAK bot", fr: "03 · TAK bot" },
    title: { en: "One master bot. Every AI engine behind it.", fr: "Un bot maître. Tous les moteurs d’IA derrière lui." },
    subtitle: {
      en: "Ask TAK bot once. It picks the right engine for the job, or you choose it yourself. Pay with credits, only for what you use.",
      fr: "Demandez une fois à TAK bot. Il choisit le bon moteur pour la tâche, ou c’est vous qui choisissez. Payez en crédits, seulement ce que vous utilisez.",
    },
    cta: { en: "Open TAK bot", fr: "Ouvrir TAK bot" },
    credits: { en: "See credit packs", fr: "Voir les crédits" },
    relay: { en: "Relays to", fr: "Relaie vers" },
  },
  suite: {
    kicker: { en: "04 · Product suite", fr: "04 · Nos produits" },
    title: { en: "Built by TAKATAK. Connected to your account.", fr: "Conçus par TAKATAK. Branchés à votre compte." },
    subtitle: {
      en: "Beyond our services, we build our own products. Each one works alone; together they share one TAKATAK account.",
      fr: "En plus de nos services, nous bâtissons nos propres produits. Chacun fonctionne seul ; ensemble, ils partagent un seul compte TAKATAK.",
    },
    status: {
      live: { en: "Live", fr: "En ligne" },
      early: { en: "Early access", fr: "Accès anticipé" },
      clover: { en: "Coming to Clover App Market", fr: "Bientôt sur le Clover App Market" },
      soon: { en: "Coming soon", fr: "Bientôt" },
      planned: { en: "Pre-launch", fr: "Prélancement" },
    },
    open: { en: "Visit", fr: "Visiter" },
    ask: { en: "Ask for early access", fr: "Demander l’accès anticipé" },
  },
  pricing: {
    kicker: { en: "05 · Pricing", fr: "05 · Tarifs" },
    title: { en: "Pick a plan. Pay online. Start today.", fr: "Choisissez. Payez en ligne. Commencez aujourd’hui." },
    subtitle: {
      en: "Real prices from our catalog, in Canadian dollars. Hosting goes straight to checkout; the rest starts with your account.",
      fr: "De vrais prix tirés de notre catalogue, en dollars canadiens. L’hébergement va directement au paiement ; le reste commence par votre compte.",
    },
    tabs: {
      hosting: { en: "Hosting", fr: "Hébergement" },
      websites: { en: "Websites", fr: "Sites web" },
      marketing: { en: "Marketing", fr: "Marketing" },
      credits: { en: "AI credits", fr: "Crédits IA" },
    },
    popular: { en: "Most chosen", fr: "Le plus choisi" },
    choose: { en: "Order {name}", fr: "Commander {name}" },
    start: { en: "Start with {name}", fr: "Commencer avec {name}" },
    credits: { en: "{n} credits", fr: "{n} crédits" },
    perCredit: { en: "{price} per credit", fr: "{price} par crédit" },
    all: { en: "See full pricing", fr: "Tous les tarifs" },
    draftCredits: {
      en: "AI credit packs are sold from your dashboard once online checkout opens.",
      fr: "Les crédits IA s’achètent dans votre tableau de bord dès l’ouverture du paiement en ligne.",
    },
  },
  faq: {
    kicker: { en: "06 · Questions", fr: "06 · Questions" },
    title: { en: "Straight answers.", fr: "Des réponses claires." },
  },
} as const;

export const BUSINESS_TYPES: readonly { key: string; label: Bi; hint: Bi; image: string; base: readonly CategoryKey[] }[] = [
  {
    key: "restaurant",
    label: { en: "Restaurant or café", fr: "Restaurant ou café" },
    hint: { en: "Orders, reviews, local search", fr: "Commandes, avis, recherche locale" },
    image: "/marketplace/visuals/menu.jpg",
    base: ["website", "domains", "local", "reviews"],
  },
  {
    key: "shop",
    label: { en: "Shop or online store", fr: "Boutique ou commerce en ligne" },
    hint: { en: "Sell online and in store", fr: "Vendre en ligne et en magasin" },
    image: "/marketplace/visuals/ecommerce.jpg",
    base: ["website", "domains", "hosting", "social"],
  },
  {
    key: "services",
    label: { en: "Services and trades", fr: "Services et métiers" },
    hint: { en: "Leads, quotes, invoices", fr: "Prospects, soumissions, factures" },
    image: "/marketplace/visuals/leads.jpg",
    base: ["website", "domains", "local", "billing"],
  },
  {
    key: "startup",
    label: { en: "Startup or creator", fr: "Jeune entreprise ou créateur" },
    hint: { en: "Brand, content, AI", fr: "Marque, contenu, IA" },
    image: "/marketplace/visuals/branding.jpg",
    base: ["website", "domains", "hosting", "ai"],
  },
];

export const GOALS: readonly { key: string; label: Bi; adds: readonly CategoryKey[] }[] = [
  { key: "online", label: { en: "Get online", fr: "Être en ligne" }, adds: ["website", "domains", "hosting"] },
  { key: "found", label: { en: "Get found on Google and maps", fr: "Être trouvé sur Google et les cartes" }, adds: ["local", "reviews"] },
  { key: "customers", label: { en: "Get more customers", fr: "Plus de clients" }, adds: ["marketing", "social"] },
  { key: "paid", label: { en: "Get paid faster", fr: "Être payé plus vite" }, adds: ["billing"] },
  { key: "ai", label: { en: "Save time with AI", fr: "Gagner du temps avec l’IA" }, adds: ["ai"] },
];

export type SuiteStatus = "live" | "early" | "clover" | "soon" | "planned";

export interface SuiteProduct {
  key: string;
  name: string;
  mono: string;
  desc: Bi;
  status: SuiteStatus;
  url?: string;
}

export interface SuiteGroup {
  key: string;
  title: Bi;
  lead: Bi;
  image: string;
  products: readonly SuiteProduct[];
}

/**
 * Statuses from each repository (2026-10-30): the nine Clover apps are drafts in
 * the Clover developer portal; Food Hub is RC10; QMAPS and FLEXS are linked from
 * the header; MIMT telecom is pre-launch; the Academy has no public address yet.
 */
export const SUITE_GROUPS: readonly SuiteGroup[] = [
  {
    key: "restaurants",
    title: { en: "For restaurants", fr: "Pour les restaurants" },
    lead: {
      en: "TAKATAK Food Hub connects your delivery platforms and your Clover point of sale in one kitchen screen. Nine Clover apps cover the rest of the day.",
      fr: "TAKATAK Food Hub relie vos plateformes de livraison et votre caisse Clover dans un seul écran de cuisine. Neuf applications Clover couvrent le reste de la journée.",
    },
    image: "/marketplace/visuals/menu.jpg",
    products: [
      { key: "foodhub", name: "Food Hub", mono: "FH", status: "early", desc: { en: "Delivery orders and Clover on one kitchen screen", fr: "Commandes de livraison et Clover sur un écran de cuisine" } },
      { key: "c4isse", name: "C4ISSE", mono: "C4", status: "clover", desc: { en: "Counter register, cash drawer, picture register", fr: "Caisse au comptoir, tiroir-caisse, caisse-photo" } },
      { key: "t4ctile", name: "T4CTILE", mono: "T4", status: "clover", desc: { en: "Self-service kiosk and touch ordering", fr: "Borne libre-service et commande tactile" } },
      { key: "4ccounting", name: "4CCOUNTING", mono: "4C", status: "clover", desc: { en: "Sales, GST/QST, tips, exports", fr: "Ventes, TPS/TVQ, pourboires, exports" } },
      { key: "tr4cker", name: "TR4CKER", mono: "TR", status: "clover", desc: { en: "Live tracking of your deliveries", fr: "Suivi en direct de vos livraisons" } },
      { key: "st4ff", name: "ST4FF", mono: "S4", status: "clover", desc: { en: "Hours, shifts, labour cost", fr: "Heures, quarts, coût de main-d’œuvre" } },
      { key: "m4rketing", name: "M4RKETING", mono: "M4", status: "clover", desc: { en: "Segments, discounts, campaigns", fr: "Segments, rabais, campagnes" } },
      { key: "loy4lty", name: "LOY4LTY", mono: "L4", status: "clover", desc: { en: "Loyalty by phone number", fr: "Fidélité par numéro de téléphone" } },
      { key: "rew4rd", name: "REW4RDS", mono: "R4", status: "clover", desc: { en: "Gift cards", fr: "Cartes-cadeaux" } },
      { key: "ch4t", name: "CH4T", mono: "CH", status: "soon", desc: { en: "Customer support", fr: "Soutien client" } },
    ],
  },
  {
    key: "local",
    title: { en: "For local businesses", fr: "Pour les commerces locaux" },
    lead: {
      en: "Be found where customers search, then turn that visibility into qualified requests.",
      fr: "Soyez trouvé là où les clients cherchent, puis transformez cette visibilité en demandes qualifiées.",
    },
    image: "/marketplace/visuals/seo.jpg",
    products: [
      { key: "qmaps", name: "QMAPS", mono: "QM", status: "live", url: "https://qmaps.ca/", desc: { en: "Local discovery across Québec", fr: "Découverte locale partout au Québec" } },
      { key: "flexs", name: "FLEXS", mono: "FX", status: "live", url: "https://flexs.ca/", desc: { en: "Capture and follow up on leads", fr: "Captez et suivez vos prospects" } },
      { key: "seo", name: "SEO TAKATAK", mono: "SE", status: "early", desc: { en: "Search Console data and SEO action plans", fr: "Données Search Console et plans d’action SEO" } },
    ],
  },
  {
    key: "connect",
    title: { en: "Talk and learn", fr: "Communiquer et apprendre" },
    lead: {
      en: "A Canadian business phone line, and courses that teach your team every TAKATAK tool.",
      fr: "Une ligne téléphonique d’affaires canadienne, et des formations sur chaque outil TAKATAK pour votre équipe.",
    },
    image: "/marketplace/visuals/voip.jpg",
    products: [
      { key: "mimt", name: "MIMT", mono: "MI", status: "planned", url: "https://mimt.ca/", desc: { en: "Business phone and VoIP, made in Canada", fr: "Téléphonie d’affaires et VoIP, faite au Canada" } },
      { key: "academy", name: "TAKATAK Academy", mono: "AC", status: "soon", desc: { en: "Courses for every TAKATAK service", fr: "Des formations pour chaque service TAKATAK" } },
    ],
  },
];

export const HOME_FAQ: readonly { q: Bi; a: Bi }[] = [
  {
    q: { en: "How do I start?", fr: "Comment commencer ?" },
    a: {
      en: "Build your plan above or pick one service, then create your account. Your dashboard opens right away, and our team follows up to set up your services.",
      fr: "Bâtissez votre forfait plus haut ou choisissez un service, puis créez votre compte. Votre tableau de bord s’ouvre tout de suite, et notre équipe fait le suivi pour mettre vos services en place.",
    },
  },
  {
    q: { en: "Can I pay online?", fr: "Puis-je payer en ligne ?" },
    a: {
      en: "Yes. Domains and hosting go through online checkout. Services built for you are quoted first, then invoiced through your dashboard with GST and QST.",
      fr: "Oui. Les domaines et l’hébergement passent par le paiement en ligne. Les services faits pour vous sont d’abord chiffrés, puis facturés dans votre tableau de bord avec TPS et TVQ.",
    },
  },
  {
    q: { en: "What are AI credits?", fr: "Que sont les crédits IA ?" },
    a: {
      en: "TAK bot and the AI tools run on credits. Each action has a fixed cost, shown before you run it. If an engine fails, the credits come back automatically.",
      fr: "TAK bot et les outils d’IA fonctionnent avec des crédits. Chaque action a un coût fixe, affiché avant de la lancer. Si un moteur échoue, les crédits reviennent automatiquement.",
    },
  },
  {
    q: { en: "Do I need every service?", fr: "Ai-je besoin de tous les services ?" },
    a: {
      en: "No. Start with one. Every service plugs into the same account, so you can add the next one in a click when you are ready.",
      fr: "Non. Commencez par un seul. Chaque service se branche au même compte : vous ajoutez le suivant en un clic quand vous êtes prêt.",
    },
  },
  {
    q: { en: "Who will I talk to?", fr: "À qui vais-je parler ?" },
    a: {
      en: "A bilingual team in Montréal, by chat, email or phone. AI helps us work faster; a person stays responsible for your account.",
      fr: "Une équipe bilingue à Montréal, par clavardage, courriel ou téléphone. L’IA nous aide à aller plus vite ; une personne reste responsable de votre compte.",
    },
  },
];

/** Fills {name}-style placeholders. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

/** Homepage v2 headlines (Oct 31 2026): a bright statement, then a quiet continuation. */
export const homeV2 = {
  band: {
    words: {
      en: ["Websites", "Domains", "Hosting", "Marketing", "Social", "Listings", "Reviews", "AI", "Invoicing"],
      fr: ["Sites web", "Domaines", "Hébergement", "Marketing", "Réseaux sociaux", "Fiches locales", "Avis", "IA", "Facturation"],
    },
    proof: [
      { value: "10", label: { en: "services, one account", fr: "services, un seul compte" } },
      { value: "13", label: { en: "AI engines behind TAK bot", fr: "moteurs d’IA derrière TAK bot" } },
      { value: "9", label: { en: "social networks connected", fr: "réseaux sociaux branchés" } },
      { value: "FR · EN", label: { en: "team in Montréal", fr: "équipe à Montréal" } },
    ],
  },
  services: {
    eyebrow: { en: "Services", fr: "Services" },
    lead: { en: "Ten services.", fr: "Dix services." },
    rest: { en: "One team that runs every one of them for you.", fr: "Une seule équipe qui les gère tous pour vous." },
    open: { en: "See details", fr: "Voir le détail" },
    close: { en: "Close", fr: "Fermer" },
    drag: { en: "Drag, swipe or use the arrows", fr: "Glissez ou utilisez les flèches" },
  },
  plan: {
    eyebrow: { en: "Build your plan", fr: "Votre forfait" },
    lead: { en: "Build your stack.", fr: "Composez votre forfait." },
    rest: { en: "See the price before you sign up.", fr: "Voyez le prix avant de vous inscrire." },
    presets: { en: "Start from your business", fr: "Partez de votre entreprise" },
    pick: { en: "Services", fr: "Services" },
    receipt: { en: "Your plan", fr: "Votre forfait" },
    empty: { en: "Add a service to see your price.", fr: "Ajoutez un service pour voir votre prix." },
    lines: { en: "Starting prices", fr: "Prix de départ" },
    custom: { en: "Custom", fr: "Sur mesure" },
  },
  takbot: {
    eyebrow: { en: "TAK bot", fr: "TAK bot" },
    lead: { en: "Meet TAK bot.", fr: "Voici TAK bot." },
    rest: { en: "Every AI engine, in one conversation.", fr: "Tous les moteurs d’IA, dans une seule conversation." },
    body: {
      en: "Ask once. TAK bot sends your request to the engine that does it best, or to the one you pick, and charges credits only for what runs.",
      fr: "Demandez une fois. TAK bot envoie votre demande au moteur le plus doué pour la tâche, ou à celui que vous choisissez, et ne compte que les crédits utilisés.",
    },
    demo: { en: "Demo", fr: "Démo" },
    routing: { en: "Routing", fr: "Aiguillage" },
  },
  suite: {
    eyebrow: { en: "Our products", fr: "Nos produits" },
    lead: { en: "Software we build,", fr: "Des logiciels que nous bâtissons," },
    rest: { en: "not just services we sell.", fr: "pas seulement des services que nous vendons." },
  },
  pricing: {
    eyebrow: { en: "Pricing", fr: "Tarifs" },
    lead: { en: "Simple pricing.", fr: "Des prix simples." },
    rest: { en: "In Canadian dollars, before taxes.", fr: "En dollars canadiens, avant taxes." },
  },
  faq: {
    eyebrow: { en: "Questions", fr: "Questions" },
    lead: { en: "Questions,", fr: "Vos questions," },
    rest: { en: "answered.", fr: "nos réponses." },
  },
} as const;

/** Homepage v3 (Oct 31 2026, light first): quick actions and photo stories. */
export const homeV3 = {
  quick: {
    title: { en: "What do you want to do today?", fr: "Qu’est-ce qu’on fait aujourd’hui ?" },
    items: [
      { key: "website", icon: "website", to: "/services/websites", label: { en: "Build my website", fr: "Créer mon site web" } },
      { key: "domain", icon: "domain", to: "domain", label: { en: "Find my domain", fr: "Trouver mon domaine" } },
      { key: "hosting", icon: "hosting", to: "/hosting", label: { en: "Host my site", fr: "Héberger mon site" } },
      { key: "customers", icon: "customers", to: "/services/marketing", label: { en: "Get more customers", fr: "Avoir plus de clients" } },
      { key: "reviews", icon: "reviews", to: "/services/reviews", label: { en: "Grow my Google reviews", fr: "Plus d’avis Google" } },
      { key: "takbot", icon: "takbot", to: "/takbot", label: { en: "Ask TAK bot", fr: "Demander à TAK bot" } },
    ],
  },
  stories: [
    {
      key: "online",
      photo: "/photos/commerce-cafe.webp",
      alt: { en: "A café owner on the phone behind the counter", fr: "Un propriétaire de café au téléphone derrière son comptoir" },
      eyebrow: { en: "Get online", fr: "Être en ligne" },
      title: { en: "Your business deserves a website that matches it.", fr: "Votre commerce mérite un site à sa hauteur." },
      body: {
        en: "Website, domain name, hosting and business email. We set it all up and look after it, you keep full control.",
        fr: "Site web, nom de domaine, hébergement et courriel pro. On installe tout et on s’en occupe; vous gardez le plein contrôle.",
      },
      keys: ["website", "domains", "hosting"],
      route: "/services/websites",
      more: { en: "See websites", fr: "Voir les sites web" },
    },
    {
      key: "found",
      photo: "/photos/artisan-atelier.webp",
      alt: { en: "A craftsman in his workshop looking at his phone", fr: "Un artisan dans son atelier qui regarde son téléphone" },
      eyebrow: { en: "Get found", fr: "Être trouvé" },
      title: { en: "When people search nearby, they find you.", fr: "Quand on cherche près d’ici, c’est vous qu’on trouve." },
      body: {
        en: "An up-to-date Google profile, maps, directories and reviews. Every local search leads to your door.",
        fr: "Une fiche Google à jour, les cartes, les annuaires et vos avis. Chaque recherche locale mène à votre porte.",
      },
      keys: ["local", "reviews"],
      route: "/services/local-listings",
      more: { en: "See local listings", fr: "Voir les fiches locales" },
    },
    {
      key: "grow",
      photo: "/photos/studio-design.webp",
      alt: { en: "A designer on the phone in her studio", fr: "Une designer au téléphone dans son atelier" },
      eyebrow: { en: "Grow", fr: "Grandir" },
      title: { en: "Customers who come back, week after week.", fr: "Des clients qui reviennent, semaine après semaine." },
      body: {
        en: "Meta and Google ads, social media and content made faster with AI, all measured in one dashboard.",
        fr: "Publicités Meta et Google, réseaux sociaux et contenu accéléré par l’IA, le tout mesuré dans un seul tableau de bord.",
      },
      keys: ["marketing", "social", "ai"],
      route: "/services/marketing",
      more: { en: "See marketing", fr: "Voir le marketing" },
    },
  ],
  addAll: { en: "Add to my plan", fr: "Ajouter à mon forfait" },
  added: { en: "In my plan", fr: "Dans mon forfait" },
  gallery: {
    lead: { en: "Every service.", fr: "Tous nos services." },
    rest: { en: "One account, one team.", fr: "Un seul compte, une seule équipe." },
  },
  final: {
    title: { en: "Your business, at its best online.", fr: "Votre entreprise, à son meilleur en ligne." },
    body: {
      en: "Create your account, pick your services, and our bilingual team in Montréal sets everything up with you.",
      fr: "Créez votre compte, choisissez vos services, et notre équipe bilingue de Montréal met tout en place avec vous.",
    },
    photoAlt: { en: "A customer smiling at her phone in a café", fr: "Une cliente sourit à son téléphone dans un café" },
  },
} as const;
