"use client";

import { Check } from "lucide-react";

import type { CategoryKey } from "@/lib/website/core-categories";
import { useInViewport } from "@/lib/website/use-in-viewport";
import { useLanguage } from "@/lib/website/use-language";
import { LiveLaptop, useScenePlayer, type Scene } from "./LiveScenes";

type T = { fr: string; en: string };

interface Demo {
  scene: Scene;
  address: T;
  tab: T;
  /** What you ask · what TAKATAK does · the result (same words as the toast). */
  steps: [T, T, T];
}

const DEMO: Record<CategoryKey, Demo> = {
  website: {
    scene: "website",
    address: { fr: "votreentreprise.ca", en: "yourbusiness.ca" },
    tab: { fr: "Votre entreprise", en: "Your business" },
    steps: [
      { fr: "Vous décrivez votre entreprise et ce que vous vendez.", en: "You describe your business and what you sell." },
      { fr: "On construit le site : pages, photos, réservation, contact.", en: "We build the site: pages, photos, booking, contact." },
      { fr: "Succès, vous êtes en ligne.", en: "Success, you are live." },
    ],
  },
  domains: {
    scene: "domain",
    address: { fr: "takatak.ca/domaine", en: "takatak.ca/domain" },
    tab: { fr: "Recherche de domaine", en: "Domain search" },
    steps: [
      { fr: "Vous tapez le nom de votre marque.", en: "You type your brand name." },
      { fr: "On vérifie les extensions et vous choisissez.", en: "We check the extensions and you pick one." },
      { fr: "Domaine connecté à votre site.", en: "Domain connected to your site." },
    ],
  },
  hosting: {
    scene: "hosting",
    address: { fr: "takatak.ca/tableau-de-bord/hebergement", en: "takatak.ca/dashboard/hosting" },
    tab: { fr: "Hébergement", en: "Hosting" },
    steps: [
      { fr: "Votre site arrive chez nous (ou on le déménage).", en: "Your site comes to us (or we move it)." },
      { fr: "SSL, sauvegardes et mises à jour sont branchés.", en: "SSL, backups and updates are switched on." },
      { fr: "Site rapide, sécurisé et sauvegardé.", en: "Site fast, secure and backed up." },
    ],
  },
  marketing: {
    scene: "ads",
    address: { fr: "takatak.ca/tableau-de-bord/campagnes", en: "takatak.ca/dashboard/campaigns" },
    tab: { fr: "Campagnes", en: "Campaigns" },
    steps: [
      { fr: "Vous fixez le budget, la zone et l'objectif.", en: "You set the budget, the area and the goal." },
      { fr: "On monte les annonces Google et Meta.", en: "We set up the Google and Meta ads." },
      { fr: "Campagne en ligne.", en: "Campaign live." },
    ],
  },
  social: {
    scene: "social",
    address: { fr: "takatak.ca/tableau-de-bord/social", en: "takatak.ca/dashboard/social" },
    tab: { fr: "Médias sociaux", en: "Social media" },
    steps: [
      { fr: "Vos réseaux sont connectés une fois.", en: "Your networks are connected once." },
      { fr: "Une publication est préparée pour chacun.", en: "One post is prepared for each." },
      { fr: "Publié sur vos 3 réseaux.", en: "Posted to your 3 networks." },
    ],
  },
  local: {
    scene: "local",
    address: { fr: "takatak.ca/tableau-de-bord/fiches", en: "takatak.ca/dashboard/listings" },
    tab: { fr: "Fiches locales", en: "Local listings" },
    steps: [
      { fr: "Vous changez vos heures une seule fois.", en: "You change your hours once." },
      { fr: "On met la fiche à jour sur Google, Facebook et les annuaires.", en: "We update the listing on Google, Facebook and directories." },
      { fr: "Fiche à jour partout.", en: "Listing updated everywhere." },
    ],
  },
  reviews: {
    scene: "reviews",
    address: { fr: "takatak.ca/tableau-de-bord/avis", en: "takatak.ca/dashboard/reviews" },
    tab: { fr: "Avis", en: "Reviews" },
    steps: [
      { fr: "Un client laisse un avis Google.", en: "A customer leaves a Google review." },
      { fr: "L'IA propose une réponse, vous l'approuvez.", en: "AI drafts a reply, you approve it." },
      { fr: "Réponse publiée.", en: "Reply posted." },
    ],
  },
  ai: {
    scene: "ai",
    address: { fr: "takatak.ca/takbot", en: "takatak.ca/takbot" },
    tab: { fr: "TAK-TAK", en: "TAK-TAK" },
    steps: [
      { fr: "Vous demandez un texte à TAK-TAK.", en: "You ask TAK-TAK for a text." },
      { fr: "TAK-TAK l'écrit dans votre ton.", en: "TAK-TAK writes it in your tone." },
      { fr: "Texte prêt à publier.", en: "Post ready to publish." },
    ],
  },
  billing: {
    scene: "billing",
    address: { fr: "takatak.ca/tableau-de-bord/factures", en: "takatak.ca/dashboard/invoices" },
    tab: { fr: "Facturation", en: "Invoicing" },
    steps: [
      { fr: "La facture part avec TPS et TVQ.", en: "The invoice goes out with GST and QST." },
      { fr: "Le client paie en ligne.", en: "The customer pays online." },
      { fr: "Facture payée, rappel annulé.", en: "Invoice paid, reminder cancelled." },
    ],
  },
  voip: {
    scene: "phone",
    address: { fr: "app.mimt.ca", en: "app.mimt.ca" },
    tab: { fr: "MIMT", en: "MIMT" },
    steps: [
      { fr: "Un client appelle votre numéro.", en: "A customer calls your number." },
      { fr: "Le standard propose Ventes, Soutien ou Heures.", en: "The attendant offers Sales, Support or Hours." },
      { fr: "Appel dirigé vers la bonne personne.", en: "Call routed to the right person." },
    ],
  },
};

