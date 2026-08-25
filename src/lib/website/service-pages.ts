// Bilingual content model for TAKATAK service product pages.
// Pricing always comes from src/lib/pricing.ts — never hardcode amounts here.
import { pricing, type Cadence } from "./pricing";

export type Bi<T = string> = { en: T; fr: T };

export type FlowKind =
  | "website"
  | "domain"
  | "hosting"
  | "marketing"
  | "local"
  | "leads"
  | "voip"
  | "automation"
  | "marketplace"
  | "design";

export interface ServicePackage {
  key: string;
  name: Bi;
  amount: number;
  cadence: Cadence;
  suffix?: string;
  description?: Bi;
}

export interface ServicePage {
  slug: string;              // route path segment under /services/
  route: string;             // full route path
  eyebrow: Bi;
  title: Bi;
  tagline: Bi;
  intro: Bi;
  flow: FlowKind;
  steps: readonly Bi[];
  benefits: readonly Bi[];
  packages: readonly ServicePackage[];
  faq: readonly { q: Bi; a: Bi }[];
  cta: { label: Bi; to: string };
  marketplaceQuery?: string;
}

const bi = (en: string, fr: string): Bi => ({ en, fr });

function suffixOf(entry: unknown): string | undefined {
  const s = (entry as { suffix?: unknown }).suffix;
  return typeof s === "string" ? s : undefined;
}

function pack(
  key: string,
  en: string,
  fr: string,
  amount: number,
  cadence: Cadence,
  suffix?: string,
): ServicePackage {
  return { key, name: bi(en, fr), amount, cadence, suffix };
}

