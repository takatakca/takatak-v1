"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronRight,
  FileInput,
  LayoutGrid,
  ListFilter,
  MapPin,
  MessageSquare,
  PanelsTopLeft,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Workflow,
} from "lucide-react";
import { BrandHeroBackdrop } from "@/components/brand/brand-hero-backdrop";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

const DASHBOARD = "https://takatak.ca/dashboard/growth/reviews";
const primary =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1565D8] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_-20px_#1F8BFF] transition-colors hover:bg-[#104FAE] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#29C3FF]";
const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1565D8]";

const COPY = {
  en: {
    eyebrow: "TAKATAK REVIEW",
    title: "Every review. A stronger business.",
    intro:
      "Listen across your locations. Give your team one place to review feedback, prepare thoughtful replies and follow every request.",
    cta: "Open my review workspace",
    explore: "Explore the experience",
    promise: "Your reputation deserves more than another disconnected tool.",
    pillars: [
      "One TAKATAK account",
      "French & English",
      "Your team stays in control",
    ],
    demo: "Interactive preview · fictional reviews",
    demoNote:
      "Explore the layouts. These examples are not connected customer accounts.",
    inbox: "Inbox",
    grid: "Cards",
    platforms: "Platforms",
    select: "Choose a review",
    respond: "Open the response workspace",
    fictional: "Example review",
    pending: "To review",
    answered: "Response recorded",
    reviewCount: "3 fictional reviews",
    reviewer: [
      "Example customer A",
      "Example customer B",
      "Example customer C",
    ],
    comments: [
      "A warm welcome and a team that took the time to help. Thank you!",
      "The service was good. Clearer pickup instructions would make the visit easier.",
      "Our team appreciated the attention to detail and the friendly service.",
    ],
    cities: ["Montréal", "Laval", "Québec"],
    selected: "The conversation starts here.",
    selectedDetail:
      "Read the complete context, choose your next action, and keep a human decision behind each public response.",
    sectionEyebrow: "FROM FEEDBACK TO ACTION",
    sectionTitle: "Less switching. More taking care of customers.",
    sectionIntro:
      "A focused workspace for the work that follows an experience: finding the review, understanding it and deciding what happens next.",
    features: [
      {
        title: "An inbox that fits your day",
        body: "Switch between an inbox, list, review cards and platform columns. Keep your filters and selected review as you work.",
      },
      {
        title: "Each location keeps its identity",
        body: "Filter by source location and compare the loaded records. Identically named branches stay separate; cross-platform location matching is not assumed.",
      },
      {
        title: "An import you can inspect",
        body: "Preview authorized CSV exports or enter review fields from an email notification. Check the destination business before saving; repeat imports retain stable identities.",
      },
      {
        title: "Requests with a visible history",
        body: "Create tracked links and follow recorded sending outcomes, opens and first-party ratings. An accepted send is kept distinct from confirmed delivery.",
      },
    ],
    aiEyebrow: "AI ASSISTANCE. HUMAN JUDGMENT.",
    aiTitle: "A reply should sound like your business.",
    aiBody:
      "Request a draft through your existing TAKATAK AI workforce. When a configured worker returns a Google draft, review it in context, edit it and make the publishing decision.",
    aiSteps: [
      "Choose the customer review",
      "Request a draft from your AI workflow",
      "Review, edit and publish through an authorized source",
    ],
    aiNote:
      "AI generation requires an enabled agent and configured worker. A queued request is not a generated or published response.",
    aiCta: "Manage my AI workforce",
    ecosystemEyebrow: "PART OF TAKATAK.CA",
    ecosystemTitle: "Connected to your business. Accountable to your team.",
    ecosystemBody:
      "Keep the same identity, workspace permissions and plan authority as the rest of TAKATAK. Source connections belong to the authorized business, with clear capability and connection states.",
    sourceTitle: "Your sources, with the right access",
    sourceBody:
      "Native Google and QMAPS workflows, TAKATAK feedback and reviewed imports live in the same product. Other platforms have their own access, approval and content rules.",
    sourceNote:
      "Listing a platform does not mean an account is connected. Read, reply and display permissions differ by provider.",
    offersEyebrow: "CHOOSE WITH CLARITY",
    offersTitle: "A workspace today. Room to grow tomorrow.",
    offersBody:
      "Review the published TAKATAK offers and the features available to your account. Provider subscriptions and AI usage depend on the services you activate.",
    offersCta: "View TAKATAK offers",
    offersSecondary: "Open my workspace",
    faqs: [
      {
        q: "Will this create another business account?",
        a: "No. The review workspace uses TAKATAK’s existing account and authorized client workspace. Each member’s current role controls what they can see or manage.",
      },
      {
        q: "Can every platform publish replies automatically?",
        a: "No. Each source exposes different permissions and capabilities. Public replies require an authorized supported connection. Operator imports do not grant publishing access.",
      },
      {
        q: "Does importing from email connect my mailbox?",
        a: "No. This workflow imports review fields you enter from an authorized notification. It does not read your mailbox or private conversations.",
      },
      {
        q: "Are the preview reviews real?",
        a: "No. The interactive preview uses fictional records to demonstrate the layouts. Open your authorized workspace to work with your business data.",
      },
    ],
    faqTitle: "A few clear answers.",
    finalTitle: "Make the next customer conversation count.",
    finalBody:
      "Give feedback a place in your daily work, with the people and tools already in your TAKATAK ecosystem.",
  },
  fr: {
    eyebrow: "TAKATAK REVIEW",
    title: "Chaque avis. Une entreprise plus forte.",
    intro:
      "Écoutez vos clients, dans chaque établissement. Offrez à votre équipe un espace pour traiter les avis, préparer des réponses et suivre chaque demande.",
    cta: "Ouvrir mon espace d’avis",
    explore: "Découvrir l’expérience",
    promise:
      "Votre réputation mérite mieux qu’un outil de plus à gérer séparément.",
    pillars: [
      "Un seul compte TAKATAK",
      "Français et anglais",
      "Votre équipe garde le contrôle",
    ],
    demo: "Aperçu interactif · avis fictifs",
    demoNote:
      "Explorez les dispositions. Ces exemples ne sont pas des comptes clients connectés.",
    inbox: "Boîte d’avis",
    grid: "Cartes",
    platforms: "Plateformes",
    select: "Choisir un avis",
    respond: "Ouvrir l’espace de réponse",
    fictional: "Avis d’exemple",
    pending: "À examiner",
    answered: "Réponse enregistrée",
    reviewCount: "3 avis fictifs",
    reviewer: ["Client fictif A", "Client fictif B", "Client fictif C"],
    comments: [
      "Un accueil chaleureux et une équipe qui a pris le temps de nous aider. Merci!",
      "Le service était bon. Des indications de cueillette plus claires faciliteraient la visite.",
      "Notre équipe a apprécié le souci du détail et le service attentionné.",
    ],
    cities: ["Montréal", "Laval", "Québec"],
    selected: "La conversation commence ici.",
    selectedDetail:
      "Lisez le contexte, choisissez la prochaine action et gardez une décision humaine derrière chaque réponse publique.",
    sectionEyebrow: "DE L’AVIS À L’ACTION",
    sectionTitle: "Moins de navigation. Plus d’attention aux clients.",
    sectionIntro:
      "Un espace consacré à ce qui suit l’expérience : trouver l’avis, le comprendre et décider de la suite.",
    features: [
      {
        title: "Une boîte d’avis à votre façon",
        body: "Passez de la boîte d’avis à la liste, aux cartes ou aux colonnes par plateforme. Gardez vos filtres et l’avis sélectionné pendant le travail.",
      },
      {
        title: "Chaque établissement garde son identité",
        body: "Filtrez par établissement source et comparez les données chargées. Les succursales homonymes restent séparées; aucun rapprochement entre plateformes n’est présumé.",
      },
      {
        title: "Un import que vous pouvez vérifier",
        body: "Prévisualisez un export CSV autorisé ou saisissez les champs d’un avis reçu par courriel. Vérifiez l’établissement avant de sauvegarder; les identifiants stables limitent les doublons.",
      },
      {
        title: "Des demandes avec un historique visible",
        body: "Créez des liens suivis et consultez les résultats d’envoi, les ouvertures et les évaluations internes enregistrées. Un envoi accepté reste distinct d’une livraison confirmée.",
      },
    ],
    aiEyebrow: "L’IA VOUS ASSISTE. VOUS DÉCIDEZ.",
    aiTitle: "Une réponse à l’image de votre entreprise.",
    aiBody:
      "Demandez un brouillon à votre équipe IA TAKATAK existante. Lorsqu’un agent configuré retourne un brouillon Google, relisez-le dans son contexte, ajustez-le et décidez de sa publication.",
    aiSteps: [
      "Choisissez l’avis du client",
      "Demandez un brouillon à votre flux IA",
      "Relisez, ajustez et publiez par une source autorisée",
    ],
    aiNote:
      "La génération demande un agent activé et un service de traitement configuré. Une demande en attente n’est pas une réponse générée ou publiée.",
    aiCta: "Gérer mon équipe IA",
    ecosystemEyebrow: "DANS L’ÉCOSYSTÈME TAKATAK.CA",
    ecosystemTitle:
      "Relié à votre entreprise. Sous le contrôle de votre équipe.",
    ecosystemBody:
      "Gardez l’identité, les droits d’accès et la gestion des forfaits du reste de TAKATAK. Les connexions appartiennent à l’entreprise autorisée, avec des capacités et des états de connexion explicites.",
    sourceTitle: "Vos sources, avec les bons accès",
    sourceBody:
      "Les flux Google et QMAPS existants, les commentaires TAKATAK et les imports examinés se retrouvent dans le même produit. Les autres plateformes ont leurs propres accès, approbations et règles de contenu.",
    sourceNote:
      "La présence d’une plateforme n’indique pas qu’un compte est connecté. Les droits de lecture, de réponse et d’affichage varient selon le fournisseur.",
    offersEyebrow: "CHOISISSEZ EN CONNAISSANCE DE CAUSE",
    offersTitle: "Un espace aujourd’hui. De la place pour grandir.",
    offersBody:
      "Consultez les offres TAKATAK publiées et les fonctions accessibles à votre compte. Les abonnements fournisseurs et l’utilisation de l’IA dépendent des services activés.",
    offersCta: "Voir les offres TAKATAK",
    offersSecondary: "Ouvrir mon espace",
    faqs: [
      {
        q: "Est-ce que cela crée un autre compte d’entreprise?",
        a: "Non. L’espace d’avis utilise le compte TAKATAK existant et l’espace client autorisé. Le rôle courant de chaque membre détermine ce qu’il peut consulter ou gérer.",
      },
      {
        q: "Toutes les plateformes peuvent-elles publier automatiquement?",
        a: "Non. Chaque source offre ses propres capacités et droits. Une réponse publique nécessite une connexion autorisée et prise en charge. Un import manuel ne donne pas le droit de publier.",
      },
      {
        q: "L’import d’un courriel connecte-t-il ma boîte de réception?",
        a: "Non. Ce parcours importe les champs d’avis que vous saisissez à partir d’une notification autorisée. Il ne lit pas votre boîte de courriel ni vos conversations privées.",
      },
      {
        q: "Les avis de l’aperçu sont-ils réels?",
        a: "Non. L’aperçu interactif utilise des avis fictifs pour présenter les dispositions. Ouvrez votre espace autorisé pour travailler avec les données de votre entreprise.",
      },
    ],
    faqTitle: "Quelques réponses claires.",
    finalTitle: "Faites compter la prochaine conversation client.",
    finalBody:
      "Donnez une place aux avis dans votre quotidien, avec les personnes et les outils déjà dans votre écosystème TAKATAK.",
  },
};

