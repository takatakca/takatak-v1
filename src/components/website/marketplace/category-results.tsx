"use client";

import Link from "next/link";
import {
  useMemo,
  useState,
} from "react";
import {
  BadgeCheck,
  Clock,
  ShieldCheck,
} from "lucide-react";

import { PackageResultCard } from "@/components/website/marketplace/package-result-card";
import type {
  MarketplaceCategory,
  MarketplacePackage,
} from "@/lib/website/marketplace-catalog";
import { categoryName } from "@/lib/website/marketplace-i18n";
import { useLanguage } from "@/lib/website/use-language";

const COPY = {
  back: { fr: "← Place de marché", en: "← Marketplace" },
  lead: {
    fr: "Des pigistes TAKATAK vérifiés, avec un contenu clair, des prix fixes et un paiement protégé.",
    en: "Vetted TAKATAK freelancers, with clear scope, fixed prices and escrow protection.",
  },
  escrow: { fr: "Paiement protégé", en: "Escrow protected" },
  delivery: { fr: "Livraison en {min} à {max} jours", en: "Delivery in {min}–{max} days" },
  deliveryOne: { fr: "Livraison en {min} jours", en: "Delivery in {min} days" },
  verified: { fr: "Vérifié par Groupe TAKATAK", en: "Verified by Groupe TAKATAK" },
  budget: { fr: "Budget maximum (CAD)", en: "Max budget (CAD)" },
  days: { fr: "Délai maximum (jours)", en: "Max delivery (days)" },
  any: { fr: "Tous", en: "Any" },
  sort: { fr: "Trier", en: "Sort" },
  recommended: { fr: "Recommandés", en: "Recommended" },
  priceAsc: { fr: "Prix : du plus bas au plus haut", en: "Price: low to high" },
  priceDesc: { fr: "Prix : du plus haut au plus bas", en: "Price: high to low" },
  fastest: { fr: "Livraison la plus rapide", en: "Fastest delivery" },
  count: { fr: "{n} sur {total} forfaits", en: "{n} of {total} packages" },
  none: { fr: "Aucun forfait ne correspond à vos filtres", en: "No packages match your filters yet" },
  noneBody: {
    fr: "Décrivez votre projet et TAKATAK vous jumelle avec un pigiste vérifié.",
    en: "Post a brief and TAKATAK will assign a vetted freelancer.",
  },
  custom: { fr: "Publier un projet sur mesure", en: "Post a custom project" },
  notFound: { fr: "Vous ne trouvez pas exactement ce qu’il vous faut ?", en: "Can’t find exactly what you need?" },
  notFoundBody: {
    fr: "Décrivez votre projet et TAKATAK vous jumelle avec un pigiste vérifié.",
    en: "Post a brief and TAKATAK will match you with a vetted freelancer.",
  },
  post: { fr: "Publier un projet", en: "Post a project" },
} as const;

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

function getStartingPrice(
  item: MarketplacePackage,
): number {
  if (item.tiers.length === 0) {
    return 0;
  }

  return (
    Math.min(
      ...item.tiers.map(
        (tier) => tier.priceCents,
      ),
    ) / 100
  );
}

function getDeliveryDays(
  item: MarketplacePackage,
): number {
  if (item.tiers.length === 0) {
    return 0;
  }

  return Math.min(
    ...item.tiers.map(
      (tier) => tier.deliveryDays,
    ),
  );
}

