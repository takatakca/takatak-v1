"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

type Bi = { fr: string; en: string };

const CLIENT: Bi[] = [
  { fr: "Publiez un projet ou choisissez un forfait", en: "Post a project or pick a package" },
  { fr: "On vous jumelle avec un pigiste", en: "Get matched with a freelancer" },
  { fr: "Financez l’étape : le paiement est retenu", en: "Fund the milestone: TAKATAK holds the payment" },
  { fr: "Révisez les livraisons et demandez des corrections", en: "Review deliveries and request revisions" },
  { fr: "Approuvez pour verser le paiement", en: "Approve to release payment" },
];

const FREELANCER: Bi[] = [
  { fr: "Proposez votre candidature à Groupe TAKATAK", en: "Apply to join the Groupe TAKATAK roster" },
  { fr: "Recevez des mandats de clients vérifiés", en: "Get matched with vetted client briefs" },
  { fr: "Livrez dans l’espace du projet", en: "Deliver in the project workspace" },
  { fr: "Soyez payé à l’approbation", en: "Get paid once the client approves" },
  { fr: "Bâtissez une réputation vérifiée", en: "Build a verified reputation" },
];

const COPY = {
  clients: { fr: "Pour les clients", en: "For clients" },
  clientsTitle: { fr: "Un seul espace pour chaque projet.", en: "A single workspace for every project." },
  post: { fr: "Publier un projet", en: "Post a project" },
  freelancers: { fr: "Pour les pigistes", en: "For freelancers" },
  freelancersTitle: { fr: "Joignez Groupe TAKATAK et soyez payé de façon fiable.", en: "Join Groupe TAKATAK and get paid reliably." },
  become: { fr: "Devenir pigiste", en: "Become a freelancer" },
} as const;

const BECOME_FREELANCER = "/freelancers";

export function WorkflowsBlock() {
  const { lang } = useLanguage();
  return (
    <section className="grid gap-5 md:grid-cols-2">
      <Column tag={COPY.clients[lang]} title={COPY.clientsTitle[lang]} items={CLIENT.map((i) => i[lang])} cta={COPY.post[lang]} href="/marketplace/post-project" />
      <Column tag={COPY.freelancers[lang]} title={COPY.freelancersTitle[lang]} items={FREELANCER.map((i) => i[lang])} cta={COPY.become[lang]} href={BECOME_FREELANCER} />
    </section>
  );
}

function Column({ tag, title, items, cta, href }: { tag: string; title: string; items: string[]; cta: string; href: string }) {
  const cls = "mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline";
  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">{tag}</div>
      <h3 className="mt-2 text-xl font-bold text-foreground md:text-2xl">{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden />
            <span>{i}</span>
          </li>
        ))}
      </ul>
      {href.startsWith("mailto:") ? (
        <a href={href} className={cls}>
          {cta} <ArrowRight size={14} aria-hidden />
        </a>
      ) : (
        <Link to={href} className={cls}>
          {cta} <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}
