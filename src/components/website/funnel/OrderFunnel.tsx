"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Check, Headset, Link2, Lock, Play, Plus, ShoppingBag, X } from "lucide-react";

import { cadenceSuffix, money, useCopy } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { readStoredPlan } from "@/lib/website/home-plan";
import {
  ADD_ONS,
  EMPTY_FUNNEL,
  STEPS,
  STEP_CATEGORY,
  decodeQuote,
  encodeQuote,
  funnelTotals,
  planKeys,
  recommendedIndex,
  stepOffer,
  type AddOnKey,
  type FunnelState,
  type FunnelTier,
  type LineKey,
  type StepKey,
} from "@/lib/website/order-funnel";
import { Link } from "@/lib/website/nav";
import { CampaignCountdown, WelcomeSaving, useActiveCampaign } from "./Campaign";
import { Ticker } from "./primitives";

type Lang = "en" | "fr";
type Bi = { en: string; fr: string };
const KEY = "takatak:order-funnel";

const C = {
  title: { en: "Your order", fr: "Votre commande" },
  step: { en: "Step {n} of {t}", fr: "Étape {n} sur {t}" },
  cart: { en: "Cart", fr: "Panier" },
  first: { en: "First payment", fr: "Premier paiement" },
  then: { en: "Then", fr: "Ensuite" },
  perMonth: { en: "per month", fr: "par mois" },
  perYear: { en: "per year", fr: "par année" },
  quotes: { en: "{n} on quote", fr: "{n} sur soumission" },
  noPay: { en: "No payment at this step.", fr: "Aucun paiement à cette étape." },
  continue: { en: "Continue", fr: "Continuer" },
  noThanks: { en: "No thanks", fr: "Non merci" },
  back: { en: "Back", fr: "Retour" },
  recommended: { en: "Recommended", fr: "Recommandé" },
  watch: { en: "See how it works", fr: "Voir comment ça marche" },
  chat: { en: "A question? Chat with us", fr: "Une question ? Clavardez avec nous" },
  how: { en: "How it works", fr: "Comment ça marche" },
  howSteps: [
    { en: "Pick your services and tiers. Nothing is charged here.", fr: "Choisissez vos services et vos forfaits. Rien n’est facturé ici." },
    { en: "Create your account: your quote follows you.", fr: "Créez votre compte : votre soumission vous suit." },
    { en: "Our team in Montréal sets everything up with you.", fr: "Notre équipe à Montréal met tout en place avec vous." },
  ],
  quote: { en: "Request a quote", fr: "Demander une soumission" },
  quoteAdded: { en: "Quote requested", fr: "Soumission demandée" },
  quoteNote: { en: "Priced with you before any work. No commitment.", fr: "Chiffré avec vous avant tout travail. Sans engagement." },
  interested: { en: "I’m interested", fr: "Ça m’intéresse" },
  interestedAdded: { en: "On the list", fr: "Sur la liste" },
  waitNote: { en: "Not launched yet. We tell you first, no charge.", fr: "Pas encore lancé. On vous le dit en premier, sans frais." },
  addOn: { en: "Add-on", fr: "En option" },
  add: { en: "Add", fr: "Ajouter" },
  added: { en: "Added", fr: "Ajouté" },
  chance: { en: "Start smaller?", fr: "Commencer plus petit ?" },
  chanceBody: { en: "{t} at {p}. You can upgrade at any time.", fr: "{t} à {p}. Vous pourrez monter de forfait en tout temps." },
  chanceYes: { en: "Add {t}", fr: "Ajouter {t}" },
  chanceNo: { en: "No thanks, skip", fr: "Non merci, passer" },
  review: { en: "Review your order", fr: "Révisez votre commande" },
  empty: { en: "Your cart is empty.", fr: "Votre panier est vide." },
  edit: { en: "Edit", fr: "Modifier" },
  remove: { en: "Remove", fr: "Retirer" },
  save: { en: "Save this quote", fr: "Sauvegarder cette soumission" },
  saved: { en: "Link copied", fr: "Lien copié" },
  confirm: { en: "Create my account and confirm", fr: "Créer mon compte et confirmer" },
  trust: [
    { en: "Secure HTTPS connection", fr: "Connexion sécurisée HTTPS" },
    { en: "Canadian dollars, taxes at checkout", fr: "Dollars canadiens, taxes au paiement" },
    { en: "Bilingual team in Montréal", fr: "Équipe bilingue à Montréal" },
  ],
  business: { en: "What kind of business?", fr: "Quel genre d’entreprise ?" },
  businessSub: { en: "We pre-select the tiers that fit. You can change everything.", fr: "On présélectionne les forfaits qui conviennent. Vous pouvez tout changer." },
  skip: { en: "Skip", fr: "Passer" },
} as const;

