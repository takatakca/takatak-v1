"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronDown, KeyRound, Network, Play, ShieldCheck, Unplug } from "lucide-react";

import { ACCENT, APPS, Mini, type F } from "@/components/website/funnel/CloverSuite";
import { ClipModal } from "@/components/website/funnel/MediaLoop";
import { Reveal } from "@/components/website/home/Reveal";
import { useHeaderHeight } from "@/components/website/premium/CategoryNavigator";
import { NavyBackdrop } from "@/components/website/premium/ui";
import { openLiveChat } from "@/lib/website/chat-provider";
import { Link } from "@/lib/website/nav";
import { useInViewport } from "@/lib/website/use-in-viewport";
import { useLanguage } from "@/lib/website/use-language";
import { useReducedMotion } from "@/lib/website/use-reduced-motion";

type T = { fr: string; en: string };

/** What each app does, from its own repository README (takatakca/<APP>). */
const DETAILS: Record<string, { tagline: T; does: T[]; with: T; state: "draft" | "spec" }> = {
  c4isse: {
    tagline: { fr: "La caisse du comptoir, plus rapide.", en: "The counter register, faster." },
    does: [
      { fr: "Écran de vente rapide pour le comptoir, à côté du Register Clover.", en: "A fast sales screen for the counter, next to the Clover Register." },
      { fr: "Caisse-photo : vos produits en images, un toucher par article.", en: "Picture register: your products as pictures, one tap per item." },
      { fr: "Rapport de la journée et tiroir-caisse (forfait VIP).", en: "Day report and cash drawer (VIP plan)." },
    ],
    with: { fr: "Les ventes vont à 4CCOUNTING ; les clients fidèles gagnent leurs points avec LOY4LTY.", en: "Sales flow to 4CCOUNTING; loyal customers earn points with LOY4LTY." },
    state: "draft",
  },
  t4ctile: {
    tagline: { fr: "La borne libre-service, comme les grandes chaînes.", en: "The self-service kiosk, like the big chains." },
    does: [
      { fr: "Menu en photos plein écran, gros boutons, branché sur votre vrai menu Clover.", en: "Full-screen photo menu, big buttons, plugged into your real Clover menu." },
      { fr: "La commande est créée dans Clover et imprimée en cuisine.", en: "The order is created in Clover and printed in the kitchen." },
      { fr: "Écran « commande prête » relié à Food Hub ; paiement sur l’appareil.", en: "\"Order ready\" screen linked to Food Hub; payment on the device." },
    ],
    with: { fr: "Chaque commande arrive sur l’écran de cuisine Food Hub, une seule fois.", en: "Each order lands on the Food Hub kitchen screen, exactly once." },
    state: "draft",
  },
  "4ccounting": {
    tagline: { fr: "Vos livres, prêts pour le comptable.", en: "Your books, ready for the accountant." },
    does: [
      { fr: "Ventes du jour, TPS et TVQ ventilées, pourboires, modes de paiement.", en: "Daily sales, GST and QST split, tips, payment methods." },
      { fr: "Ventes des plateformes de livraison reçues par Food Hub.", en: "Delivery-platform sales received through Food Hub." },
      { fr: "Exports CSV pour votre comptable.", en: "CSV exports for your accountant." },
    ],
    with: { fr: "Ajoute le passif des cartes-cadeaux (REW4RDS) et le coût de main-d’œuvre (ST4FF).", en: "Adds gift-card liability (REW4RDS) and labour cost (ST4FF)." },
    state: "draft",
  },
  tr4cker: {
    tagline: { fr: "Vos propres livraisons, suivies en direct.", en: "Your own deliveries, tracked live." },
    does: [
      { fr: "Position du livreur rattachée à la commande Clover, lien de suivi pour le client.", en: "Courier position tied to the Clover order, a tracking link for the customer." },
      { fr: "Après la livraison : pourboire et avis ; un bon avis va vers Google, un moins bon reste chez vous.", en: "After delivery: tip and review; a good review goes to Google, a weaker one stays with you." },
      { fr: "Commandes directes reçues de Food Hub.", en: "Direct orders received from Food Hub." },
    ],
    with: { fr: "Le pendant « à votre nom » des plateformes de livraison.", en: "The \"under your name\" side of delivery platforms." },
    state: "draft",
  },
  st4ff: {
    tagline: { fr: "L’équipe au même endroit que les ventes.", en: "The team in the same place as the sales." },
    does: [
      { fr: "Heures tirées des quarts Clover, pointeuse, horaires planifiés.", en: "Hours from Clover shifts, time clock, planned schedules." },
      { fr: "Salaires et coût de main-d’œuvre en pourcentage des ventes.", en: "Wages and labour cost as a share of sales." },
    ],
    with: { fr: "Le coût de main-d’œuvre va dans 4CCOUNTING.", en: "Labour cost goes into 4CCOUNTING." },
    state: "draft",
  },
  m4rketing: {
    tagline: { fr: "Des promotions branchées sur vos vraies ventes.", en: "Promotions plugged into your real sales." },
    does: [
      { fr: "Segments de clients bâtis sur vos commandes Clover.", en: "Customer segments built on your Clover orders." },
      { fr: "Rabais Clover « M4 · … » créés pour vous, campagnes approuvées avant l’envoi.", en: "Clover discounts \"M4 · …\" created for you, campaigns approved before sending." },
      { fr: "Export seulement des clients qui ont consenti (LCAP).", en: "Export only of customers who consented (CASL)." },
    ],
    with: { fr: "Récompense les clients fidèles repérés par LOY4LTY.", en: "Rewards the loyal customers LOY4LTY recognises." },
    state: "draft",
  },
  loy4lty: {
    tagline: { fr: "La fidélité par numéro de téléphone.", en: "Loyalty by phone number." },
    does: [
      { fr: "Inscription automatique au comptoir avec le numéro du client.", en: "Automatic sign-up at the counter with the customer's number." },
      { fr: "Points crédités après un paiement confirmé (par défaut, 1 point par dollar).", en: "Points credited after a confirmed payment (by default, 1 point per dollar)." },
      { fr: "Échange des points en rabais sur la commande.", en: "Points redeemed as a discount on the order." },
    ],
    with: { fr: "Les autres apps reconnaissent le client par un code, jamais par son numéro.", en: "Other apps recognise the customer by a code, never by their number." },
    state: "draft",
  },
  rew4rd: {
    tagline: { fr: "Des cartes-cadeaux complètes.", en: "Complete gift cards." },
    does: [
      { fr: "Vente à la caisse et sur votre site (la vente web devient une vraie commande Clover).", en: "Sold at the register and on your site (a web sale becomes a real Clover order)." },
      { fr: "Paiement partiel, recharges, codes protégés.", en: "Partial payment, reloads, protected codes." },
      { fr: "Loi du Québec : aucune date d’expiration, aucuns frais d’inactivité.", en: "Québec law: no expiry date, no inactivity fees." },
    ],
    with: { fr: "Le passif des cartes va dans 4CCOUNTING.", en: "Card liability goes into 4CCOUNTING." },
    state: "draft",
  },
  ch4t: {
    tagline: { fr: "Le soutien client, avec le contexte Clover.", en: "Customer support, with the Clover context." },
    does: [
      { fr: "Conversations internes avec la commande et le client Clover sous les yeux.", en: "Internal threads with the Clover order and customer in view." },
      { fr: "Modèles de réponses pour votre équipe.", en: "Reply templates for your team." },
    ],
    with: { fr: "En spécification : aucun message n’est encore envoyé aux clients.", en: "In specification: no message is sent to customers yet." },
    state: "spec",
  },
};

