"use client";

import Link from "next/link";

import { useLanguage } from "@/lib/website/use-language";

type L = { fr: string; en: string };

const SERVICES: { name: L; description: L }[] = [
  {
    name: { fr: "Domaines", en: "Domains" },
    description: {
      fr: "Coordonnées du titulaire et configuration DNS, gérées avec notre registraire partenaire.",
      en: "Registrant contact data and DNS configuration handled with our registrar partner.",
    },
  },
  {
    name: { fr: "Hébergement", en: "Hosting" },
    description: {
      fr: "Données de compte et de facturation nécessaires pour activer et renouveler les forfaits d’hébergement géré.",
      en: "Account and billing data needed to provision and renew managed hosting plans.",
    },
  },
  {
    name: { fr: "Place de marché de services", en: "Service marketplace" },
    description: {
      fr: "Briefs de projet, fichiers, messages et historique des commandes des forfaits de la place de marché.",
      en: "Project briefs, files, messages and order history for marketplace packages.",
    },
  },
  {
    name: { fr: "QMAPS — Fiches locales", en: "QMAPS — Local listings" },
    description: {
      fr: "Données du profil d’entreprise publiées en votre nom sur Google Business, les cartes et les répertoires.",
      en: "Business profile data published to Google Business, maps and directories on your behalf.",
    },
  },
  {
    name: { fr: "FLEXS — Génération de prospects", en: "FLEXS — Lead generation" },
    description: {
      fr: "Formulaires de capture de prospects, listes de sollicitation et statistiques des campagnes.",
      en: "Lead capture forms, outreach lists and campaign analytics.",
    },
  },
  {
    name: { fr: "Outils d’IA", en: "AI tools" },
    description: {
      fr: "Requêtes et fichiers traités pour offrir l’automatisation d’affaires assistée par l’IA.",
      en: "Prompts and uploads processed to deliver AI-assisted business automation.",
    },
  },
  {
    name: { fr: "Paiements et commandes", en: "Payments & orders" },
    description: {
      fr: "Dossiers de commandes, de factures et d’état des paiements conservés pour la comptabilité et la conformité.",
      en: "Order, invoice and payment status records held for accounting and compliance.",
    },
  },
  {
    name: { fr: "Notifications", en: "Notifications" },
    description: {
      fr: "Courriels transactionnels et notifications dans l’application au sujet de vos services et projets.",
      en: "Transactional emails and in-app notifications about your services and projects.",
    },
  },
];

const RIGHTS: L[] = [
  {
    fr: "Obtenir une copie des renseignements personnels que nous détenons à votre sujet.",
    en: "Access a copy of the personal data we hold about you.",
  },
  {
    fr: "Faire corriger des renseignements personnels inexacts ou incomplets.",
    en: "Correct inaccurate or incomplete personal data.",
  },
  {
    fr: "Supprimer votre compte TAKATAK et les renseignements personnels qui y sont liés, sous réserve des obligations légales de conservation.",
    en: "Delete your TAKATAK account and associated personal data, subject to legal retention.",
  },
  {
    fr: "Limiter certains traitements ou vous y opposer.",
    en: "Restrict or object to certain processing activities.",
  },
  {
    fr: "Retirer en tout temps votre consentement aux communications marketing.",
    en: "Withdraw consent for marketing communications at any time.",
  },
  {
    fr: "Exporter vos données dans un format portable et lisible par machine.",
    en: "Export your data in a portable, machine-readable format.",
  },
];

const COPY = {
  title: { fr: "Gestion de la confidentialité", en: "Privacy Manager" },
  lead: {
    fr: "TAKATAK s’engage à être transparent sur les données recueillies dans chacun de ses services. Cette page explique ce qui est recueilli et comment exercer vos droits en matière de confidentialité.",
    en: "TAKATAK is committed to transparency about the data we collect across every service we operate. Use this page to understand what is collected and how to exercise your privacy rights.",
  },
  services: { fr: "Services et données recueillies", en: "Services and data collected" },
  rights: { fr: "Vos droits", en: "Your rights" },
  exercise: { fr: "Exercer un droit", en: "Exercise a privacy right" },
  emailBefore: { fr: "Écrivez à", en: "Email" },
  emailAfter: {
    fr: "à partir de l’adresse liée à votre compte TAKATAK et décrivez votre demande. Nous répondons dans un délai de 30 jours.",
    en: "from the address associated with your TAKATAK account and describe the request. We respond within 30 days.",
  },
  account: { fr: "Gérer mon compte", en: "Manage account" },
  notifications: { fr: "Préférences de notification", en: "Notification preferences" },
} as const;

export function PrivacyManagerView() {
  const { lang } = useLanguage();

  return (
    <section className="mx-auto max-w-4xl px-4 py-16">
      <header>
        <h1 className="text-3xl font-bold text-foreground md:text-4xl">{COPY.title[lang]}</h1>
        <p className="mt-3 text-muted-foreground">{COPY.lead[lang]}</p>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">{COPY.services[lang]}</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SERVICES.map((service) => (
            <article key={service.name.en} className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">{service.name[lang]}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{service.description[lang]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">{COPY.rights[lang]}</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          {RIGHTS.map((right) => (
            <li key={right.en}>{right[lang]}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">{COPY.exercise[lang]}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {COPY.emailBefore[lang]}{" "}
          <a href="mailto:support@takatak.ca" className="text-primary hover:underline">
            support@takatak.ca
          </a>{" "}
          {COPY.emailAfter[lang]}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/dashboard/profile"
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {COPY.account[lang]}
          </Link>
          <Link
            href="/dashboard/notifications"
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-secondary"
          >
            {COPY.notifications[lang]}
          </Link>
        </div>
      </section>
    </section>
  );
}