function PreviewReviewChoice({
  review,
  selected,
  onSelect,
}: {
  review: {
    author: string;
    city: string;
    source: string;
    text: string;
    rating: number;
  };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`w-full rounded-xl border p-4 text-left transition-colors ${focus} ${selected ? "border-[#1F8BFF] bg-[#1F8BFF]/10" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"}`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-white">
          {review.author}
        </span>
        <span className="text-[11px] text-[#B8C4D3]">{review.rating}/5</span>
      </span>
      <span className="mt-1 block text-[11px] text-[#B8C4D3]">
        {review.source} · {review.city}
      </span>
      <span className="mt-3 block text-xs leading-5 text-[#D8E2EE]">
        {review.text}
      </span>
    </button>
  );
}

export function ReviewProductPage() {
  const { tx } = useLanguage();
  const copy = tx(COPY);
  const [layout, setLayout] = useState<"inbox" | "grid" | "platforms">("inbox");
  const [selected, setSelected] = useState(0);
  const reviews = copy.comments.map((text, index) => ({
    text,
    author: copy.reviewer[index],
    city: copy.cities[index],
    source: ["Google", "QMAPS", "TAKATAK"][index],
    rating: [5, 3, 4][index],
  }));
  const icons = [MessageSquare, MapPin, FileInput, Send];

  return (
    <div className="bg-[#F5F8FC] text-[#060D1F]">
      <section
        className="brand-dark relative isolate overflow-hidden bg-[#060D1F] text-[#F5F8FC]"
        aria-labelledby="review-product-title"
      >
        <BrandHeroBackdrop />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-20">
          <div className="grid items-end gap-9 lg:grid-cols-[1.3fr_.7fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[.3em] text-[#29C3FF]">
                {copy.eyebrow}
              </p>
              <h1
                id="review-product-title"
                className="mt-5 max-w-4xl text-balance text-4xl font-extrabold leading-[1.06] tracking-[-.035em] sm:text-6xl lg:text-[68px]"
              >
                {copy.title}
              </h1>
            </div>
            <div>
              <p className="max-w-lg text-base leading-7 text-[#B8C4D3]">
                {copy.intro}
              </p>
              <Link to={DASHBOARD} className={`${primary} mt-6`}>
                {copy.cta}
                <ArrowUpRight aria-hidden size={17} />
              </Link>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
              {copy.pillars.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 text-xs text-[#D8E2EE]"
                >
                  <Check aria-hidden className="text-[#29C3FF]" size={14} />
                  {item}
                </li>
              ))}
            </ul>
            <a
              href="#review-experience"
              className={`inline-flex items-center gap-2 rounded text-xs font-semibold text-[#29C3FF] ${focus}`}
            >
              {copy.explore}
              <ArrowDown aria-hidden size={14} />
            </a>
          </div>
          <div
            id="review-experience"
            className="mt-10 scroll-mt-28 overflow-hidden rounded-2xl border border-white/15 bg-[#0B1B3D]/90 shadow-[0_32px_100px_-35px_rgba(0,0,0,.75)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#29C3FF]/30 bg-[#29C3FF]/10"
                >
                  <Star size={15} className="text-[#29C3FF]" />
                </span>
                <div>
                  <p className="text-sm font-bold tracking-tight text-white">
                    TAKATAK{" "}
                    <span className="font-normal text-[#B8C4D3]">Review</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#B8C4D3]">
                    {copy.demo}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-white/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[.12em] text-[#29C3FF]">
                {copy.reviewCount}
              </span>
            </div>
            <div className="grid lg:grid-cols-[190px_minmax(0,1fr)]">
              <div className="border-b border-white/10 p-4 lg:border-b-0 lg:border-r">
                <p className="hidden px-2 text-[10px] font-semibold uppercase tracking-[.16em] text-[#B8C4D3] lg:block">
                  {copy.select}
                </p>
                <fieldset className="flex flex-wrap gap-2 lg:mt-3 lg:flex-col">
                  <legend className="sr-only">{copy.select}</legend>
                  {[
                    { id: "inbox", label: copy.inbox, icon: MessageSquare },
                    { id: "grid", label: copy.grid, icon: LayoutGrid },
                    {
                      id: "platforms",
                      label: copy.platforms,
                      icon: PanelsTopLeft,
                    },
                  ].map(({ id, label, icon: Icon }) => (
                    <label
                      key={id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold ${layout === id ? "border-[#1F8BFF]/40 bg-[#1F8BFF]/15 text-white" : "border-transparent text-[#B8C4D3] hover:bg-white/5"}`}
                    >
                      <input
                        type="radio"
                        name="review-public-layout"
                        value={id}
                        checked={layout === id}
                        onChange={() => setLayout(id as typeof layout)}
                        className="sr-only peer"
                      />
                      <Icon aria-hidden size={15} />
                      <span className="peer-focus-visible:underline">
                        {label}
                      </span>
                    </label>
                  ))}
                </fieldset>
                <p className="mt-5 hidden border-t border-white/10 pt-4 text-[11px] leading-5 text-[#B8C4D3] lg:block">
                  {copy.demoNote}
                </p>
              </div>
              <div className="min-w-0 p-4 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-white">
                    {layout === "inbox"
                      ? copy.inbox
                      : layout === "grid"
                        ? copy.grid
                        : copy.platforms}
                  </p>
                  <ListFilter
                    aria-hidden
                    className="text-[#B8C4D3]"
                    size={16}
                  />
                </div>
                {layout === "inbox" ? (
                  <div className="grid items-start gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      {reviews.map((_, index) => (
                        <PreviewReviewChoice
                          key={index}
                          review={reviews[index]}
                          selected={selected === index}
                          onSelect={() => setSelected(index)}
                        />
                      ))}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.05] p-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#29C3FF]">
                        {copy.fictional}
                      </p>
                      <h2 className="mt-3 text-lg font-bold text-white">
                        {reviews[selected].author}
                      </h2>
                      <p className="mt-1 text-xs text-[#B8C4D3]">
                        {reviews[selected].source} · {reviews[selected].city}
                      </p>
                      <div
                        role="img"
                        aria-label={`${reviews[selected].rating} / 5`}
                        className="mt-4 flex gap-1 text-[#29C3FF]"
                      >
                        {Array.from({ length: 5 }, (_, index) => (
                          <Star
                            key={index}
                            aria-hidden
                            size={15}
                            fill={
                              index < reviews[selected].rating
                                ? "currentColor"
                                : "none"
                            }
                          />
                        ))}
                      </div>
                      <p className="mt-4 text-sm leading-7 text-[#D8E2EE]">
                        {reviews[selected].text}
                      </p>
                      <Link
                        to={DASHBOARD}
                        className={`mt-6 inline-flex items-center gap-2 rounded-lg bg-[#F5F8FC] px-4 py-2.5 text-xs font-semibold text-[#0B1B3D] ${focus}`}
                      >
                        {copy.respond}
                        <ArrowUpRight aria-hidden size={14} />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {reviews.map((review, index) => (
                      <div key={review.author} className="min-w-0">
                        {layout === "platforms" && (
                          <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#29C3FF]" />
                            {review.source}
                          </p>
                        )}
                        <PreviewReviewChoice
                          review={review}
                          selected={selected === index}
                          onSelect={() => setSelected(index)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="mt-5 text-[11px] leading-5 text-[#B8C4D3] lg:hidden">
                  {copy.demoNote}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#1565D8]">
              {copy.sectionEyebrow}
            </p>
            <h2 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {copy.sectionTitle}
            </h2>
          </div>
          <p className="max-w-xl self-end text-base leading-7 text-slate-600">
            {copy.sectionIntro}
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {copy.features.map((feature, index) => {
            const Icon = icons[index];
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_30px_-22px_#0B1B3D] sm:p-8"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-[#1565D8]">
                    <Icon aria-hidden size={21} />
                  </span>
                  <span
                    aria-hidden
                    className="text-xs font-semibold tracking-[.15em] text-slate-600"
                  >
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-bold tracking-tight">
                  {feature.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
                  {feature.body}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#060D1F] text-[#F5F8FC]">
        <BrandHeroBackdrop />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#29C3FF]">
              {copy.aiEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {copy.aiTitle}
            </h2>
            <p className="mt-5 text-sm leading-7 text-[#B8C4D3]">
              {copy.aiBody}
            </p>
            <Link
              to="https://takatak.ca/dashboard/growth/ai-engine"
              className={`mt-7 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#29C3FF] ${focus}`}
            >
              {copy.aiCta}
              <ArrowUpRight aria-hidden size={16} />
            </Link>
          </div>
          <div className="rounded-2xl border border-white/15 bg-[#0B1B3D]/80 p-6 sm:p-8">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#29C3FF]/30 bg-[#29C3FF]/10 text-[#29C3FF]">
              <Sparkles aria-hidden size={23} />
            </span>
            <ol className="mt-7 space-y-5">
              {copy.aiSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs font-bold text-[#29C3FF]">
                    {index + 1}
                  </span>
                  <span className="pt-0.5 text-sm font-medium leading-6">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-7 border-t border-white/10 pt-5 text-xs leading-6 text-[#B8C4D3]">
              {copy.aiNote}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#1565D8]">
              {copy.ecosystemEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              {copy.ecosystemTitle}
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-600">
              {copy.ecosystemBody}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {[ShieldCheck, Workflow, CheckCheck].map((Icon, index) => (
                <span
                  key={index}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#1565D8]"
                >
                  <Icon aria-hidden size={21} />
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h3 className="text-xl font-bold">{copy.sourceTitle}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {copy.sourceBody}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {["Google", "QMAPS", "TAKATAK", "CSV / Email"].map((source) => (
                <span
                  key={source}
                  className="rounded-xl border border-slate-200 bg-[#F5F8FC] px-4 py-4 text-sm font-semibold text-[#0B1B3D]"
                >
                  {source}
                </span>
              ))}
            </div>
            <p className="mt-5 text-xs leading-6 text-slate-500">
              {copy.sourceNote}
            </p>
            <Link
              to={`${DASHBOARD}#review-connections`}
              className={`mt-5 inline-flex items-center gap-2 rounded text-xs font-semibold text-[#1565D8] ${focus}`}
            >
              {copy.cta}
              <ChevronRight aria-hidden size={15} />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.2em] text-[#1565D8]">
              {copy.offersEyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight">
              {copy.offersTitle}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              {copy.offersBody}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 lg:justify-end">
            <Link to="https://takatak.ca/pricing" className={primary}>
              {copy.offersCta}
              <ArrowRight aria-hidden size={16} />
            </Link>
            <Link
              to={DASHBOARD}
              className={`rounded text-sm font-semibold text-[#1565D8] ${focus}`}
            >
              {copy.offersSecondary}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[.7fr_1.3fr]">
        <h2 className="text-3xl font-extrabold tracking-tight">
          {copy.faqTitle}
        </h2>
        <div className="space-y-3">
          {copy.faqs.map((faq) => (
            <details
              key={faq.q}
              className="rounded-xl border border-slate-200 bg-white px-5 py-4"
            >
              <summary
                className={`cursor-pointer rounded text-sm font-semibold leading-6 ${focus}`}
              >
                {faq.q}
              </summary>
              <p className="mt-3 text-sm leading-7 text-slate-600">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-[#0B1B3D] px-4 py-16 text-center text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[.25em] text-[#29C3FF]">
            GROUPE TAKATAK
          </p>
          <h2 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">
            {copy.finalTitle}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#B8C4D3]">
            {copy.finalBody}
          </p>
          <Link to={DASHBOARD} className={`${primary} mt-7`}>
            {copy.cta}
            <ArrowUpRight aria-hidden size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