const RULES: { icon: typeof Network; t: T; d: T }[] = [
  { icon: Unplug, t: { fr: "Chacune fonctionne seule", en: "Each one works alone" }, d: { fr: "Installez une seule app : elle lit Clover avec sa propre autorisation et fait tout son travail.", en: "Install just one app: it reads Clover with its own permission and does its whole job." } },
  { icon: Network, t: { fr: "Ensemble par Food Hub", en: "Together through Food Hub" }, d: { fr: "Avec Food Hub, les apps reçoivent les commandes en direct et se passent l’information. Retirez-en une, les autres continuent.", en: "With Food Hub, apps receive orders live and pass information along. Remove one, the others keep going." } },
  { icon: KeyRound, t: { fr: "Votre marchand Clover est la clé", en: "Your Clover merchant is the key" }, d: { fr: "Toutes les apps parlent du même restaurant grâce à votre identifiant de marchand Clover.", en: "Every app talks about the same restaurant through your Clover merchant ID." } },
  { icon: ShieldCheck, t: { fr: "Aucune donnée nominative ne circule", en: "No named customer data moves" }, d: { fr: "Entre les apps : ce qui a été commandé, où, quand et combien. Jamais le nom, le téléphone, le courriel ou l’adresse d’un client.", en: "Between apps: what was ordered, where, when and how much. Never a customer's name, phone, email or address." } },
];

