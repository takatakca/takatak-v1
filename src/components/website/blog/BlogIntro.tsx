"use client";

import { Link } from "@/lib/website/nav";
import { useLanguage } from "@/lib/website/use-language";

const COPY = {
  lead: {
    fr: "Des notes sur les sites web, l’hébergement et les services qu’une entreprise en croissance gère d’un seul endroit.",
    en: "Notes on websites, hosting, and the services a growing business runs from one place.",
  },
  tag: { fr: "Produit", en: "Product" },
  title: { fr: "Une page de blogue pour chaque site branché", en: "A blog page for every connected website" },
  p1: {
    fr: "Vérifiez un site web dans TAKATAK, puis créez sa page de blogue. La page vit sur TAKATAK et reste liée au site que vous avez prouvé pouvoir publier.",
    en: "Verify a website in TAKATAK, then create its blog page. The page lives on TAKATAK and stays linked to the site you already proved you can publish.",
  },
  p2: {
    fr: "La page de blogue porte l’adresse du site comme nom. Les articles de ce site y seront publiés. Jusqu’au premier article, la page est l’accueil public de ce blogue.",
    en: "The blog page uses the website address as its name. Posts for that site will be published here. Until the first post, the page is the public home for that blog.",
  },
  cta: { fr: "Créer une page de blogue", en: "Create a blog page" },
  none: { fr: "Aucun article pour l’instant", en: "No posts yet" },
  noneBody: {
    fr: "Les articles publiés sur le blogue TAKATAK apparaîtront ici.",
    en: "Posts published on the TAKATAK blog will appear here.",
  },
} as const;

/** /blog: the TAKATAK blog, in the visitor's language. */
export function BlogIntro() {
  const { lang } = useLanguage();
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-sm font-medium text-muted-foreground">TAKATAK</p>
      <h1 className="mt-3 text-4xl font-bold text-foreground">{lang === "fr" ? "Blogue" : "Blog"}</h1>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">{COPY.lead[lang]}</p>

      <article className="mt-12 rounded-2xl border border-border bg-card p-8">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{COPY.tag[lang]}</p>
        <h2 className="mt-3 text-2xl font-semibold text-foreground">{COPY.title[lang]}</h2>
        <div className="mt-4 space-y-4 text-sm leading-7 text-muted-foreground">
          <p>{COPY.p1[lang]}</p>
          <p>{COPY.p2[lang]}</p>
        </div>
        <div className="mt-6">
          <Link
            to="/dashboard/social/blog"
            className="inline-flex rounded-md px-4 py-2 text-sm font-medium text-primary-foreground"
            style={{ backgroundImage: "var(--gradient-hero)" }}
          >
            {COPY.cta[lang]}
          </Link>
        </div>
      </article>

      <section className="mt-8 rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
        <h2 className="text-lg font-semibold text-foreground">{COPY.none[lang]}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{COPY.noneBody[lang]}</p>
      </section>
    </div>
  );
}