const STEP_COPY: Record<StepKey, { name: Bi; title: Bi }> = {
  website: { name: { en: "Website", fr: "Site web" }, title: { en: "Start with your website.", fr: "Commencez par votre site web." } },
  hosting: { name: { en: "Hosting", fr: "Hébergement" }, title: { en: "Keep it fast and online.", fr: "Gardez-le rapide et en ligne." } },
  social: { name: { en: "Social", fr: "Réseaux" }, title: { en: "Post everywhere from one place.", fr: "Publiez partout, d’un seul endroit." } },
  marketing: { name: { en: "Marketing", fr: "Marketing" }, title: { en: "Bring in new customers.", fr: "Attirez de nouveaux clients." } },
  reviews: { name: { en: "Reviews", fr: "Avis" }, title: { en: "Turn customers into reviews.", fr: "Transformez vos clients en avis." } },
  phone: { name: { en: "Phone", fr: "Téléphone" }, title: { en: "A business phone line, soon.", fr: "Une ligne d’affaires, bientôt." } },
  credits: { name: { en: "AI credits", fr: "Crédits IA" }, title: { en: "Let TAK bot do the busywork.", fr: "Laissez TAK bot faire le travail répétitif." } },
};

const BUSINESSES: readonly { key: string; label: Bi; noun: Bi; photo: string; focus: string }[] = [
  { key: "restaurant", label: { en: "Restaurant or café", fr: "Restaurant ou café" }, noun: { en: "restaurant", fr: "restaurant" }, photo: "/photos/commerce-cafe.webp", focus: "45% 50%" },
  { key: "shop", label: { en: "Shop or online store", fr: "Boutique ou commerce en ligne" }, noun: { en: "shop", fr: "commerce" }, photo: "/photos/hero-cafe.webp", focus: "55% 40%" },
  { key: "services", label: { en: "Services and trades", fr: "Services et métiers" }, noun: { en: "trade business", fr: "métier" }, photo: "/photos/artisan-atelier.webp", focus: "35% 40%" },
  { key: "startup", label: { en: "Startup or creator", fr: "Jeune entreprise ou créateur" }, noun: { en: "startup", fr: "jeune entreprise" }, photo: "/photos/studio-design.webp", focus: "55% 40%" },
];

/** Steps that have a 7 s clip in public/media/social. */
const CLIPS: Partial<Record<StepKey, string>> = { website: "website", hosting: "hosting", social: "social", marketing: "marketing", reviews: "reviews" };

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

function useFunnelState(): [FunnelState, (s: FunnelState) => void, boolean] {
  const [state, setState] = useState<FunnelState>(EMPTY_FUNNEL);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    let next: FunnelState | null = q ? decodeQuote(q) : null;
    if (!next) {
      try {
        const raw = window.sessionStorage.getItem(KEY);
        if (raw) next = decodeQuote(raw);
      } catch {
        /* storage may be unavailable */
      }
    }
    if (!next) {
      // Coming from the homepage plan: pre-select the recommended tier of each service there.
      const plan = readStoredPlan();
      next = { business: null, lines: {} };
      for (const step of STEPS) {
        if (!plan.includes(STEP_CATEGORY[step])) continue;
        const offer = stepOffer(step);
        if (offer.kind === "tiers") next.lines[step] = { kind: "price", tier: offer.tiers[recommendedIndex(step, offer.tiers, null)] };
        else next.lines[step] = { kind: offer.kind };
      }
      if (plan.includes("domains")) next.lines.domain = { kind: "price", tier: ADD_ONS.domain.tier() };
      if (plan.includes("local")) next.lines.local = { kind: "price", tier: ADD_ONS.local.tier() };
    }
    setState(next);
    setReady(true);
  }, []);
  const save = (s: FunnelState) => {
    setState(s);
    try {
      window.sessionStorage.setItem(KEY, encodeQuote(s));
    } catch {
      /* storage may be unavailable */
    }
  };
  return [state, save, ready];
}