const FAQ: { q: T; a: T }[] = [
  { q: { fr: "Faut-il installer les neuf ?", en: "Do I need all nine?" }, a: { fr: "Non. Chaque app se vend et fonctionne seule. Ajoutez-en une autre quand vous êtes prêt : elle se branche aux autres par Food Hub.", en: "No. Each app is sold and works alone. Add another when you are ready: it plugs into the others through Food Hub." } },
  { q: { fr: "Combien ça coûte ?", en: "How much does it cost?" }, a: { fr: "Le prix de chaque app sera affiché sur le Clover App Market au lancement, et facturé par Clover avec votre abonnement.", en: "Each app's price will be shown on the Clover App Market at launch, and billed by Clover with your subscription." } },
  { q: { fr: "Quand est-ce disponible ?", en: "When is it available?" }, a: { fr: "Les apps sont construites ; leurs fiches sont en préparation au portail Clover. Laissez-nous vos coordonnées et on vous avise au lancement.", en: "The apps are built; their listings are being prepared on the Clover portal. Leave your details and we'll tell you at launch." } },
  { q: { fr: "J’ai déjà une caisse Clover. Est-ce compatible ?", en: "I already have a Clover register. Is it compatible?" }, a: { fr: "Oui, c’est fait pour ça : les apps s’ajoutent à votre Clover, sans remplacer votre caisse.", en: "Yes, that's the point: the apps add to your Clover, without replacing your register." } },
  { q: { fr: "Et mes données ?", en: "What about my data?" }, a: { fr: "Chaque app garde ses propres données, liées à votre marchand Clover. Les autorisations Clover sont chiffrées et ne sont jamais affichées.", en: "Each app keeps its own data, tied to your Clover merchant. Clover permissions are encrypted and never shown." } },
];

function useTick(active: boolean) {
  const reduced = useReducedMotion();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduced || !active) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1250);
    return () => window.clearInterval(id);
  }, [reduced, active]);
  return reduced ? null : tick;
}

