"use client";

import Link from "next/link";

import { PackageResultCard } from "@/components/website/marketplace/package-result-card";
import type { MarketplaceCategory, MarketplacePackage } from "@/lib/website/marketplace-catalog";
import { categoryName } from "@/lib/website/marketplace-i18n";
import { useLanguage } from "@/lib/website/use-language";

const COPY = {
  back: { fr: "← Retour à la place de marché", en: "← Back to marketplace" },
  resultsFor: { fr: "Résultats pour « {q} »", en: "Marketplace results for “{q}”" },
  browse: { fr: "Tous les forfaits de la place de marché", en: "Browse marketplace packages" },
  lead: {
    fr: "Chaque forfait est livré par TAKATAK, avec une communication organisée, des étapes, des révisions et des approbations.",
    en: "Every package is delivered through TAKATAK with organized communication, milestones, revisions, and approvals.",
  },
  search: { fr: "Recherche", en: "Search" },
  placeholder: { fr: "Chercher un forfait", en: "Search packages" },
  category: { fr: "Catégorie", en: "Category" },
  all: { fr: "Toutes les catégories", en: "All categories" },
  sort: { fr: "Trier", en: "Sort" },
  recommended: { fr: "Recommandés", en: "Recommended" },
  priceAsc: { fr: "Prix : du plus bas au plus haut", en: "Price: low to high" },
  priceDesc: { fr: "Prix : du plus haut au plus bas", en: "Price: high to low" },
  fastest: { fr: "Livraison la plus rapide", en: "Fastest delivery" },
  apply: { fr: "Appliquer", en: "Apply" },
  one: { fr: "1 résultat", en: "1 result" },
  many: { fr: "{n} résultats", en: "{n} results" },
  none: { fr: "Aucun forfait ne correspond pour l’instant", en: "No matching package yet" },
  noneBody: {
    fr: "Décrivez votre projet : TAKATAK organise le plan et la livraison.",
    en: "Post your project and TAKATAK will organize the brief and delivery process.",
  },
  post: { fr: "Publier un projet", en: "Post a project" },
} as const;

/** /marketplace/search: the server picks and sorts the packages; this shows them in the visitor's language. */
export function MarketplaceSearchView({
  query,
  category,
  sort,
  categories,
  results,
}: {
  query: string;
  category: string;
  sort: string;
  categories: MarketplaceCategory[];
  results: MarketplacePackage[];
}) {
  const { lang } = useLanguage();
  const selected = categories.find((item) => item.slug === category);
  const title = query
    ? COPY.resultsFor[lang].replace("{q}", query)
    : selected
      ? categoryName(selected.slug, selected.name, lang)
      : COPY.browse[lang];
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link href="/marketplace" className="text-xs text-slate-500 transition hover:text-slate-950">
        {COPY.back[lang]}
      </Link>

      <h1 className="mt-3 text-3xl font-bold text-slate-950">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{COPY.lead[lang]}</p>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 border-y border-slate-200 py-3">
        <div className="min-w-52 flex-1">
          <label htmlFor="search-q" className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            {COPY.search[lang]}
          </label>
          <input
            id="search-q"
            name="q"
            defaultValue={query}
            placeholder={COPY.placeholder[lang]}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="search-category" className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            {COPY.category[lang]}
          </label>
          <select id="search-category" name="category" defaultValue={category} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="">{COPY.all[lang]}</option>
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {categoryName(item.slug, item.name, lang)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="search-sort" className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            {COPY.sort[lang]}
          </label>
          <select id="search-sort" name="sort" defaultValue={sort} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <option value="recommended">{COPY.recommended[lang]}</option>
            <option value="price_asc">{COPY.priceAsc[lang]}</option>
            <option value="price_desc">{COPY.priceDesc[lang]}</option>
            <option value="delivery">{COPY.fastest[lang]}</option>
          </select>
        </div>

        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
          {COPY.apply[lang]}
        </button>

        <span className="ml-auto text-xs text-slate-500">
          {results.length === 1 ? COPY.one[lang] : COPY.many[lang].replace("{n}", String(results.length))}
        </span>
      </form>

      {results.length === 0 ? (
        <section className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-950">{COPY.none[lang]}</h2>
          <p className="mt-2 text-sm text-slate-600">{COPY.noneBody[lang]}</p>
          <Link href="/marketplace/post-project" className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white">
            {COPY.post[lang]}
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <PackageResultCard key={item.id} pkg={item} />
          ))}
        </section>
      )}
    </div>
  );
}