function TierName({ tier, tk, lang }: { tier: FunnelTier; tk: (k: string) => string; lang: Lang }) {
  if (!tier.literal) return <>{tk(tier.nameKey)}</>;
  return (
    <>
      {tier.nameKey}
      {tier.credits ? ` · ${tier.credits.toLocaleString(lang === "fr" ? "fr-CA" : "en-CA")} ${lang === "fr" ? "crédits" : "credits"}` : ""}
    </>
  );
}

function price(tier: FunnelTier, tk: (k: string) => string, lang: Lang) {
  return `${money(lang, tier.amount)}${cadenceSuffix(tk, tier.cadence)}`;
}

function Modal({ onClose, children, label }: { onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return createPortal(
    <div className="hp hp-portal fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-6" data-theme="light" role="dialog" aria-modal="true" aria-label={label}>
      <div className="tk-fade-in absolute inset-0 bg-[#05070C]/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="tk-modal-in hp-bg relative w-full max-w-lg overflow-hidden rounded-t-[28px] shadow-[0_40px_120px_-30px_rgb(0_0_0/0.6)] sm:rounded-[28px]">{children}</div>
    </div>,
    document.querySelector(".website-surface") ?? document.body,
  );
}

/** The /commander funnel: business type, then one service per step, then the review. */
export function OrderFunnel() {
  const { tk, lang } = useCopy();
  const [state, save, ready] = useFunnelState();
  const [index, setIndex] = useState(-1); // -1 business, 0..6 steps, 7 review
  const [video, setVideo] = useState<StepKey | null>(null);
  const [chance, setChance] = useState<StepKey | null>(null);
  const [offered, setOffered] = useState<Set<StepKey>>(new Set());
  const [how, setHow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bump, setBump] = useState(0);
  const campaign = useActiveCampaign();
  const topRef = useRef<HTMLDivElement>(null);
  const totals = funnelTotals(state);
  const review = index >= STEPS.length;
  const step = index >= 0 && !review ? STEPS[index] : null;
  const business = BUSINESSES.find((b) => b.key === state.business) ?? null;

  useEffect(() => {
    if (ready && state.business) setIndex((i) => (i === -1 ? 0 : i));
  }, [ready, state.business]);

  const go = (i: number) => {
    setIndex(Math.max(-1, Math.min(STEPS.length, i)));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const setLine = (key: LineKey, line: FunnelState["lines"][LineKey] | undefined) => {
    const lines = { ...state.lines };
    if (line) lines[key] = line;
    else delete lines[key];
    save({ ...state, lines });
    if (line) setBump((n) => n + 1);
  };

  const keys = useMemo(() => planKeys(state), [state]);
  const registerHref = keys.length ? `/register?plan=${keys.join(",")}` : "/register";

  const noThanks = (s: StepKey) => {
    const offer = stepOffer(s);
    if (offer.kind === "tiers" && !state.lines[s] && !offered.has(s)) {
      setOffered(new Set(offered).add(s));
      setChance(s);
      return;
    }
    go(index + 1);
  };

  const saveQuote = async () => {
    const url = `${window.location.origin}/commander?q=${encodeQuote(state)}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt(C.save[lang], url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  };

  // ---- pieces ---------------------------------------------------------------
  const cartSummary = (
    <div className="hp-card rounded-[24px] p-5">
      <p className="hp-ink flex items-center justify-between text-[15px] font-semibold">
        {C.cart[lang]}
        <span key={bump} className="tk-pop hp-btn grid h-7 min-w-7 place-items-center rounded-full px-2 text-[12.5px] font-bold">
          {totals.count}
        </span>
      </p>
      <dl className="mt-4 grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="hp-ink-2 text-[13.5px]">{C.first[lang]}</dt>
          <dd className="hp-display hp-ink text-[28px]">
            <Ticker value={totals.first} format={(n) => money(lang, Math.round(n * 100) / 100)} />
          </dd>
        </div>
        {(totals.monthly > 0 || totals.yearly > 0) && (
          <div className="hp-line border-t pt-2">
            <dt className="hp-ink-3 text-[12px] font-semibold">{C.then[lang]}</dt>
            {totals.monthly > 0 && (
              <dd className="hp-ink flex justify-between text-[14px]">
                <span className="hp-ink-2">{C.perMonth[lang]}</span>
                {money(lang, totals.monthly)}
              </dd>
            )}
            {totals.yearly > 0 && (
              <dd className="hp-ink flex justify-between text-[14px]">
                <span className="hp-ink-2">{C.perYear[lang]}</span>
                {money(lang, totals.yearly)}
              </dd>
            )}
          </div>
        )}
        {totals.quotes > 0 && <dd className="hp-ink-2 text-[13px]">{fill(C.quotes[lang], { n: totals.quotes })}</dd>}
      </dl>
      <p className="hp-ink-3 mt-3 flex items-center gap-1.5 text-[12px]">
        <Lock size={12} aria-hidden /> {C.noPay[lang]}
      </p>
    </div>
  );

  const helpRow = (
    <div className="hp-ink-2 mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13.5px]">
      <button type="button" onClick={() => openLiveChat({ page: "/commander", intent: "order_funnel", lang })} className="hp-focus inline-flex items-center gap-1.5 hover:text-[var(--hp-ink)]">
        <Headset size={15} aria-hidden /> {C.chat[lang]}
      </button>
      <button type="button" onClick={() => setHow(true)} className="hp-focus underline-offset-4 hover:text-[var(--hp-ink)] hover:underline">
        {C.how[lang]}
      </button>
    </div>
  );

  // ---- views ------------------------------------------------------------------
  let body: React.ReactNode;
  if (index === -1) {
    body = (
      <div>
        <h1 className="hp-display hp-ink text-balance text-[34px] sm:text-[48px]">{C.business[lang]}</h1>
        <p className="hp-ink-2 mt-3 text-[16px]">{C.businessSub[lang]}</p>
        <ul className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {BUSINESSES.map((b) => (
            <li key={b.key}>
              <button
                type="button"
                onClick={() => {
                  save({ ...state, business: b.key });
                  go(0);
                }}
                className="group hp-focus relative block aspect-[3/4] w-full overflow-hidden rounded-[22px] text-left"
              >
                <Image src={b.photo} alt="" fill sizes="(min-width: 1024px) 220px, 50vw" className="object-cover transition-transform duration-700 group-hover:scale-105" style={{ objectPosition: b.focus }} />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgb(0_0_0/0.8))]" />
                <span className="absolute inset-x-0 bottom-0 p-4 text-[15.5px] font-semibold text-white">{b.label[lang]}</span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => go(0)} className="hp-ink-2 hp-focus mt-6 text-[14px] font-medium underline-offset-4 hover:underline">
          {C.skip[lang]} →
        </button>
      </div>
    );
  } else if (step) {
    const offer = stepOffer(step);
    const cat = STEP_CATEGORY[step];
    const line = state.lines[step];
    const recIdx = offer.kind === "tiers" ? recommendedIndex(step, offer.tiers, state.business) : -1;
    const addOn = (Object.keys(ADD_ONS) as AddOnKey[]).find((k) => ADD_ONS[k].step === step);
    body = (
      <div>
        <p className="hp-accent text-[13px] font-semibold">{fill(C.step[lang], { n: index + 1, t: STEPS.length })}</p>
        <h1 className="hp-display hp-ink mt-2 text-balance text-[34px] sm:text-[48px]">{STEP_COPY[step].title[lang]}</h1>
        <p className="hp-ink-2 mt-3 max-w-2xl text-[16px] leading-7">{tk(`cat.${cat}.promise`)}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {CLIPS[step] && (
            <button type="button" onClick={() => setVideo(step)} className="hp-ghost hp-focus inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold">
              <Play size={14} className="fill-current" aria-hidden /> {C.watch[lang]}
            </button>
          )}
          {business && offer.kind === "tiers" && recIdx >= 0 && (
            <p className="hp-ink text-[14px]">
              {lang === "fr" ? `Pour un ${business.noun.fr}, on recommande ` : `For a ${business.noun.en}, we recommend `}
              <strong>
                <TierName tier={offer.tiers[recIdx]} tk={tk} lang={lang} />
              </strong>
              .
            </p>
          )}
        </div>

        {offer.kind === "tiers" && (
          <ul className={`mt-8 grid gap-3 sm:grid-cols-2 ${offer.tiers.length >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
            {offer.tiers.map((t, i) => {
              const on = line?.kind === "price" && line.tier.id === t.id;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setLine(step, on ? undefined : { kind: "price", tier: t })}
                    className={`hp-focus relative flex h-full w-full flex-col rounded-[22px] p-5 text-left transition-all ${
                      on ? "hp-raised ring-2 ring-[var(--hp-cta)]" : "hp-card hover:shadow-[var(--hp-shadow)]"
                    }`}
                  >
                    {i === recIdx && <span className="mb-2 w-fit rounded-full bg-[var(--hp-cta)] px-2.5 py-0.5 text-[11px] font-semibold text-white">{C.recommended[lang]}</span>}
                    <span className="hp-ink text-[15.5px] font-semibold">
                      <TierName tier={t} tk={tk} lang={lang} />
                    </span>
                    <span className="hp-display hp-ink mt-2 text-[28px]">{money(lang, t.amount)}</span>
                    <span className="hp-ink-2 text-[13px]">
                      {cadenceSuffix(tk, t.cadence)}
                      {t.suffixKey ? ` ${tk(t.suffixKey)}` : ""}
                    </span>
                    {t.detailKeys.length > 0 && (
                      <ul className="hp-ink-2 mt-3 grid gap-1 text-[13px]">
                        {t.detailKeys.map((d) => (
                          <li key={d} className="flex gap-1.5">
                            <Check size={13} className="hp-accent mt-0.5 shrink-0" strokeWidth={2.5} aria-hidden /> {tk(d)}
                          </li>
                        ))}
                      </ul>
                    )}
                    <span className={`mt-auto inline-flex items-center gap-1.5 pt-4 text-[13.5px] font-semibold ${on ? "text-emerald-600" : "hp-accent"}`}>
                      {on ? <Check size={15} strokeWidth={3} aria-hidden /> : <Plus size={15} aria-hidden />} {on ? C.added[lang] : C.add[lang]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {offer.kind !== "tiers" && (
          <div className="hp-card mt-8 flex flex-col gap-4 rounded-[22px] p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="hp-ink-2 text-[15px]">{offer.kind === "quote" ? C.quoteNote[lang] : C.waitNote[lang]}</p>
            <button
              type="button"
              aria-pressed={Boolean(line)}
              onClick={() => setLine(step, line ? undefined : { kind: offer.kind })}
              className={`hp-focus inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-3 text-[14.5px] font-semibold ${line ? "hp-ghost" : "hp-btn"}`}
            >
              {line ? <Check size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
              {offer.kind === "quote" ? (line ? C.quoteAdded[lang] : C.quote[lang]) : line ? C.interestedAdded[lang] : C.interested[lang]}
            </button>
          </div>
        )}

        {addOn && (() => {
          const t = ADD_ONS[addOn].tier();
          const on = Boolean(state.lines[addOn]);
          return (
            <div className="hp-line mt-6 flex items-center justify-between gap-4 rounded-[22px] border border-dashed p-5">
              <div>
                <p className="hp-ink-3 text-[12px] font-semibold">{C.addOn[lang]}</p>
                <p className="hp-ink text-[15.5px] font-semibold">{addOn === "domain" ? tk("cat.domains.name") : tk(t.nameKey)}</p>
                <p className="hp-ink-2 text-[13.5px]">{price(t, tk, lang)}</p>
              </div>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => setLine(addOn, on ? undefined : { kind: "price", tier: t })}
                className={`hp-focus inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-[14px] font-semibold ${on ? "hp-ghost" : "hp-btn"}`}
              >
                {on ? <Check size={15} aria-hidden /> : <Plus size={15} aria-hidden />} {on ? C.added[lang] : C.add[lang]}
              </button>
            </div>
          );
        })()}

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => go(index + 1)} className="hp-btn hp-focus inline-flex items-center gap-2 rounded-full px-8 py-4 text-[16px] font-semibold">
            {C.continue[lang]} <ArrowRight size={17} aria-hidden />
          </button>
          {!line && (
            <button type="button" onClick={() => noThanks(step)} className="hp-ink-2 hp-focus text-[14.5px] font-medium underline-offset-4 hover:text-[var(--hp-ink)] hover:underline">
              {C.noThanks[lang]}
            </button>
          )}
          <button type="button" onClick={() => go(index - 1)} className="hp-ink-3 hp-focus ml-auto inline-flex items-center gap-1 text-[14px] hover:text-[var(--hp-ink)]">
            <ArrowLeft size={15} aria-hidden /> {C.back[lang]}
          </button>
        </div>
        {helpRow}
      </div>
    );
  } else {
    const entries = (Object.keys(state.lines) as LineKey[]).filter((k) => state.lines[k]);
    body = (
      <div>
        <h1 className="hp-display hp-ink text-[34px] sm:text-[48px]">{C.review[lang]}</h1>
        {campaign && <CampaignCountdown campaign={campaign} lang={lang} className="mt-5" />}
        {entries.length ? (
          <ul className="hp-divide mt-6">
            {entries.map((k) => {
              const line = state.lines[k]!;
              const stepIndex = STEPS.indexOf((k === "domain" ? "hosting" : k === "local" ? "reviews" : k) as StepKey);
              const name =
                k === "domain" ? tk("cat.domains.name") : k === "local" ? tk("cat.local.name") : STEP_COPY[k as StepKey].name[lang];
              return (
                <li key={k} className="flex flex-wrap items-center gap-3 py-4">
                  <span className="min-w-0 flex-1">
                    <span className="hp-ink block text-[16px] font-semibold">{name}</span>
                    <span className="hp-ink-2 block text-[13.5px]">
                      {line.kind === "price" ? (
                        k === "domain" ? (
                          price(line.tier, tk, lang)
                        ) : (
                          <>
                            <TierName tier={line.tier} tk={tk} lang={lang} /> · {price(line.tier, tk, lang)}
                          </>
                        )
                      ) : line.kind === "quote" ? (
                        C.quoteAdded[lang]
                      ) : (
                        C.interestedAdded[lang]
                      )}
                    </span>
                  </span>
                  <button type="button" onClick={() => go(stepIndex)} className="hp-ink-2 hp-focus text-[13.5px] underline-offset-4 hover:underline">
                    {C.edit[lang]}
                  </button>
                  <button type="button" onClick={() => setLine(k, undefined)} className="hp-ink-3 hp-focus text-[13.5px] underline-offset-4 hover:underline">
                    {C.remove[lang]}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="hp-ink-2 mt-6">{C.empty[lang]}</p>
        )}
        {keys.length > 0 && (
          <div className="mt-6">
            <WelcomeSaving keys={keys} lang={lang} serviceName={(k) => tk(`cat.${k}.name`)} />
          </div>
        )}
        <ul className="hp-ink-2 mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
          {C.trust.map((t) => (
            <li key={t.en} className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-600" strokeWidth={2.5} aria-hidden /> {t[lang]}
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link to={registerHref} className="hp-cta hp-halo hp-focus inline-flex items-center gap-2 rounded-full px-8 py-4 text-[16px] font-semibold">
            {C.confirm[lang]} <ArrowRight size={17} aria-hidden />
          </Link>
          <button type="button" onClick={saveQuote} className="hp-ghost hp-focus inline-flex items-center gap-2 rounded-full px-5 py-4 text-[15px] font-semibold">
            <Link2 size={16} aria-hidden /> {copied ? C.saved[lang] : C.save[lang]}
          </button>
          <button type="button" onClick={() => go(STEPS.length - 1)} className="hp-ink-3 hp-focus ml-auto inline-flex items-center gap-1 text-[14px] hover:text-[var(--hp-ink)]">
            <ArrowLeft size={15} aria-hidden /> {C.back[lang]}
          </button>
        </div>
        <p className="hp-ink-3 mt-4 flex items-center gap-1.5 text-[12.5px]">
          <Lock size={12} aria-hidden /> {C.noPay[lang]}
        </p>
        {helpRow}
      </div>
    );
  }

  const chanceTier = chance ? (() => {
    const offer = stepOffer(chance);
    return offer.kind === "tiers" ? [...offer.tiers].sort((a, b) => a.amount - b.amount)[0] : null;
  })() : null;

  return (
    <div ref={topRef} className="hp-bg min-h-[80vh]" style={{ scrollMarginTop: "var(--tk-header-h, 64px)" }}>
      {/* Progress + cart counter */}
      <div className="hp-line sticky z-30 border-b backdrop-blur-xl" style={{ top: "var(--tk-header-h, 64px)", background: "color-mix(in oklab, var(--hp-bg) 94%, transparent)" }}>
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
          <p className="hp-ink hidden text-[14px] font-semibold sm:block">{C.title[lang]}</p>
          <ol className="tk-no-scrollbar flex flex-1 items-center gap-1 overflow-x-auto">
            {STEPS.map((s, i) => (
              <li key={s} className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? "step" : undefined}
                  className={`hp-focus rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    i === index ? "hp-btn" : state.lines[s] ? "hp-ink" : "hp-ink-3 hover:text-[var(--hp-ink)]"
                  }`}
                >
                  {state.lines[s] && i !== index && <Check size={12} className="mr-1 inline text-emerald-600" strokeWidth={3} aria-hidden />}
                  {STEP_COPY[s].name[lang]}
                </button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => go(STEPS.length)} className="hp-ink hp-focus inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-[13.5px] font-semibold hover:bg-[var(--hp-alt)]">
            <span className="relative">
              <ShoppingBag size={18} aria-hidden />
              <span key={bump} className="tk-pop absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--hp-cta)] px-1 text-[10px] font-bold text-white">
                {totals.count}
              </span>
            </span>
            <span className="tabular-nums">{money(lang, totals.first)}</span>
          </button>
        </div>
        <div className="h-[3px] bg-[var(--hp-line)]">
          <div className="h-full bg-[var(--hp-cta)] transition-all duration-700" style={{ width: `${((Math.max(index, -1) + 1) / (STEPS.length + 1)) * 100}%` }} />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:py-16">
        <div key={index} className="tk-slide-in min-w-0">
          {body}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky" style={{ top: "calc(var(--tk-header-h, 64px) + 90px)" }}>
            {cartSummary}
          </div>
        </aside>
      </div>

      {/* Mobile total bar */}
      <div className="hp-line fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t px-4 py-3 lg:hidden" style={{ background: "var(--hp-bg)" }}>
        <span className="hp-ink text-[14px]">
          {C.first[lang]} <strong className="tabular-nums">{money(lang, totals.first)}</strong>
        </span>
        <button type="button" onClick={() => go(STEPS.length)} className="hp-btn rounded-full px-4 py-2 text-[13.5px] font-semibold">
          {C.cart[lang]} ({totals.count})
        </button>
      </div>

      {video && CLIPS[video] && (
        <Modal onClose={() => setVideo(null)} label={C.watch[lang]}>
          <button type="button" onClick={() => setVideo(null)} aria-label={lang === "fr" ? "Fermer" : "Close"} className="hp-btn absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full">
            <X size={16} aria-hidden />
          </button>
          <video className="mx-auto aspect-[9/16] max-h-[78vh] w-auto bg-black" src={`/media/social/${CLIPS[video]}-${lang}.mp4`} autoPlay muted loop playsInline controls />
        </Modal>
      )}

      {chance && chanceTier && (
        <Modal onClose={() => setChance(null)} label={C.chance[lang]}>
          <div className="p-7">
            <p className="hp-display hp-ink text-[26px]">{C.chance[lang]}</p>
            <p className="hp-ink-2 mt-2 text-[15px]">
              {fill(C.chanceBody[lang], { t: chanceTier.literal ? chanceTier.nameKey : tk(chanceTier.nameKey), p: price(chanceTier, tk, lang) })}
            </p>
            <div className="mt-6 grid gap-2">
              <button
                type="button"
                onClick={() => {
                  setLine(chance, { kind: "price", tier: chanceTier });
                  setChance(null);
                  go(index + 1);
                }}
                className="hp-btn hp-focus rounded-full px-6 py-3.5 text-[15px] font-semibold"
              >
                {fill(C.chanceYes[lang], { t: chanceTier.literal ? chanceTier.nameKey : tk(chanceTier.nameKey) })}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChance(null);
                  go(index + 1);
                }}
                className="hp-ink-2 hp-focus py-2 text-[14px] font-medium underline-offset-4 hover:underline"
              >
                {C.chanceNo[lang]}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {how && (
        <Modal onClose={() => setHow(false)} label={C.how[lang]}>
          <div className="p-7">
            <p className="hp-display hp-ink text-[26px]">{C.how[lang]}</p>
            <ol className="mt-5 grid gap-4">
              {C.howSteps.map((s, i) => (
                <li key={s.en} className="tk-stagger flex gap-3" style={{ animationDelay: `${i * 120}ms` }}>
                  <span className="hp-btn grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-bold">{i + 1}</span>
                  <span className="hp-ink text-[15px]">{s[lang]}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setHow(false)} className="hp-btn hp-focus mt-6 w-full rounded-full px-6 py-3.5 text-[15px] font-semibold">
              OK
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