/** A mini screen, enlarged (DOM, so it stays sharp). */
function BigScreen({ app, f, scale = 2 }: { app: string; f: F; scale?: number }) {
  const { lang } = useLanguage();
  return (
    <div className="rounded-[22px] bg-[linear-gradient(160deg,#1B2436,#0B1220)] p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.8)] ring-1 ring-white/10" aria-hidden>
      <div className="overflow-hidden rounded-[14px]" style={{ width: 112 * scale, height: 84 * scale }}>
        <div style={{ width: 112, height: 84, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <Mini app={app} f={f} lang={lang} />
        </div>
      </div>
    </div>
  );
}

function AppSection({ index }: { index: number }) {
  const { tx } = useLanguage();
  const p = APPS[index];
  const d = DETAILS[p.key];
  const [ref, inView] = useInViewport<HTMLDivElement>({ once: false, threshold: 0.3 });
  const tick = useTick(inView);
  const f = (tick === null ? 3 : tick % 4) as F;
  const flip = index % 2 === 1;
  return (
    <section id={p.key} aria-labelledby={`${p.key}-title`} className="relative py-14 sm:py-20" style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.06]" />
      <div ref={ref} className={`mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <Reveal className="flex justify-center">
          <div className="hidden sm:block">
            <BigScreen app={p.key} f={f} scale={3.2} />
          </div>
          <div className="sm:hidden">
            <BigScreen app={p.key} f={f} scale={2.5} />
          </div>
        </Reveal>
        <Reveal delay={80}>
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: ACCENT[p.key] }}>
            <span className="h-2 w-2 rounded-full" style={{ background: ACCENT[p.key] }} aria-hidden /> {String(index + 1).padStart(2, "0")} / {String(APPS.length).padStart(2, "0")}
          </p>
          <h2 id={`${p.key}-title`} className="mt-3 text-[34px] font-extrabold tracking-[0.04em] text-white sm:text-[44px]">
            {p.name}
          </h2>
          <p className="mt-2 text-[19px] font-semibold text-white/85">{tx(d.tagline)}</p>
          <ul className="mt-5 grid gap-2.5">
            {d.does.map((l) => (
              <li key={l.en} className="flex gap-3 text-[15.5px] leading-7 text-white/72">
                <Check size={17} className="mt-1.5 shrink-0" style={{ color: ACCENT[p.key] }} aria-hidden />
                {tx(l)}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-2xl bg-white/[0.04] px-4 py-3 text-[14.5px] leading-6 text-white/65 ring-1 ring-white/10">{tx(d.with)}</p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3 py-1 text-[12.5px] font-semibold text-white/70 ring-1 ring-white/10">
            <span className={`h-1.5 w-1.5 rounded-full ${d.state === "spec" ? "bg-amber-300" : "bg-sky-300"}`} aria-hidden />
            {d.state === "spec"
              ? tx({ fr: "En spécification", en: "In specification" })
              : tx({ fr: "Bientôt sur le Clover App Market", en: "Coming to the Clover App Market" })}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/** The full Clover suite page (/clover): the nine apps, how they work together, and what they never share. */
export function CloverSuitePage() {
  const { tx, lang } = useLanguage();
  useHeaderHeight();
  const [clip, setClip] = useState(false);
  const [ref, inView] = useInViewport<HTMLDivElement>({ once: false, threshold: 0.2 });
  const tick = useTick(inView);

  return (
    <div className="tk-page tk-premium brand-dark bg-[#060D1F] text-white">
      {/* Promise */}
      <section aria-labelledby="clover-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden /> {tx({ fr: "Suite Clover · TAKATAK", en: "Clover suite · TAKATAK" })}
            </p>
            <h1 id="clover-title" className="tk-gradient-text mt-6 text-balance text-[38px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
              {tx({ fr: "Neuf applications pour votre caisse Clover.", en: "Nine apps for your Clover register." })}
            </h1>
            <p className="mt-5 text-base leading-7 text-white/72 sm:text-[17px]">
              {tx({
                fr: "Caisse, borne, comptabilité, livraisons, équipe, marketing, fidélité, cartes-cadeaux et soutien. Chacune fonctionne seule ; ensemble, elles se parlent par TAKATAK Food Hub.",
                en: "Register, kiosk, accounting, deliveries, team, marketing, loyalty, gift cards and support. Each works alone; together they talk through TAKATAK Food Hub.",
              })}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => openLiveChat({ page: "/clover", intent: "clover_waitlist", lang })}
                className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold"
              >
                {tx({ fr: "Être avisé au lancement", en: "Get notified at launch" })} <ArrowRight size={16} aria-hidden />
              </button>
              <button type="button" onClick={() => setClip(true)} className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold">
                <Play size={15} className="fill-current" aria-hidden /> {tx({ fr: "Voir la vidéo · 14 s", en: "Watch the video · 14 s" })}
              </button>
            </div>
          </div>
          <div ref={ref} className="lg:col-span-7">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              {APPS.map((p, i) => (
                <a key={p.key} href={`#${p.key}`} className="group block rounded-2xl p-1.5 transition-transform hover:-translate-y-1" aria-label={p.name}>
                  <div className="aspect-[4/3] rounded-[14px] bg-[linear-gradient(160deg,#1B2436,#0B1220)] p-1 ring-1 ring-white/10" aria-hidden>
                    <Mini app={p.key} f={(tick === null ? 3 : (tick + i * 3) % 4) as F} lang={lang} />
                  </div>
                  <span className="mt-1.5 flex items-center gap-1.5 text-[12px] font-bold tracking-[0.06em] text-white/85">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT[p.key] }} aria-hidden /> {p.name}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* App menu */}
      <nav aria-label={tx({ fr: "Les neuf applications", en: "The nine apps" })} className="sticky z-30 border-y border-white/[0.08] bg-[#060D1F]/95 backdrop-blur-xl" style={{ top: "var(--tk-header-h, 64px)" }}>
        <ul className="tk-no-scrollbar mx-auto flex max-w-7xl gap-1.5 overflow-x-auto px-4 py-2.5">
          <li className="shrink-0">
            <a href="#clover-how" className="inline-flex rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white/65 hover:text-white">
              {tx({ fr: "Comment ça marche", en: "How it works" })}
            </a>
          </li>
          {APPS.map((p) => (
            <li key={p.key} className="shrink-0">
              <a href={`#${p.key}`} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] font-semibold tracking-[0.04em] text-white/65 hover:text-white">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ACCENT[p.key] }} aria-hidden /> {p.name}
              </a>
            </li>
          ))}
          <li className="shrink-0">
            <a href="#clover-faq" className="inline-flex rounded-full border border-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white/65 hover:text-white">FAQ</a>
          </li>
        </ul>
      </nav>

      {/* How the suite works */}
      <section id="clover-how" aria-labelledby="clover-how-title" className="relative bg-[linear-gradient(180deg,rgb(11_27_61/0.55),rgb(11_27_61/0.25))] py-16 sm:py-24" style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}>
        <div className="mx-auto max-w-7xl px-4">
          <Reveal className="max-w-3xl">
            <h2 id="clover-how-title" className="text-3xl font-extrabold tracking-[-0.025em] sm:text-[40px]">
              {tx({ fr: "Une suite, neuf apps indépendantes", en: "One suite, nine independent apps" })}
            </h2>
            <p className="mt-3 text-base leading-7 text-white/65">
              {tx({ fr: "Les mêmes quatre règles pour toutes, écrites dans le contrat de la suite.", en: "The same four rules for all of them, written in the suite's contract." })}
            </p>
          </Reveal>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {RULES.map((r, i) => (
              <Reveal as="li" key={r.t.en} delay={i * 80}>
                <div className="tk-glass h-full rounded-2xl p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
                    <r.icon size={20} aria-hidden />
                  </span>
                  <h3 className="mt-5 text-lg font-bold">{tx(r.t)}</h3>
                  <p className="mt-2 text-[15px] leading-6 text-white/65">{tx(r.d)}</p>
                </div>
              </Reveal>
            ))}
          </ul>
          <Reveal className="mt-6">
            <p className="flex flex-wrap items-center gap-2 text-[14.5px] text-white/65">
              {tx({ fr: "Au centre :", en: "At the centre:" })}
              <Link to="/#suite" className="inline-flex items-center gap-1 font-semibold text-sky-300 hover:underline">
                TAKATAK Food Hub <ArrowRight size={14} aria-hidden />
              </Link>
              {tx({ fr: "· une tablette pour toutes vos commandes.", en: "· one tablet for every order." })}
            </p>
          </Reveal>
        </div>
      </section>

      {APPS.map((p, i) => (
        <AppSection key={p.key} index={i} />
      ))}

      {/* FAQ */}
      <section id="clover-faq" aria-labelledby="clover-faq-title" className="relative bg-[linear-gradient(180deg,rgb(11_27_61/0.55),rgb(11_27_61/0.25))] py-16 sm:py-24" style={{ scrollMarginTop: "calc(var(--tk-header-h, 64px) + 56px)" }}>
        <div className="mx-auto max-w-3xl px-4">
          <h2 id="clover-faq-title" className="text-3xl font-extrabold tracking-[-0.025em] sm:text-[40px]">
            {tx({ fr: "Questions fréquentes", en: "Frequently asked questions" })}
          </h2>
          <div className="mt-8 grid gap-3">
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
        </div>
      </section>

      {/* Start */}
      <section className="px-4 pb-20 pt-10">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0B1B3D,#1565D8_60%,#29C3FF)] p-8 text-center sm:p-12">
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">{tx({ fr: "Soyez parmi les premiers restaurants.", en: "Be among the first restaurants." })}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[16px] leading-7 text-white/80">
            {tx({ fr: "On vous avise dès que les apps sont sur le Clover App Market, et on vous aide à les installer.", en: "We'll tell you as soon as the apps are on the Clover App Market, and help you install them." })}
          </p>
          <button
            type="button"
            onClick={() => openLiveChat({ page: "/clover", intent: "clover_waitlist", lang })}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[15px] font-bold text-[#0B1B3D] hover:bg-blue-50"
          >
            {tx({ fr: "Être avisé au lancement", en: "Get notified at launch" })} <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </section>

      {clip && <ClipModal clip="clover-suite" lang={lang} onClose={() => setClip(false)} />}
    </div>
  );
}
