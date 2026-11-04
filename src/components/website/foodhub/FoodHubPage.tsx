"use client";

import {
  ArrowRight,
  BellRing,
  Bot,
  ChefHat,
  ChevronDown,
  KeyRound,
  LineChart,
  ListChecks,
  MessageSquareText,
  Radar,
  ShieldAlert,
  Store,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";

import { KioskScene } from "@/components/website/funnel/KioskScene";
import { Reveal } from "@/components/website/home/Reveal";
import { useHeaderHeight } from "@/components/website/premium/CategoryNavigator";
import { NavyBackdrop } from "@/components/website/premium/ui";
import { BRAND_ICONS } from "@/lib/website/brand-icons";
import { openLiveChat } from "@/lib/website/chat-provider";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

type T = { fr: string; en: string };

const SECTIONS: { id: string; label: T }[] = [
  { id: "fh-flow", label: { fr: "Le parcours", en: "The flow" } },
  { id: "fh-features", label: { fr: "Fonctions", en: "Features" } },
  { id: "fh-console", label: { fr: "La console", en: "The console" } },
  { id: "fh-suite", label: { fr: "Avec la suite Clover", en: "With the Clover suite" } },
  { id: "fh-faq", label: { fr: "FAQ", en: "FAQ" } },
];

/** Where orders come from (takatakca/foodhubca README: direct connections). */
const SOURCES: { name: string; icon?: string }[] = [
  { name: "Uber Eats", icon: "ubereats" },
  { name: "DoorDash", icon: "doordash" },
  { name: "SkipTheDishes" },
  { name: "Too Good To Go" },
  { name: "Clover" },
];

const FLOW: { icon: typeof BellRing; t: T; d: T }[] = [
  { icon: BellRing, t: { fr: "La commande arrive", en: "The order arrives" }, d: { fr: "Bip bip, plein écran, et ça sonne jusqu’à ce que quelqu’un regarde.", en: "Beep beep, full screen, and it keeps ringing until someone looks." } },
  { icon: ChefHat, t: { fr: "Accepter en un toucher", en: "Accept in one tap" }, d: { fr: "Avec le temps de préparation ; ou refuser avec une raison.", en: "With the prep time; or reject with a reason." } },
  { icon: UtensilsCrossed, t: { fr: "En cuisine", en: "In the kitchen" }, d: { fr: "Grandes cartes : Nouveau, En préparation, Prêt, Parti. Billet de 80 mm si vous imprimez.", en: "Big cards: New, Preparing, Ready, Out. An 80 mm ticket if you print." } },
  { icon: Store, t: { fr: "Dans Clover", en: "Into Clover" }, d: { fr: "La commande entre dans votre caisse Clover, pour la tenue de livres.", en: "The order goes into your Clover register, for the books." } },
  { icon: Wallet, t: { fr: "L’argent suivi", en: "The money tracked" }, d: { fr: "Versements des plateformes rapprochés, litiges et frais au même endroit.", en: "Platform payouts reconciled, disputes and fees in one place." } },
];

const FEATURES: { icon: typeof BellRing; t: T; d: T; expansion?: boolean }[] = [
  { icon: KeyRound, t: { fr: "Connexion sans mot de passe", en: "Sign-in without passwords" }, d: { fr: "Un code de 6 chiffres par courriel ou texto ; les tablettes de cuisine ont un écran à NIP.", en: "A 6-digit code by email or text; kitchen tablets have a PIN screen." } },
  { icon: ShieldAlert, t: { fr: "Alarme d’annulation", en: "Cancellation alarm" }, d: { fr: "Une commande annulée par le client ou la plateforme : alarme rouge sur tous les écrans jusqu’à ce que quelqu’un l’arrête.", en: "An order cancelled by the customer or the platform: a red alarm on every screen until someone stops it." } },
  { icon: KeyRound, t: { fr: "NIP du gérant", en: "Manager PIN" }, d: { fr: "Refuser, annuler, rembourser, mettre en pause, changer un prix ou texter un client : vous choisissez ce qui demande le NIP d’un gérant. Chaque approbation est notée.", en: "Reject, cancel, refund, pause, change a price or text a customer: you choose what needs a manager PIN. Every approval is logged." } },
  { icon: Radar, t: { fr: "La veille (Watchtower)", en: "The Watchtower" }, d: { fr: "Commandes en attente ou en retard, livreur qui attend, tablette éteinte ou muette, magasin hors ligne : l’écran sonne, puis la cuisine est appelée, puis les gérants de garde reçoivent un texto et un appel.", en: "Orders waiting or late, a courier waiting, a tablet off or muted, a store offline: the screen rings, then the kitchen is called, then the managers on duty get a text and a call." } },
  { icon: MessageSquareText, t: { fr: "Texter ou appeler le client", en: "Text or call the customer" }, d: { fr: "Depuis la commande, quand la plateforme partage le numéro, avec des messages de retard prêts.", en: "From the order, when the platform shares the number, with ready-made delay messages." } },
  { icon: Bot, t: { fr: "Copilote IA", en: "AI copilot" }, d: { fr: "« Qu’est-ce qui ne va pas en ce moment ? » en français ou en anglais. L’IA explique ; elle n’approuve, ne rembourse et ne publie jamais rien.", en: "\"What's wrong right now?\" in French or English. The AI explains; it never approves, refunds or posts anything." } },
  { icon: ListChecks, t: { fr: "Menus partout", en: "Menus everywhere" }, d: { fr: "Un menu publié vers chaque plateforme, articles en rupture (86), pauses, heures et jours fériés.", en: "One menu published to every platform, sold-out items (86), pauses, hours and holidays." } },
  { icon: LineChart, t: { fr: "Rapports et statistiques", en: "Reports and insights" }, d: { fr: "Ventes par plateforme, par cuisine, par heure ; rapports à télécharger, envoyer ou planifier ; qui a fait quoi.", en: "Sales by platform, kitchen and hour; reports to download, send or schedule; who did what." } },
  { icon: Store, t: { fr: "Vos propres commandes", en: "Your own orders" }, d: { fr: "Commandes à votre nom avec livreurs à la demande, appels IA et catalogue d’épicerie : chacune derrière son interrupteur.", en: "Orders under your name with on-demand couriers, AI calls and a grocery catalogue: each behind its own switch." }, expansion: true },
];

const CONSOLE: { screen: T; shows: T }[] = [
  { screen: { fr: "Aperçu", en: "Overview" }, shows: { fr: "Ce qui demande votre attention, ventes, plateformes, cuisines, tablettes, santé des magasins", en: "What needs you now, sales, platforms, kitchens, tablets, store health" } },
  { screen: { fr: "Commandes", en: "Orders" }, shows: { fr: "Tableau en direct (Nouveau → Préparation → Prêt → Parti), commandes planifiées, historique et CSV", en: "Live board (New → Preparing → Ready → Out), scheduled orders, history and CSV" } },
  { screen: { fr: "Cuisine", en: "Kitchen" }, shows: { fr: "Écran de cuisine : grandes cartes, mode occupé, plein écran", en: "Kitchen display: big cards, busy mode, full screen" } },
  { screen: { fr: "Magasins", en: "Stores" }, shows: { fr: "Pause, reprise, occupé par emplacement ; heures et fériés", en: "Pause, resume, busy per location; hours and holidays" } },
  { screen: { fr: "Menus", en: "Menus" }, shows: { fr: "Éditeur et publication ; tableau des ruptures (86)", en: "Editor and publishing; the 86 board" } },
  { screen: { fr: "Alertes", en: "Alerts" }, shows: { fr: "Incidents de la veille, étapes d’escalade, explication, journal des messages", en: "Watchtower incidents, escalation steps, explanation, message log" } },
  { screen: { fr: "Statistiques", en: "Insights" }, shows: { fr: "Analyses, 7 rapports, activité de l’équipe", en: "Analytics, 7 reports, team activity" } },
  { screen: { fr: "Argent", en: "Money" }, shows: { fr: "Où est mon argent, rapprochement, litiges, versements, frais", en: "Where is my money, reconciliation, disputes, payouts, fees" } },
  { screen: { fr: "Réglages", en: "Settings" }, shows: { fr: "Équipe et NIP, tablettes, règles du gérant, plateformes et Clover, liste de mise en ligne", en: "Team and PINs, tablets, manager rules, platforms and Clover, go-live checklist" } },
];

const FAQ: { q: T; a: T }[] = [
  { q: { fr: "Dois-je acheter de nouvelles tablettes ?", en: "Do I need new tablets?" }, a: { fr: "Non. Food Hub s’ouvre dans le navigateur de la tablette de cuisine que vous avez ; vous l’« enrôlez » une fois dans les réglages, puis elle s’ouvre sur l’écran à NIP.", en: "No. Food Hub opens in the browser of the kitchen tablet you have; you \"enrol\" it once in settings, then it opens on the PIN screen." } },
  { q: { fr: "Quelles plateformes sont branchées ?", en: "Which platforms are connected?" }, a: { fr: "Uber Eats, DoorDash, SkipTheDishes, Too Good To Go et Clover, par une connexion directe à chacune. Chaque plateforme est activée une à une, avec vous.", en: "Uber Eats, DoorDash, SkipTheDishes, Too Good To Go and Clover, through a direct connection to each. Each platform is switched on one by one, with you." } },
  { q: { fr: "Faut-il une caisse Clover ?", en: "Do I need a Clover register?" }, a: { fr: "Food Hub est bâti pour Clover : les commandes y entrent pour vos livres, et la suite Clover s’y branche. Parlez-nous de votre caisse si vous n’êtes pas sur Clover.", en: "Food Hub is built for Clover: orders go into it for your books, and the Clover suite plugs into it. Tell us about your register if you are not on Clover." } },
  { q: { fr: "Combien ça coûte ?", en: "How much does it cost?" }, a: { fr: "Food Hub est en accès anticipé : on fixe le forfait avec vous selon vos emplacements et vos plateformes. Demandez l’accès, on vous rappelle.", en: "Food Hub is in early access: we set the plan with you based on your locations and platforms. Ask for access, we'll call you back." } },
  { q: { fr: "Et si Internet tombe ou qu’une tablette s’éteint ?", en: "What if the Internet drops or a tablet turns off?" }, a: { fr: "La veille le remarque : tablette éteinte ou muette, magasin hors ligne. Elle sonne, appelle la cuisine, puis prévient les gérants de garde.", en: "The Watchtower notices: a tablet off or muted, a store offline. It rings, calls the kitchen, then warns the managers on duty." } },
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

/** The full TAKATAK Food Hub page (/foodhub): one tablet for every order, from the README's real features. */
export function FoodHubPage() {
  const { tx, lang } = useLanguage();
  useHeaderHeight();
  const ask = () => openLiveChat({ page: "/foodhub", intent: "suite_foodhub", lang });

  return (
    <div className="tk-page tk-premium brand-dark bg-[#060D1F] text-white">
      <section aria-labelledby="fh-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-5">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 ring-1 ring-white/10">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden /> TAKATAK Food Hub · {tx({ fr: "Accès anticipé", en: "Early access" })}
            </p>
            <h1 id="fh-title" className="tk-gradient-text mt-6 text-balance text-[40px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-5xl lg:text-[60px]">
              {tx({ fr: "Une tablette. Toutes vos commandes.", en: "One tablet. Every order." })}
            </h1>
            <p className="mt-5 text-base leading-7 text-white/72 sm:text-[17px]">
              {tx({
                fr: "Vos plateformes de livraison, votre borne et votre caisse Clover sur un seul écran de cuisine, en français et en anglais. Une alerte qui ne se perd pas, une cuisine qui suit, de l’argent qu’on retrouve.",
                en: "Your delivery platforms, your kiosk and your Clover register on one kitchen screen, in French and English. An alert that never gets lost, a kitchen that keeps up, money you can find.",
              })}
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {SOURCES.map((s) => {
                const b = s.icon ? BRAND_ICONS[s.icon] : null;
                return (
                  <li key={s.name} className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] py-1 pl-1 pr-3 text-[13px] font-semibold text-white/85 ring-1 ring-white/10">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
                      {b ? (
                        <svg viewBox="0 0 24 24" width="13" height="13" fill={b.hex} aria-hidden>
                          <path d={b.path} />
                        </svg>
                      ) : (
                        <span className="font-mono text-[9px] font-bold text-[#0B1220]">{s.name.slice(0, 2).toUpperCase()}</span>
                      )}
                    </span>
                    {s.name}
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <button type="button" onClick={ask} className="tk-btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold">
                {tx({ fr: "Demander l’accès anticipé", en: "Ask for early access" })} <ArrowRight size={16} aria-hidden />
              </button>
              <Link to="/clover" className="tk-btn-ghost inline-flex items-center gap-2 rounded-xl px-5 py-3.5 text-[15px] font-semibold">
                {tx({ fr: "Voir la suite Clover", en: "See the Clover suite" })}
              </Link>
            </div>
          </div>
          <div className="min-h-[420px] lg:col-span-7">
            <KioskScene />
          </div>
        </div>
      </section>

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

      <Section id="fh-flow" title={tx({ fr: "Le parcours d’une commande", en: "The life of an order" })} sub={tx({ fr: "De la plateforme jusqu’à votre comptable, sans recopier quoi que ce soit.", en: "From the platform to your accountant, without retyping anything." })}>
        <ol className="relative grid gap-4 md:grid-cols-5">
          <span aria-hidden className="absolute left-0 right-0 top-[27px] hidden h-px bg-[linear-gradient(90deg,transparent,rgb(41_195_255/0.6),transparent)] md:block" />
          {FLOW.map((s, i) => (
            <Reveal as="li" key={s.t.en} delay={i * 80} className="relative">
              <span className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1565D8,#29C3FF)] shadow-[0_14px_30px_-12px_#1F8BFF]">
                <s.icon size={22} aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-bold">{tx(s.t)}</h3>
              <p className="mt-2 text-[15px] leading-6 text-white/65">{tx(s.d)}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section id="fh-features" tinted title={tx({ fr: "Ce que Food Hub fait pour vous", en: "What Food Hub does for you" })} sub={tx({ fr: "Les fonctions de la version actuelle. Celles marquées « Expansion » s’activent une à une, quand vous êtes prêt.", en: "The current version's features. Those marked \"Expansion\" switch on one by one, when you are ready." })}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal as="li" key={f.t.en} delay={(i % 3) * 80}>
              <div className="tk-glass tk-lift h-full rounded-2xl p-6">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-400/15 text-sky-300">
                    <f.icon size={20} aria-hidden />
                  </span>
                  {f.expansion && <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-300/30">Expansion</span>}
                </div>
                <h3 className="mt-5 text-lg font-bold">{tx(f.t)}</h3>
                <p className="mt-2 text-[15px] leading-6 text-white/65">{tx(f.d)}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </Section>

      <Section id="fh-console" title={tx({ fr: "La console, écran par écran", en: "The console, screen by screen" })}>
        <div className="overflow-hidden rounded-2xl ring-1 ring-white/10">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-white/[0.06] text-[12px] uppercase tracking-[0.14em] text-white/55">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">{tx({ fr: "Écran", en: "Screen" })}</th>
                <th scope="col" className="px-4 py-3 font-semibold">{tx({ fr: "Ce qu’il montre", en: "What it shows" })}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {CONSOLE.map((r) => (
                <tr key={r.screen.en} className="transition-colors hover:bg-white/[0.03]">
                  <td className="whitespace-nowrap px-4 py-3.5 font-semibold">{tx(r.screen)}</td>
                  <td className="px-4 py-3.5 text-white/70">{tx(r.shows)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="fh-suite" tinted title={tx({ fr: "Au centre de la suite Clover", en: "At the centre of the Clover suite" })} sub={tx({ fr: "Food Hub passe les commandes aux applications de la suite, sans jamais partager le nom ou le numéro d’un client.", en: "Food Hub passes orders to the suite's apps, without ever sharing a customer's name or number." })}>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { k: "t4ctile", t: { fr: "T4CTILE · la borne", en: "T4CTILE · the kiosk" }, d: { fr: "Les commandes de la borne arrivent sur le même écran de cuisine, une seule fois.", en: "Kiosk orders land on the same kitchen screen, exactly once." } },
            { k: "tr4cker", t: { fr: "TR4CKER · vos livraisons", en: "TR4CKER · your deliveries" }, d: { fr: "Vos commandes directes, suivies en direct jusqu’à la porte.", en: "Your direct orders, tracked live to the door." } },
            { k: "4ccounting", t: { fr: "4CCOUNTING · vos livres", en: "4CCOUNTING · your books" }, d: { fr: "Les ventes des plateformes entrent dans vos rapports TPS et TVQ.", en: "Platform sales go into your GST and QST reports." } },
          ].map((c) => (
            <Link key={c.k} to={`/clover#${c.k}`} className="tk-glass tk-lift group block rounded-2xl p-6">
              <h3 className="text-lg font-bold">{tx(c.t)}</h3>
              <p className="mt-2 text-[15px] leading-6 text-white/65">{tx(c.d)}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-sky-300 group-hover:underline">
                {tx({ fr: "Voir l’application", en: "See the app" })} <ArrowRight size={14} aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section id="fh-faq" title={tx({ fr: "Questions fréquentes", en: "Frequently asked questions" })}>
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

      <section className="px-4 pb-20 pt-6">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0B1B3D,#1565D8_60%,#29C3FF)] p-8 text-center sm:p-12">
          <h2 className="text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">{tx({ fr: "Fini la pile de tablettes.", en: "No more stack of tablets." })}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[16px] leading-7 text-white/80">
            {tx({ fr: "Demandez l’accès anticipé : on regarde vos plateformes et vos emplacements avec vous, puis on branche Food Hub.", en: "Ask for early access: we look at your platforms and locations with you, then plug in Food Hub." })}
          </p>
          <button type="button" onClick={ask} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-[15px] font-bold text-[#0B1B3D] hover:bg-blue-50">
            {tx({ fr: "Demander l’accès anticipé", en: "Ask for early access" })} <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}
