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

      case "rating":
        result.sort(
          (left, right) =>
            right.rating -
            left.rating,
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
          ← Marketplace
        </Link>

        <h1 className="mt-2 text-3xl font-bold text-slate-950 md:text-4xl">
          {category.name}
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Vetted TAKATAK freelancers
          delivering{" "}
          {category.name.toLowerCase()}{" "}
          with clear scope, fixed prices,
          and escrow protection.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck
              size={13}
              className="text-emerald-700"
            />

            Escrow protected
          </span>

          <span className="inline-flex items-center gap-1.5">
            <Clock
              size={13}
              className="text-emerald-700"
            />

            Avg. delivery 3–7 days
          </span>

          <span className="inline-flex items-center gap-1.5">
            <BadgeCheck
              size={13}
              className="text-emerald-700"
            />

            Verified by Groupe TAKATAK
          </span>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-3 border-y border-slate-200 py-3 text-sm">
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Max budget (CAD)
          </label>

          <input
            value={maxBudget}
            onChange={(event) =>
              setMaxBudget(
                event.target.value,
              )
            }
            type="number"
            min="0"
            placeholder="Any"
            className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none focus:border-emerald-600"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Max delivery (days)
          </label>

          <input
            value={maxDelivery}
            onChange={(event) =>
              setMaxDelivery(
                event.target.value,
              )
            }
            type="number"
            min="1"
            placeholder="Any"
            className="w-28 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none focus:border-emerald-600"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Sort
          </label>

          <select
            value={sort}
            onChange={(event) =>
              setSort(
                event.target.value,
              )
            }
            className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-950 outline-none focus:border-emerald-600"
          >
            <option value="recommended">
              Recommended
            </option>

            <option value="price_asc">
              Price: low to high
            </option>

            <option value="price_desc">
              Price: high to low
            </option>

            <option value="delivery">
              Fastest delivery
            </option>

            <option value="rating">
              Highest rated
            </option>
          </select>
        </div>

        <span className="ml-auto text-xs text-slate-500">
          {filtered.length} of{" "}
          {packages.length} packages
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-950">
            No packages match your
            filters yet
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Post a{" "}
            {category.name.toLowerCase()}{" "}
            brief and TAKATAK will assign a
            vetted freelancer.
          </p>

          <Link
            href={`/marketplace/post-project?category=${encodeURIComponent(
              category.slug,
            )}`}
            className="mt-4 inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Post a custom project
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
            Can&apos;t find exactly what
            you need?
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Post a {category.name} brief
            and TAKATAK will match you with
            a vetted freelancer.
          </p>
        </div>

        <Link
          href={`/marketplace/post-project?category=${encodeURIComponent(
            category.slug,
          )}`}
          className="shrink-0 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Post a project
        </Link>
      </section>
    </div>
  );
}