/** "See it live" on a service page: the laptop plays the service, the three steps light up with it. */
export function ServiceLiveDemo({ categoryKey }: { categoryKey: CategoryKey }) {
  const { tx, lang } = useLanguage();
  const demo = DEMO[categoryKey];
  const [ref, inView] = useInViewport<HTMLDivElement>({ once: false, threshold: 0.25 });
  const step = useScenePlayer(inView, categoryKey);
  const business = tx({ fr: "Votre entreprise", en: "Your business" });

  return (
    <div ref={ref} className="grid items-center gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <LiveLaptop
          scene={demo.scene}
          step={step}
          business={business}
          lang={lang}
          address={tx(demo.address)}
          tab={tx(demo.tab)}
        />
        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/70">{tx({ fr: "Aperçu à titre illustratif", en: "Illustrative preview" })}</p>
      </div>
      <ol className="grid gap-3 lg:col-span-5">
        {demo.steps.map((s, i) => {
          const on = step >= i + 1;
          const done = step > i + 1 || step === 3;
          return (
            <li
              key={i}
              className={`flex items-start gap-4 rounded-2xl border p-4 transition-all duration-500 ${
                on
                  ? "border-[color-mix(in_oklab,var(--tk-accent)_55%,transparent)] bg-white/[0.06] shadow-[0_18px_40px_-24px_var(--tk-accent)]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-extrabold transition-colors duration-500 ${
                  done && i === 2 ? "bg-emerald-500 text-white" : on ? "tk-accent-bg text-white" : "bg-white/[0.06] text-white/50"
                }`}
              >
                {done && i === 2 ? <Check size={16} strokeWidth={3} aria-hidden /> : i + 1}
              </span>
              <span className={`pt-1.5 text-[15px] leading-6 transition-colors duration-500 ${on ? "text-white" : "text-white/55"}`}>
                {tx(s)}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
