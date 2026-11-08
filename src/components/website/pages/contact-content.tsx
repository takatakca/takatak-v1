"use client";

import { ArrowRight, CreditCard, FileText, LifeBuoy, Mail, MapPin, ShieldCheck, type LucideIcon } from "lucide-react";

import { NavyBackdrop } from "@/components/website/premium/ui";
import { ContactForm } from "@/components/website/support/ContactForm";
import { CONTACT_TOPICS, type ContactTopic } from "@/lib/website/contact-topics";
import { SUPPORT_EMAIL } from "@/lib/website/live-chat-config";
import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

type Bi = { en: string; fr: string };

const PATHS: readonly { icon: LucideIcon; title: Bi; body: Bi; to: string; cta: Bi }[] = [
  {
    icon: FileText,
    title: { en: "Start a project", fr: "Lancer un projet" },
    body: { en: "Describe the website, app or campaign you need. You get a scoped quote before anything is charged.", fr: "Décrivez le site, l’application ou la campagne qu’il vous faut. Vous recevez une soumission avant tout paiement." },
    to: "/marketplace/post-project",
    cta: { en: "Describe my project", fr: "Décrire mon projet" },
  },
  {
    icon: LifeBuoy,
    title: { en: "Already a client", fr: "Déjà client" },
    body: { en: "Open a support ticket from your dashboard: it stays attached to your account and your services.", fr: "Ouvrez une demande de soutien depuis votre tableau de bord : elle reste liée à votre compte et à vos services." },
    to: "/dashboard/support",
    cta: { en: "Open my support space", fr: "Ouvrir mon espace soutien" },
  },
  {
    icon: CreditCard,
    title: { en: "Prices and plans", fr: "Prix et forfaits" },
    body: { en: "Every starting price, in Canadian dollars before taxes.", fr: "Tous les prix de départ, en dollars canadiens avant taxes." },
    to: "/pricing",
    cta: { en: "See pricing", fr: "Voir les prix" },
  },
];

function topicFrom(value: string | null): ContactTopic {
  return value && value in CONTACT_TOPICS ? (value as ContactTopic) : "question";
}

/** /contact: a message box that reaches a person, and the other ways to reach TAKATAK. */
export function ContactContent({ initialTopic = null }: { initialTopic?: string | null }) {
  const { lang } = useLanguage();
  const c = (v: Bi) => v[lang];
  const topic = topicFrom(initialTopic);

  return (
    <div className="tk-page tk-premium brand-dark bg-[#060D1F] text-white">
      <section aria-labelledby="contact-title" className="relative overflow-hidden">
        <NavyBackdrop grid />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-12 sm:pt-16 lg:pb-14 lg:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 ring-1 ring-white/10">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-300" aria-hidden /> {lang === "fr" ? "Nous joindre" : "Contact"}
          </p>
          <h1 id="contact-title" className="tk-gradient-text mt-6 max-w-3xl text-[40px] font-extrabold leading-[1.04] tracking-[-0.035em] sm:text-5xl lg:text-[56px]">
            {lang === "fr" ? "Écrivez-nous. Une personne vous répond." : "Write to us. A person answers."}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/72 sm:text-[17px]">
            {lang === "fr"
              ? "Une question, un projet, une facture : votre message arrive directement dans la boîte de l’équipe TAKATAK, en français ou en anglais."
              : "A question, a project, an invoice: your message goes straight to the TAKATAK team’s inbox, in English or French."}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-20 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="contact-form-title" className="tk-glass h-fit rounded-3xl p-5 sm:p-8">
          <h2 id="contact-form-title" className="text-xl font-bold text-white">
            {lang === "fr" ? "Votre message" : "Your message"}
          </h2>
          <p className="mt-1.5 text-sm text-white/65">
            {lang === "fr" ? "Courriel ou téléphone : un des deux suffit pour vous répondre." : "Email or phone: either one is enough for us to answer."}
          </p>
          <div className="mt-6">
            <ContactForm key={topic} defaultTopic={topic} />
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <div className="tk-glass rounded-3xl p-5">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.22em] text-sky-300">{lang === "fr" ? "Coordonnées" : "Details"}</h2>
            <ul className="mt-4 space-y-3.5 text-sm text-white/80">
              <li className="flex items-start gap-3">
                <Mail size={17} className="mt-0.5 shrink-0 text-sky-300" aria-hidden />
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-white underline-offset-4 hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={17} className="mt-0.5 shrink-0 text-sky-300" aria-hidden />
                <span>GROUPE TAKATAK · Montréal, Québec, Canada</span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck size={17} className="mt-0.5 shrink-0 text-sky-300" aria-hidden />
                <span>
                  {lang === "fr" ? "Vos données : " : "Your data: "}
                  <Link to="/privacy-manager" className="font-semibold text-white underline-offset-4 hover:underline">
                    {lang === "fr" ? "gestion de la confidentialité" : "privacy manager"}
                  </Link>
                </span>
              </li>
            </ul>
          </div>
          {PATHS.map((path) => (
            <Link key={path.to} to={path.to} className="tk-glass tk-lift group block rounded-3xl p-5">
              <span className="flex items-start gap-3.5">
                <span aria-hidden className="relative grid h-[42px] w-[42px] shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,#1F8BFF,#29C3FF)] text-white shadow-[0_12px_30px_-12px_rgb(31_139_255/0.8)]">
                  <path.icon size={19} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-bold text-white">{c(path.title)}</span>
                  <span className="mt-1 block text-[14px] leading-6 text-white/65">{c(path.body)}</span>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-sky-300">
                    {c(path.cta)} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </span>
              </span>
            </Link>
          ))}
        </aside>
      </div>
    </div>
  );
}