export const servicePages: readonly ServicePage[] = [
  {
    slug: "domains",
    route: "/services/domains",
    eyebrow: bi("Infrastructure", "Infrastructure"),
    title: bi("Domain names", "Noms de domaine"),
    tagline: bi(
      "Secure the right name, then connect it to your website, email and hosting.",
      "Réservez le bon nom, puis reliez-le à votre site, vos courriels et votre hébergement.",
    ),
    intro: bi(
      "We register .ca, .com and 300+ extensions, configure DNS, and point your name at your website and business email. If a registration needs manual review, our team completes it for you and confirms by email.",
      "Nous enregistrons les .ca, .com et plus de 300 extensions, configurons le DNS et dirigeons votre nom vers votre site et votre courriel d'affaires. Si une demande exige une vérification manuelle, notre équipe la complète et vous confirme par courriel.",
    ),
    flow: "domain",
    steps: [
      bi("Search availability", "Recherche de disponibilité"),
      bi("Reserve and verify", "Réservation et vérification"),
      bi("DNS configuration", "Configuration DNS"),
      bi("Website and email connected", "Site et courriel connectés"),
    ],
    benefits: [
      bi("Canadian .ca registration with privacy protection", "Enregistrement .ca canadien avec protection de la vie privée"),
      bi("DNS records configured by our team", "Enregistrements DNS configurés par notre équipe"),
      bi("Business email ready on day one", "Courriel d'affaires prêt dès le premier jour"),
      bi("Renewal reminders in your dashboard", "Rappels de renouvellement dans votre tableau de bord"),
      bi("Managed request form if automated checkout fails", "Formulaire géré si le paiement automatisé échoue"),
    ],
    packages: [
      pack("register", "Domain registration", "Enregistrement de domaine", pricing.domain.register.amount, "yearly"),
      pack("transfer", "Domain transfer", "Transfert de domaine", pricing.domain.transfer.amount, "one-time"),
    ],
    faq: [
      {
        q: bi("Can I use a domain I already own?", "Puis-je utiliser un domaine que je possède déjà ?"),
        a: bi("Yes. We can transfer it to TAKATAK or simply point its DNS to your TAKATAK hosting.", "Oui. Nous pouvons le transférer chez TAKATAK ou simplement diriger son DNS vers votre hébergement TAKATAK."),
      },
      {
        q: bi("How fast is a .ca domain active?", "En combien de temps un domaine .ca est-il actif ?"),
        a: bi("Usually within minutes. CIRA verification can add a few hours in rare cases.", "Généralement en quelques minutes. Une vérification de l'ACEI peut ajouter quelques heures dans de rares cas."),
      },
      {
        q: bi("Is email included?", "Le courriel est-il inclus ?"),
        a: bi("Email hosting is part of our hosting plans; we configure the MX records for you.", "L'hébergement courriel fait partie de nos forfaits d'hébergement ; nous configurons les enregistrements MX pour vous."),
      },
    ],
    cta: { label: bi("Search domains", "Chercher un domaine"), to: "/domain" },
  },
  {
    slug: "hosting",
    route: "/services/hosting",
    eyebrow: bi("Infrastructure", "Infrastructure"),
    title: bi("Web hosting", "Hébergement web"),
    tagline: bi(
      "Managed hosting with SSL, backups, email and cPanel — supported in Canada.",
      "Hébergement géré avec SSL, sauvegardes, courriel et cPanel — soutien au Canada.",
    ),
    intro: bi(
      "Portfolio to Gold plans cover everything from a single landing page to ecommerce traffic. WordPress installs, SSL certificates, daily backups and mailboxes are configured by our team, not left to you.",
      "Les forfaits Portfolio à Gold couvrent aussi bien une page unique qu'une boutique à fort trafic. Installations WordPress, certificats SSL, sauvegardes quotidiennes et boîtes courriel sont configurés par notre équipe.",
    ),
    flow: "hosting",
    steps: [
      bi("Choose a plan", "Choix du forfait"),
      bi("Server provisioned", "Serveur configuré"),
      bi("SSL and WordPress installed", "SSL et WordPress installés"),
      bi("Site online with backups", "Site en ligne avec sauvegardes"),
    ],
    benefits: [
      bi("Free SSL on every plan", "SSL gratuit sur tous les forfaits"),
      bi("Daily backups with restore support", "Sauvegardes quotidiennes avec restauration assistée"),
      bi("WordPress tuning and migrations", "Optimisation et migration WordPress"),
      bi("cPanel access plus business mailboxes", "Accès cPanel et boîtes courriel d'affaires"),
      bi("Human support, not a ticket queue", "Un soutien humain, pas une file de billets"),
    ],
    packages: pricing.hosting.map((h) =>
      pack(h.key, h.name, h.name, h.amount, h.cadence as Cadence),
    ),
    faq: [
      {
        q: bi("Can you migrate my current site?", "Pouvez-vous migrer mon site actuel ?"),
        a: bi("Yes — migrations are included when you start a Bronze plan or higher.", "Oui — les migrations sont incluses à partir du forfait Bronze."),
      },
      {
        q: bi("Do I need technical skills?", "Dois-je avoir des compétences techniques ?"),
        a: bi("No. We handle setup; you get a dashboard and cPanel if you want them.", "Non. Nous gérons l'installation ; vous obtenez un tableau de bord et cPanel si vous le souhaitez."),
      },
      {
        q: bi("Can I upgrade later?", "Puis-je changer de forfait plus tard ?"),
        a: bi("Yes, plans upgrade without downtime and billing is prorated.", "Oui, les forfaits évoluent sans interruption et la facturation est au prorata."),
      },
    ],
    cta: { label: bi("View hosting plans", "Voir les forfaits"), to: "/hosting" },
  },
  {
    slug: "websites",
    route: "/services/websites",
    eyebrow: bi("Build", "Conception"),
    title: bi("Website creation", "Création de sites web"),
    tagline: bi(
      "Designed, built and launched by our team — from a starter site to full ecommerce.",
      "Conçus, développés et lancés par notre équipe — du site de départ au commerce en ligne.",
    ),
    intro: bi(
      "You share your brief, we design pages, build them on managed hosting, connect forms, bookings, payments and analytics, then launch. Every project has a named contact and a fixed scope agreed up front.",
      "Vous partagez votre besoin, nous concevons les pages, les développons sur un hébergement géré, branchons formulaires, réservations, paiements et analytique, puis lançons. Chaque projet a un responsable attitré et une portée fixée d'avance.",
    ),
    flow: "website",
    steps: [
      bi("Brief and scope", "Besoin et portée"),
      bi("Design and content", "Design et contenu"),
      bi("Build and review", "Développement et révision"),
      bi("Launch and handover", "Lancement et remise"),
    ],
    benefits: [
      bi("Fixed CAD pricing agreed before work starts", "Prix en CAD fixé avant le début des travaux"),
      bi("Mobile-first, fast and accessible builds", "Sites rapides, accessibles et pensés mobile d'abord"),
      bi("Forms, bookings and payments configured", "Formulaires, réservations et paiements configurés"),
      bi("Analytics and search basics included", "Analytique et bases du référencement incluses"),
      bi("Hosting, domain and email handled together", "Hébergement, domaine et courriel gérés ensemble"),
    ],
    packages: pricing.websites.map((w) => pack(w.key, w.name, w.name, w.amount, w.cadence as Cadence)),
    faq: [
      {
        q: bi("How long does a website take?", "Combien de temps prend un site web ?"),
        a: bi("A starter site launches in days; business and ecommerce builds typically run 3–6 weeks.", "Un site de départ est lancé en quelques jours ; un site d'affaires ou transactionnel prend généralement de 3 à 6 semaines."),
      },
      {
        q: bi("Do you write the content?", "Rédigez-vous le contenu ?"),
        a: bi("We can draft and structure copy in English or French, then you approve it.", "Nous pouvons rédiger et structurer les textes en français ou en anglais, puis vous approuvez."),
      },
      {
        q: bi("Who owns the site?", "À qui appartient le site ?"),
        a: bi("You do. Domain, hosting and files remain in your name.", "À vous. Domaine, hébergement et fichiers restent à votre nom."),
      },
    ],
    cta: { label: bi("Start website project", "Démarrer un projet de site"), to: "/marketplace/search" },
    marketplaceQuery: "website",
  },
  {
    slug: "logo-branding",
    route: "/services/logo-branding",
    eyebrow: bi("Build", "Conception"),
    title: bi("Logo & branding", "Logo et image de marque"),
    tagline: bi(
      "Identity systems built for real use — signage, packaging, social and web.",
      "Des identités pensées pour la vraie vie — affichage, emballage, réseaux sociaux et web.",
    ),
    intro: bi(
      "From a single logo to a complete identity with colour, type, and usage rules. Files are delivered in every format you need for print and digital, with a short guide your team can actually follow.",
      "Du logo simple à l'identité complète avec couleurs, typographie et règles d'usage. Les fichiers sont livrés dans tous les formats requis pour l'impression et le numérique, avec un guide court et utilisable.",
    ),
    flow: "design",
    steps: [
      bi("Discovery and references", "Découverte et références"),
      bi("Concept directions", "Directions créatives"),
      bi("Refinement", "Raffinement"),
      bi("Final files and guide", "Fichiers finaux et guide"),
    ],
    benefits: [
      bi("Print-ready and digital file formats", "Formats prêts pour l'impression et le numérique"),
      bi("Colour, typography and usage rules", "Couleurs, typographie et règles d'usage"),
      bi("Social and signage variations", "Déclinaisons pour réseaux sociaux et affichage"),
      bi("Full ownership of final assets", "Propriété complète des fichiers finaux"),
      bi("Optional matching website design", "Design de site assorti en option"),
    ],
    packages: pricing.branding.map((b) => pack(b.key, b.name, b.name, b.amount, b.cadence as Cadence)),
    faq: [
      {
        q: bi("How many concepts do I see?", "Combien de concepts vais-je voir ?"),
        a: bi("Logo Design includes three directions; Brand Kit and Identity include broader exploration.", "Le forfait Logo comprend trois directions ; les forfaits Kit et Identité incluent une exploration plus large."),
      },
      {
        q: bi("Can you refresh an existing logo?", "Pouvez-vous rafraîchir un logo existant ?"),
        a: bi("Yes — modernizing an existing mark is a common request.", "Oui — moderniser une marque existante est une demande courante."),
      },
      {
        q: bi("What files do I receive?", "Quels fichiers vais-je recevoir ?"),
        a: bi("SVG, PDF, PNG and JPG, plus source files on Brand Kit and above.", "SVG, PDF, PNG et JPG, ainsi que les fichiers sources à partir du Kit de marque."),
      },
    ],
    cta: { label: bi("Start branding project", "Démarrer un projet de marque"), to: "/marketplace/category/logo_design" },
    marketplaceQuery: "logo",
  },
  {
    slug: "mobile-apps",
    route: "/services/mobile-apps",
    eyebrow: bi("Build", "Conception"),
    title: bi("Mobile apps", "Applications mobiles"),
    tagline: bi(
      "From clickable prototype to a published iOS and Android product.",
      "Du prototype cliquable au produit publié sur iOS et Android.",
    ),
    intro: bi(
      "We scope your idea, wireframe the core screens, build an MVP you can test with real users, then handle store submission and post-launch updates.",
      "Nous cadrons votre idée, dessinons les écrans clés, développons un MVP testable avec de vrais utilisateurs, puis gérons la soumission aux magasins et les mises à jour.",
    ),
    flow: "website",
    steps: [
      bi("App idea and scope", "Idée et portée"),
      bi("Wireframes and flows", "Maquettes et parcours"),
      bi("Build and test", "Développement et tests"),
      bi("Publish to stores", "Publication sur les magasins"),
    ],
    benefits: [
      bi("Prototype first, so you validate before investing", "Prototype d'abord, pour valider avant d'investir"),
      bi("iOS and Android from one codebase", "iOS et Android à partir d'une seule base de code"),
      bi("Store submission handled for you", "Soumission aux magasins prise en charge"),
      bi("Analytics and crash reporting configured", "Analytique et rapports d'erreurs configurés"),
      bi("Maintenance and update plans available", "Forfaits d'entretien et de mises à jour offerts"),
    ],
    packages: pricing.apps.map((a) => pack(a.key, a.name, a.name, a.amount, a.cadence as Cadence, suffixOf(a))),
    faq: [
      {
        q: bi("Do I need a developer account?", "Ai-je besoin d'un compte développeur ?"),
        a: bi("Yes, in your business name — we walk you through creating it.", "Oui, au nom de votre entreprise — nous vous guidons pour le créer."),
      },
      {
        q: bi("Can the app connect to my website?", "L'application peut-elle se relier à mon site ?"),
        a: bi("Yes. Shared accounts, data and payments are common integrations.", "Oui. Comptes partagés, données et paiements sont des intégrations courantes."),
      },
      {
        q: bi("What happens after launch?", "Que se passe-t-il après le lancement ?"),
        a: bi("We monitor crashes and ship updates on an agreed cadence.", "Nous surveillons les erreurs et livrons des mises à jour selon une cadence convenue."),
      },
    ],
    cta: { label: bi("Start app project", "Démarrer un projet d'app"), to: "/marketplace/search" },
    marketplaceQuery: "mobile app",
  },
  {
    slug: "marketing",
    route: "/services/marketing",
    eyebrow: bi("Growth", "Croissance"),
    title: bi("Marketing", "Marketing"),
    tagline: bi(
      "Campaign setup, creative and reporting handled by a managed growth team.",
      "Configuration de campagnes, création et rapports gérés par une équipe dédiée.",
    ),
    intro: bi(
      "Google and Meta campaigns built around your actual margins, with tracking you can audit and monthly reporting that explains what changed and why.",
      "Des campagnes Google et Meta bâties autour de vos marges réelles, avec un suivi vérifiable et des rapports mensuels qui expliquent ce qui a changé et pourquoi.",
    ),
    flow: "marketing",
    steps: [
      bi("Campaign strategy", "Stratégie de campagne"),
      bi("Traffic and creative", "Trafic et création"),
      bi("Leads and conversions", "Prospects et conversions"),
      bi("Reporting and iteration", "Rapports et ajustements"),
    ],
    benefits: [
      bi("Conversion tracking configured properly", "Suivi des conversions correctement configuré"),
      bi("Bilingual ad copy for Québec audiences", "Textes publicitaires bilingues pour le marché québécois"),
      bi("Clear monthly reporting in plain language", "Rapports mensuels clairs et sans jargon"),
      bi("Ad spend stays in your own account", "Le budget publicitaire reste dans votre compte"),
      bi("No long-term lock-in", "Aucun engagement à long terme"),
    ],
    packages: pricing.marketing.map((m) => pack(m.key, m.name, m.name, m.amount, m.cadence as Cadence, suffixOf(m))),
    faq: [
      {
        q: bi("Is ad spend included?", "Le budget publicitaire est-il inclus ?"),
        a: bi("No — management fees are separate so your spend stays transparent.", "Non — les frais de gestion sont distincts pour garder votre budget transparent."),
      },
      {
        q: bi("What budget should I start with?", "Quel budget devrais-je prévoir ?"),
        a: bi("Most local businesses start between $500 and $1,500 CAD per month in ad spend.", "La plupart des PME locales commencent entre 500 $ et 1 500 $ CAD par mois en publicité."),
      },
      {
        q: bi("Do you handle SEO too?", "Gérez-vous aussi le référencement ?"),
        a: bi("Yes, on-page and local SEO can be added to any plan.", "Oui, le référencement sur page et local peut s'ajouter à tout forfait."),
      },
    ],
    cta: { label: bi("Start marketing", "Démarrer le marketing"), to: "/services/marketing" },
  },
  {
    slug: "social-media",
    route: "/services/social-media",
    eyebrow: bi("Growth", "Croissance"),
    title: bi("Social media", "Médias sociaux"),
    tagline: bi(
      "Planning, publishing and reporting — without adding a job to your week.",
      "Planification, publication et rapports — sans ajouter une tâche à votre semaine.",
    ),
    intro: bi(
      "We build a monthly content plan, produce the posts, schedule them across your channels, and report on what actually drove engagement and enquiries.",
      "Nous bâtissons un plan de contenu mensuel, produisons les publications, les planifions sur vos canaux et rapportons ce qui a réellement généré de l'engagement et des demandes.",
    ),
    flow: "marketing",
    steps: [
      bi("Content plan", "Plan de contenu"),
      bi("Creative production", "Production créative"),
      bi("Scheduled publishing", "Publication planifiée"),
      bi("Engagement reporting", "Rapports d'engagement"),
    ],
    benefits: [
      bi("Consistent posting without internal effort", "Publication constante sans effort interne"),
      bi("Bilingual captions where useful", "Légendes bilingues au besoin"),
      bi("Approval step before anything goes live", "Étape d'approbation avant toute publication"),
      bi("Channel-appropriate formats", "Formats adaptés à chaque plateforme"),
      bi("Monthly performance summary", "Sommaire de performance mensuel"),
    ],
    packages: pricing.social.map((s) => pack(s.key, s.name, s.name, s.amount, s.cadence as Cadence)),
    faq: [
      {
        q: bi("Which platforms do you cover?", "Quelles plateformes couvrez-vous ?"),
        a: bi("Facebook, Instagram, LinkedIn and TikTok are the most common.", "Facebook, Instagram, LinkedIn et TikTok sont les plus courantes."),
      },
      {
        q: bi("Do I approve posts?", "Est-ce que j'approuve les publications ?"),
        a: bi("Yes, you review the calendar before anything is scheduled.", "Oui, vous révisez le calendrier avant toute planification."),
      },
      {
        q: bi("Can you use my photos?", "Pouvez-vous utiliser mes photos ?"),
        a: bi("Absolutely — your own imagery usually performs best.", "Absolument — vos propres images donnent souvent les meilleurs résultats."),
      },
    ],
    cta: { label: bi("Set up social", "Configurer les réseaux"), to: "/services/social-media" },
  },
  {
    slug: "local-listings",
    route: "/services/local-listings",
    eyebrow: bi("Growth", "Croissance"),
    title: bi("Local visibility — QMAPS", "Visibilité locale — QMAPS"),
    tagline: bi(
      "Get found on Maps and directories with verified, consistent business listings.",
      "Soyez trouvé sur les cartes et annuaires grâce à des fiches vérifiées et cohérentes.",
    ),
    intro: bi(
      "QMAPS claims and corrects your listings on Google, Apple, Bing and the directories customers actually use, then keeps hours, categories and photos consistent everywhere.",
      "QMAPS revendique et corrige vos fiches sur Google, Apple, Bing et les annuaires réellement consultés, puis maintient heures, catégories et photos cohérentes partout.",
    ),
    flow: "local",
    steps: [
      bi("Listing audit", "Audit des fiches"),
      bi("Claim and verify", "Revendication et vérification"),
      bi("Sync across directories", "Synchronisation des annuaires"),
      bi("Monitor and update", "Surveillance et mises à jour"),
    ],
    benefits: [
      bi("Google Business Profile fully optimized", "Fiche Google Business entièrement optimisée"),
      bi("Apple, Bing and directory coverage", "Couverture Apple, Bing et annuaires"),
      bi("Consistent hours, categories and photos", "Heures, catégories et photos cohérentes"),
      bi("Review monitoring and response guidance", "Suivi des avis et aide aux réponses"),
      bi("Multi-location support", "Prise en charge multi-succursales"),
    ],
    packages: pricing.local.map((l) => pack(l.key, l.name, l.name, l.amount, l.cadence as Cadence)),
    faq: [
      {
        q: bi("How long until I rank better locally?", "Combien de temps avant de mieux ressortir localement ?"),
        a: bi("Listing corrections show within weeks; ranking gains build over 2–3 months.", "Les corrections apparaissent en quelques semaines ; les gains de positionnement s'installent sur 2 à 3 mois."),
      },
      {
        q: bi("Do you handle French listings?", "Gérez-vous les fiches en français ?"),
        a: bi("Yes — listings are maintained in French and English where supported.", "Oui — les fiches sont maintenues en français et en anglais lorsque la plateforme le permet."),
      },
      {
        q: bi("Can you fix a suspended profile?", "Pouvez-vous récupérer une fiche suspendue ?"),
        a: bi("In most cases yes; we manage the reinstatement process.", "Dans la plupart des cas oui ; nous gérons la démarche de rétablissement."),
      },
    ],
    cta: { label: bi("Improve local visibility", "Améliorer la visibilité locale"), to: "/services/local-listings" },
  },
  {
    slug: "lead-generation",
    route: "/services/lead-generation",
    eyebrow: bi("Growth", "Croissance"),
    title: bi("Lead generation — FLEXS", "Génération de clients — FLEXS"),
    tagline: bi(
      "Qualified local leads delivered to your pipeline, with tracking you can audit.",
      "Des prospects qualifiés livrés dans votre pipeline, avec un suivi vérifiable.",
    ),
    intro: bi(
      "FLEXS builds the capture forms, landing pages and follow-up automations, then routes qualified enquiries into your dashboard or CRM with full source attribution.",
      "FLEXS bâtit les formulaires, pages de destination et relances automatisées, puis achemine les demandes qualifiées vers votre tableau de bord ou CRM avec l'attribution complète des sources.",
    ),
    flow: "leads",
    steps: [
      bi("Capture form and landing page", "Formulaire et page de destination"),
      bi("Qualification rules", "Règles de qualification"),
      bi("Lead lands in your dashboard", "Le prospect arrive dans votre tableau de bord"),
      bi("Automated follow-up", "Relance automatisée"),
    ],
    benefits: [
      bi("Only qualified enquiries reach your team", "Seules les demandes qualifiées atteignent votre équipe"),
      bi("Source attribution on every lead", "Attribution de la source pour chaque prospect"),
      bi("CRM sync or dashboard delivery", "Synchronisation CRM ou livraison au tableau de bord"),
      bi("Automated first response", "Première réponse automatisée"),
      bi("Pay-per-lead option available", "Option de paiement par prospect offerte"),
    ],
    packages: pricing.leads.map((l) => pack(l.key, l.name, l.name, l.amount, l.cadence as Cadence)),
    faq: [
      {
        q: bi("What counts as a qualified lead?", "Qu'est-ce qu'un prospect qualifié ?"),
        a: bi("A contactable enquiry matching the service area and criteria you define.", "Une demande joignable qui correspond au territoire et aux critères que vous définissez."),
      },
      {
        q: bi("Are leads exclusive?", "Les prospects sont-ils exclusifs ?"),
        a: bi("Yes — leads generated for your campaigns go only to you.", "Oui — les prospects générés par vos campagnes vous sont exclusifs."),
      },
      {
        q: bi("Can it connect to my CRM?", "Peut-on relier mon CRM ?"),
        a: bi("Yes, most common CRMs connect directly or through automation.", "Oui, la plupart des CRM se connectent directement ou via l'automatisation."),
      },
    ],
    cta: { label: bi("Set up lead generation", "Configurer la génération de clients"), to: "/services/lead-generation" },
  },
  {
    slug: "voip",
    route: "/services/voip",
    eyebrow: bi("Communication", "Communication"),
    title: bi("Business VoIP", "Téléphonie VoIP d'affaires"),
    tagline: bi(
      "Business numbers, menus and call routing configured for your team.",
      "Numéros d'affaires, menus et routage d'appels configurés pour votre équipe.",
    ),
    intro: bi(
      "Keep or get a local number, route calls by team or schedule, capture voicemail with transcription, and see call activity in your dashboard.",
      "Conservez ou obtenez un numéro local, acheminez les appels par équipe ou horaire, captez la messagerie avec transcription et suivez l'activité dans votre tableau de bord.",
    ),
    flow: "voip",
    steps: [
      bi("Incoming call", "Appel entrant"),
      bi("Menu and routing", "Menu et routage"),
      bi("Voicemail and transcription", "Messagerie et transcription"),
      bi("Activity in dashboard", "Activité au tableau de bord"),
    ],
    benefits: [
      bi("Local and toll-free numbers", "Numéros locaux et sans frais"),
      bi("Bilingual IVR greetings", "Accueil IVR bilingue"),
      bi("Ring groups and after-hours rules", "Groupes de sonnerie et règles hors heures"),
      bi("Voicemail-to-email with transcription", "Messagerie vers courriel avec transcription"),
      bi("Works on desk phones, mobile and desktop", "Fonctionne sur téléphone de bureau, mobile et ordinateur"),
    ],
    packages: pricing.voip.map((v) => pack(v.key, v.name, v.name, v.amount, v.cadence as Cadence)),
    faq: [
      {
        q: bi("Can I keep my current number?", "Puis-je conserver mon numéro actuel ?"),
        a: bi("Yes, we handle porting from your current provider.", "Oui, nous gérons le transfert depuis votre fournisseur actuel."),
      },
      {
        q: bi("Do I need special hardware?", "Ai-je besoin de matériel spécial ?"),
        a: bi("No — apps work on mobile and desktop; desk phones are optional.", "Non — les applications fonctionnent sur mobile et ordinateur ; les téléphones de bureau sont optionnels."),
      },
      {
        q: bi("Is call transcription bilingual?", "La transcription est-elle bilingue ?"),
        a: bi("Yes, French and English transcription are both supported.", "Oui, la transcription française et anglaise est prise en charge."),
      },
    ],
    cta: { label: bi("Set up VoIP", "Configurer la VoIP"), to: "/services/voip" },
  },
  {
    slug: "automation",
    route: "/services/automation",
    eyebrow: bi("Operations", "Opérations"),
    title: bi("Automation", "Automatisation"),
    tagline: bi(
      "Connect your tools and remove manual work, with monitored workflows.",
      "Reliez vos outils et éliminez le travail manuel grâce à des flux surveillés.",
    ),
    intro: bi(
      "We map the tasks your team repeats, replace them with monitored workflows across your existing tools, and alert a human when something needs attention.",
      "Nous cartographions les tâches répétitives de votre équipe, les remplaçons par des flux surveillés entre vos outils existants et alertons une personne lorsqu'une intervention est requise.",
    ),
    flow: "automation",
    steps: [
      bi("Manual task mapped", "Tâche manuelle cartographiée"),
      bi("Workflow built", "Flux construit"),
      bi("Notifications and checks", "Notifications et contrôles"),
      bi("Reporting", "Rapports"),
    ],
    benefits: [
      bi("Hours returned to your team every week", "Des heures rendues à votre équipe chaque semaine"),
      bi("Works with the tools you already pay for", "Fonctionne avec les outils que vous payez déjà"),
      bi("Failure alerts, not silent breakage", "Alertes en cas d'échec, jamais de panne silencieuse"),
      bi("Documented workflows you own", "Flux documentés qui vous appartiennent"),
      bi("Scales from one task to full operations", "Évolue d'une tâche à des opérations complètes"),
    ],
    packages: pricing.ai.map((a) => pack(a.key, a.name, a.name, a.amount, a.cadence as Cadence, suffixOf(a))),
    faq: [
      {
        q: bi("What can be automated first?", "Que peut-on automatiser en premier ?"),
        a: bi("Quoting, intake, invoicing follow-ups and reporting are common starting points.", "Soumissions, prise de demandes, relances de facturation et rapports sont des points de départ courants."),
      },
      {
        q: bi("Will it break when a tool changes?", "Est-ce que ça brise si un outil change ?"),
        a: bi("Workflows are monitored and we fix breakages under a support plan.", "Les flux sont surveillés et nous corrigeons les bris dans le cadre d'un forfait de soutien."),
      },
      {
        q: bi("Is my data used to train models?", "Mes données servent-elles à entraîner des modèles ?"),
        a: bi("No. Your business data stays within your systems and our processing.", "Non. Vos données d'entreprise restent dans vos systèmes et notre traitement."),
      },
    ],
    cta: { label: bi("Describe your workflow", "Décrire votre flux de travail"), to: "/services/ai-business-tools" },
  },
  {
    slug: "ai-business-tools",
    route: "/services/ai-business-tools",
    eyebrow: bi("Operations", "Opérations"),
    title: bi("AI business tools", "Outils d'affaires IA"),
    tagline: bi(
      "Assistants and AI-supported processes, supervised by our team.",
      "Assistants et processus soutenus par l'IA, supervisés par notre équipe.",
    ),
    intro: bi(
      "Customer-facing assistants, document processing and internal copilots — configured against your real content, with review steps so nothing goes out unchecked.",
      "Assistants pour la clientèle, traitement documentaire et copilotes internes — configurés à partir de votre contenu réel, avec des étapes de révision pour que rien ne sorte sans contrôle.",
    ),
    flow: "automation",
    steps: [
      bi("Use case defined", "Cas d'usage défini"),
      bi("Assistant configured", "Assistant configuré"),
      bi("Human review step", "Étape de révision humaine"),
      bi("Live with reporting", "En service avec rapports"),
    ],
    benefits: [
      bi("Trained on your own documented content", "Basé sur votre contenu documenté"),
      bi("Bilingual responses for Québec customers", "Réponses bilingues pour la clientèle québécoise"),
      bi("Escalation to a human at any point", "Transfert à une personne à tout moment"),
      bi("Usage and quality reporting", "Rapports d'utilisation et de qualité"),
      bi("No customer data resold", "Aucune revente de données clients"),
    ],
    packages: pricing.ai.map((a) => pack(a.key, a.name, a.name, a.amount, a.cadence as Cadence, suffixOf(a))),
    faq: [
      {
        q: bi("Will it answer wrong?", "Peut-il répondre incorrectement ?"),
        a: bi("We scope answers to approved content and escalate anything outside it.", "Nous limitons les réponses au contenu approuvé et transférons tout le reste."),
      },
      {
        q: bi("Can it work in French?", "Fonctionne-t-il en français ?"),
        a: bi("Yes, assistants reply in the customer's language.", "Oui, les assistants répondent dans la langue du client."),
      },
      {
        q: bi("Where does it live?", "Où est-il installé ?"),
        a: bi("On your website, in your inbox tools, or inside internal workflows.", "Sur votre site, dans vos outils de courriel ou dans vos flux internes."),
      },
    ],
    cta: { label: bi("Start with AI tools", "Commencer avec les outils IA"), to: "/services/ai-business-tools" },
  },
  {
    slug: "data-admin",
    route: "/services/data-admin",
    eyebrow: bi("Operations", "Opérations"),
    title: bi("Data & admin support", "Soutien données et administration"),
    tagline: bi(
      "Data entry, spreadsheet cleanup and back-office workflows, done properly.",
      "Saisie de données, nettoyage de tableurs et flux administratifs, faits correctement.",
    ),
    intro: bi(
      "Hand off the administrative work that slows your team down: catalogue entry, list cleanup, reconciliation, recurring reports and document handling.",
      "Déléguez le travail administratif qui ralentit votre équipe : saisie de catalogues, nettoyage de listes, rapprochements, rapports récurrents et gestion documentaire.",
    ),
    flow: "marketplace",
    steps: [
      bi("Describe the task", "Décrire la tâche"),
      bi("Specialist assigned", "Spécialiste assigné"),
      bi("Work in shared workspace", "Travail dans un espace partagé"),
      bi("Delivery and approval", "Livraison et approbation"),
    ],
    benefits: [
      bi("Vetted specialists, not anonymous accounts", "Spécialistes vérifiés, pas de comptes anonymes"),
      bi("Fixed price per task", "Prix fixe par tâche"),
      bi("Confidentiality agreements available", "Ententes de confidentialité offertes"),
      bi("Recurring schedules supported", "Tâches récurrentes prises en charge"),
      bi("Approval before payment is released", "Approbation avant le versement du paiement"),
    ],
    packages: pricing.admin.map((a) => pack(a.key, a.name, a.name, a.amount, a.cadence as Cadence)),
    faq: [
      {
        q: bi("Can you sign an NDA?", "Pouvez-vous signer une entente de confidentialité ?"),
        a: bi("Yes, before any data is shared.", "Oui, avant tout partage de données."),
      },
      {
        q: bi("What file formats do you work with?", "Quels formats traitez-vous ?"),
        a: bi("Excel, Google Sheets, CSV, PDF and most business systems.", "Excel, Google Sheets, CSV, PDF et la plupart des systèmes d'affaires."),
      },
      {
        q: bi("Can this become recurring?", "Est-ce que ça peut devenir récurrent ?"),
        a: bi("Yes — weekly or monthly schedules are common.", "Oui — les cadences hebdomadaires ou mensuelles sont courantes."),
      },
    ],
    cta: { label: bi("Request admin support", "Demander du soutien administratif"), to: "/marketplace/post-project" },
    marketplaceQuery: "data entry",
  },
  {
    slug: "menu-flyer-design",
    route: "/services/menu-flyer-design",
    eyebrow: bi("Build", "Conception"),
    title: bi("Menu & flyer design", "Design de menus et dépliants"),
    tagline: bi(
      "Print-ready menus, flyers and campaign collateral for local businesses.",
      "Menus, dépliants et matériel de campagne prêts à imprimer pour les commerces locaux.",
    ),
    intro: bi(
      "Restaurant menus, promotional flyers and seasonal campaigns designed for both print and digital use, delivered with printer-ready files and social versions.",
      "Menus de restaurant, dépliants promotionnels et campagnes saisonnières conçus pour l'impression et le numérique, livrés avec fichiers prêts pour l'imprimeur et versions pour les réseaux sociaux.",
    ),
    flow: "design",
    steps: [
      bi("Content and format", "Contenu et format"),
      bi("Design draft", "Première proposition"),
      bi("Revisions", "Révisions"),
      bi("Print-ready delivery", "Livraison prête à imprimer"),
    ],
    benefits: [
      bi("Bleed, margins and CMYK handled correctly", "Fonds perdus, marges et CMJN traités correctement"),
      bi("Bilingual layouts for Québec menus", "Mises en page bilingues pour les menus québécois"),
      bi("Matching social media versions", "Versions assorties pour les réseaux sociaux"),
      bi("Editable source files on request", "Fichiers sources modifiables sur demande"),
      bi("Fast turnaround for promotions", "Délais rapides pour les promotions"),
    ],
    packages: pricing.design.map((d) => pack(d.key, d.name, d.name, d.amount, d.cadence as Cadence)),
    faq: [
      {
        q: bi("Do you handle printing?", "Gérez-vous l'impression ?"),
        a: bi("We deliver print-ready files and can coordinate with your printer.", "Nous livrons des fichiers prêts à imprimer et pouvons coordonner avec votre imprimeur."),
      },
      {
        q: bi("Can you update my existing menu?", "Pouvez-vous mettre à jour mon menu actuel ?"),
        a: bi("Yes, price and item updates are quick if source files exist.", "Oui, les mises à jour de prix et d'items sont rapides si les fichiers sources existent."),
      },
      {
        q: bi("Is French included?", "Le français est-il inclus ?"),
        a: bi("Yes — bilingual layouts are standard for Québec clients.", "Oui — les mises en page bilingues sont standards pour la clientèle québécoise."),
      },
    ],
    cta: { label: bi("Start design project", "Démarrer un projet de design"), to: "/marketplace/post-project" },
    marketplaceQuery: "flyer",
  },
  {
    slug: "marketplace",
    route: "/services/marketplace",
    eyebrow: bi("Marketplace", "Marché"),
    title: bi("TAKATAK marketplace", "Marché TAKATAK"),
    tagline: bi(
      "Post a project, get matched with vetted specialists, approve before payment.",
      "Publiez un projet, soyez jumelé à des spécialistes vérifiés, approuvez avant de payer.",
    ),
    intro: bi(
      "Every marketplace project runs in a shared workspace with milestones, files and messaging. Payment is only released once you approve the delivery.",
      "Chaque projet du marché se déroule dans un espace partagé avec jalons, fichiers et messagerie. Le paiement n'est versé qu'après votre approbation.",
    ),
    flow: "marketplace",
    steps: [
      bi("Post your request", "Publier votre demande"),
      bi("Matched with a specialist", "Jumelage avec un spécialiste"),
      bi("Work in the project workspace", "Travail dans l'espace de projet"),
      bi("Approve the delivery", "Approuver la livraison"),
    ],
    benefits: [
      bi("Vetted specialists across every category", "Spécialistes vérifiés dans chaque catégorie"),
      bi("Milestones and files in one workspace", "Jalons et fichiers dans un seul espace"),
      bi("Payment held until you approve", "Paiement retenu jusqu'à votre approbation"),
      bi("TAKATAK support if something goes wrong", "Soutien TAKATAK en cas de problème"),
      bi("Single billing with your other services", "Facturation unique avec vos autres services"),
    ],
    packages: pricing.admin.map((a) => pack(a.key, a.name, a.name, a.amount, a.cadence as Cadence)),
    faq: [
      {
        q: bi("How are specialists selected?", "Comment les spécialistes sont-ils choisis ?"),
        a: bi("By category experience and delivery record on previous TAKATAK projects.", "Selon l'expérience dans la catégorie et l'historique de livraison sur des projets TAKATAK."),
      },
      {
        q: bi("What if the delivery is wrong?", "Et si la livraison ne convient pas ?"),
        a: bi("Request revisions in the workspace; TAKATAK mediates if needed.", "Demandez des révisions dans l'espace de projet ; TAKATAK intervient au besoin."),
      },
      {
        q: bi("When is payment released?", "Quand le paiement est-il versé ?"),
        a: bi("Only after you approve the milestone or final delivery.", "Uniquement après votre approbation du jalon ou de la livraison finale."),
      },
    ],
    cta: { label: bi("Browse marketplace", "Explorer le marché"), to: "/marketplace" },
  },
];

export function getServicePage(slug: string): ServicePage | undefined {
  return servicePages.find((p) => p.slug === slug);
}