"use client";

import {
  BadgeCheck,
  Banknote,
  Bot,
  Code2,
  Database,
  FileSignature,
  Megaphone,
  MapPin,
  Inbox,
  Palette,
  PenLine,
  Upload,
  Video,
  type LucideIcon,
} from "lucide-react";

import { NavyBackdrop } from "@/components/website/premium/ui";
import { ContactForm } from "@/components/website/support/ContactForm";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

type Bi = { en: string; fr: string };

const STEPS: readonly { icon: LucideIcon; title: Bi; body: Bi }[] = [
  {
    icon: FileSignature,
    title: { en: "Apply", fr: "Posez votre candidature" },
    body: { en: "Tell us your skills, your languages and where to see your work.", fr: "Dites-nous vos compétences, vos langues et où voir vos réalisations." },
  },
  {
    icon: BadgeCheck,
    title: { en: "Screening by GROUPE TAKATAK", fr: "Évaluation par GROUPE TAKATAK" },
    body: { en: "A person reviews every application before anyone joins.", fr: "Une personne évalue chaque candidature avant que quiconque se joigne." },
  },
  {
    icon: Inbox,
    title: { en: "Client briefs", fr: "Mandats de clients" },
    body: { en: "You receive scoped briefs from TAKATAK clients, matched to your skills.", fr: "Vous recevez des mandats cadrés de clients TAKATAK, selon vos compétences." },
  },
  {
    icon: Upload,
    title: { en: "Deliver in the project space", fr: "Livrez dans l’espace du projet" },
    body: { en: "Files, revisions and messages stay in one place with the client.", fr: "Fichiers, révisions et messages restent au même endroit avec le client." },
  },
  {
    icon: Banknote,
    title: { en: "Paid by TAKATAK", fr: "Payé par TAKATAK" },
    body: { en: "The client pays TAKATAK; TAKATAK pays you once the client approves the delivery.", fr: "Le client paie TAKATAK; TAKATAK vous paie une fois la livraison approuvée par le client." },
  },
];

const SKILLS: readonly { icon: LucideIcon; label: Bi; to: string }[] = [
  { icon: Palette, label: { en: "Graphics and design", fr: "Graphisme et design" }, to: "/marketplace/category/logo_design" },
  { icon: Code2, label: { en: "Programming and tech", fr: "Programmation et tech" }, to: "/marketplace/category/website_design" },
  { icon: Megaphone, label: { en: "Digital marketing", fr: "Marketing numérique" }, to: "/marketplace/category/online_advertising" },
  { icon: PenLine, label: { en: "Writing and translation", fr: "Rédaction et traduction" }, to: "/marketplace/category/content_writing" },
  { icon: Video, label: { en: "Social and video content", fr: "Contenu social et vidéo" }, to: "/marketplace/category/social_media_content" },
  { icon: Bot, label: { en: "AI services", fr: "Services d’IA" }, to: "/marketplace/category/ai_tool_setup" },
  { icon: MapPin, label: { en: "Local visibility", fr: "Visibilité locale" }, to: "/marketplace/category/seo_local_visibility" },
  { icon: Database, label: { en: "Data and admin", fr: "Données et administration" }, to: "/marketplace/category/data_entry" },
];

const HINT: Bi = {
  en: "Your skills, your languages, a link to your portfolio, and how many hours a week you can take on.",
  fr: "Vos compétences, vos langues, un lien vers votre portfolio et combien d’heures par semaine vous pouvez prendre.",
};

const SUBMIT: Bi = { en: "Send my application", fr: "Envoyer ma candidature" };

/** /freelancers: how to join the GROUPE TAKATAK roster, with the application form. */
export function FreelancersContent() {
  const { lang } = useLanguage();
  const c = (v: Bi) => v[lang];

  return (
    <div className="tk-page tk-premium brand-dark bg-[#060D1F] text-white">
      <section aria-labelledby="freelancers-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:pt-16 lg:pb-14 lg:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden /> {lang === "fr" ? "Pigistes et partenaires" : "Freelancers and partners"}
          </p>
          <h1 id="freelancers-title" className="tk-gradient-text mt-6 max-w-3xl text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
            {lang === "fr" ? "Travaillez sur des projets TAKATAK." : "Work on TAKATAK projects."}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-[17px]">
            {lang === "fr"
              ? "Designers, développeurs, rédacteurs, spécialistes du marketing et de l’IA : joignez l’équipe de pigistes de GROUPE TAKATAK et recevez des mandats de vrais clients."
              : "Designers, developers, writers, marketing and AI specialists: join the GROUPE TAKATAK freelancer roster and receive briefs from real clients."}
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-20">
        <section aria-labelledby="freelancers-steps">
          <h2 id="freelancers-steps" className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-300">
            {lang === "fr" ? "Comment ça marche" : "How it works"}
          </h2>
          <ol className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, i) => (
              <li key={step.title.en} className="tk-glass rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1F8BFF,#29C3FF)] text-white">
                    <step.icon size={18} />
                  </span>
                  <span className="text-[12px] font-semibold text-white/55">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mt-3 text-[15.5px] font-bold text-white">{c(step.title)}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-white/65">{c(step.body)}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section aria-labelledby="freelancers-form" className="tk-glass h-fit rounded-3xl p-5 sm:p-8">
            <h2 id="freelancers-form" className="text-xl font-bold text-white">
              {lang === "fr" ? "Votre candidature" : "Your application"}
            </h2>
            <p className="mt-1.5 text-sm text-white/65">
              {lang === "fr"
                ? "Elle arrive à l’équipe TAKATAK, qui vous répond par courriel ou par téléphone."
                : "It goes to the TAKATAK team, who answers you by email or phone."}
            </p>
            <div className="mt-6">
              <ContactForm defaultTopic="partner" topics={["partner"]} messageHint={HINT} submitLabel={SUBMIT} />
            </div>
          </section>

          <aside aria-labelledby="freelancers-skills" className="tk-glass h-fit rounded-3xl p-5">
            <h2 id="freelancers-skills" className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-300">
              {lang === "fr" ? "Les métiers recherchés" : "Skills we work with"}
            </h2>
            <p className="mt-2 text-[13.5px] leading-5 text-white/60">
              {lang === "fr" ? "Les catégories de la Marketplace TAKATAK, avec leurs forfaits et leurs prix." : "The TAKATAK Marketplace categories, with their packages and prices."}
            </p>
            <ul className="mt-3 divide-y divide-white/[0.06]">
              {SKILLS.map((s) => (
                <li key={s.to}>
                  <Link to={s.to} className="flex items-center gap-3 rounded-xl px-2 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-white/[0.05]">
                    <s.icon size={17} className="shrink-0 text-sky-300" aria-hidden />
                    {c(s.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