export function CategoryResults({
  category,
  packages,
}: {
  category: MarketplaceCategory;
  packages: MarketplacePackage[];
}) {
  const { lang } = useLanguage();
  const name = categoryName(category.slug, category.name, lang);
  // Real delivery range of this category's packages (fastest tier of each).
  const days = packages.map(getDeliveryDays).filter((d) => d > 0);
  const minDays = days.length ? Math.min(...days) : 0;
  const maxDays = days.length ? Math.max(...days) : 0;
  const [
    maxBudget,
    setMaxBudget,
  ] = useState("");

  const [
    maxDelivery,
    setMaxDelivery,
  ] = useState("");

  const [
    sort,
    setSort,
  ] = useState("recommended");

  const filtered = useMemo(() => {
    let result = [...packages];

    const parsedBudget =
      Number(maxBudget);

    if (
      maxBudget.trim() &&
      Number.isFinite(
        parsedBudget,
      ) &&
      parsedBudget >= 0
    ) {
      result = result.filter(
        (item) =>
          getStartingPrice(item) <=
          parsedBudget,
      );
    }

    const parsedDelivery =
      Number(maxDelivery);

    if (
      maxDelivery.trim() &&
      Number.isFinite(
        parsedDelivery,
      ) &&
      parsedDelivery > 0
    ) {
      result = result.filter(
        (item) =>
          getDeliveryDays(item) <=
          parsedDelivery,
      );
    }

    switch (sort) {
      case "price_asc":
        result.sort(
          (left, right) =>
            getStartingPrice(left) -
            getStartingPrice(right),
        );
        break;

      case "price_desc":
        result.sort(
          (left, right) =>
            getStartingPrice(right) -
            getStartingPrice(left),
        );
        break;

      case "delivery":
        result.sort(
          (left, right) =>
            getDeliveryDays(left) -
            getDeliveryDays(right),
        );
        break;

      default:
        break;
    }

    return result;
  }, [
    maxBudget,
    maxDelivery,
    packages,
    sort,
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-10">
      <header className="border-b border-slate-200 pb-6">
        <Link
          href="/marketplace"
          className="text-xs text-slate-500 transition hover:text-slate-950"
        >
          {COPY.back[lang]}
        </Link>

        <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-4xl">
          {name}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          {COPY.lead[lang]}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck
              size={13}
              className="text-primary"
              aria-hidden
            />

            {COPY.escrow[lang]}
          </span>

          {minDays > 0 ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock
                size={13}
                className="text-primary"
                aria-hidden
              />

              {fill(minDays === maxDays ? COPY.deliveryOne[lang] : COPY.delivery[lang], { min: minDays, max: maxDays })}
            </span>
          ) : null}

          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck
              size={13}
              className="text-primary"
              aria-hidden
            />

            {COPY.verified[lang]}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3 border-y border-slate-200 py-3 text-sm">
        <div>
          <label htmlFor="filter-budget" className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            {COPY.budget[lang]}
          </label>

          <input
            id="filter-budget"
            value={maxBudget}
            onChange={(event) =>
              setMaxBudget(
                event.target.value,
              )
            }
            type="number"
            min="0"
            placeholder={COPY.any[lang]}
            className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="filter-days" className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            {COPY.days[lang]}
          </label>

          <input
            id="filter-days"
            value={maxDelivery}
            onChange={(event) =>
              setMaxDelivery(
                event.target.value,
              )
            }
            type="number"
            min="1"
            placeholder={COPY.any[lang]}
            className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none focus:border-primary"
          />
        </div>

        <div>
          <label htmlFor="filter-sort" className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            {COPY.sort[lang]}
          </label>

          <select
            id="filter-sort"
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value,
              )
            }
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none focus:border-primary"
          >
            <option value="recommended">{COPY.recommended[lang]}</option>
            <option value="price_asc">{COPY.priceAsc[lang]}</option>
            <option value="price_desc">{COPY.priceDesc[lang]}</option>
            <option value="delivery">{COPY.fastest[lang]}</option>
          </select>
        </div>

        <span className="ml-auto text-xs text-slate-500">
          {fill(COPY.count[lang], { n: filtered.length, total: packages.length })}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-950">
            {COPY.none[lang]}
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {COPY.noneBody[lang]}
          </p>

          <Link
            href={`/marketplace/post-project?category=${encodeURIComponent(
              category.slug,
            )}`}
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            {COPY.custom[lang]}
          </Link>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <PackageResultCard
              key={item.id}
              pkg={item}
            />
          ))}
        </section>
      )}

      <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 md:flex-row md:items-center md:p-8">
        <div>
          <h2 className="font-semibold text-slate-950">
            {COPY.notFound[lang]}
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            {COPY.notFoundBody[lang]}
          </p>
        </div>

        <Link
          href={`/marketplace/post-project?category=${encodeURIComponent(
            category.slug,
          )}`}
          className="shrink-0 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          {COPY.post[lang]}
        </Link>
      </section>
    </div>
  );
}
