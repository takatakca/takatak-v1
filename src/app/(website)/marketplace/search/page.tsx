import type { Metadata } from "next";
import Link from "next/link";

import { PackageResultCard } from "@/components/website/marketplace/package-result-card";
import {
  MARKETPLACE_CATEGORIES,
  searchMarketplacePackages,
  shortestDelivery,
  startingPriceCents,
} from "@/lib/website/marketplace-catalog";

export const metadata: Metadata = {
  title:
    "Search marketplace — TAKATAK",
};

function readValue(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

export default async function MarketplaceSearchPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<
      string,
      string | string[] | undefined
    >
  >;
}) {
  const resolved =
    await searchParams;

  const query = readValue(
    resolved.q,
  );

  const category = readValue(
    resolved.category,
  );

  const sort =
    readValue(resolved.sort) ||
    "recommended";

  const results = [
    ...searchMarketplacePackages(
      query,
      category || undefined,
    ),
  ];

  if (sort === "price_asc") {
    results.sort(
      (left, right) =>
        startingPriceCents(left) -
        startingPriceCents(right),
    );
  }

  if (sort === "price_desc") {
    results.sort(
      (left, right) =>
        startingPriceCents(right) -
        startingPriceCents(left),
    );
  }

  if (sort === "delivery") {
    results.sort(
      (left, right) =>
        shortestDelivery(left) -
        shortestDelivery(right),
    );
  }

  if (sort === "rating") {
    results.sort(
      (left, right) =>
        right.rating - left.rating,
    );
  }

  const selectedCategory =
    MARKETPLACE_CATEGORIES.find(
      (item) =>
        item.slug === category,
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Link
        href="/marketplace"
        className="text-xs text-slate-500 transition hover:text-slate-950"
      >
        ← Back to marketplace
      </Link>

      <h1 className="mt-3 text-3xl font-bold text-slate-950">
        {query
          ? `Marketplace results for “${query}”`
          : selectedCategory
            ? selectedCategory.name
            : "Browse marketplace packages"}
      </h1>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Every package is delivered through
        TAKATAK with organized communication,
        milestones, revisions, and approvals.
      </p>

      <form
        method="get"
        className="mt-6 flex flex-wrap items-end gap-3 border-y border-slate-200 py-3"
      >
        <div className="min-w-52 flex-1">
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Search
          </label>

          <input
            name="q"
            defaultValue={query}
            placeholder="Search packages"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Category
          </label>

          <select
            name="category"
            defaultValue={category}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">
              All categories
            </option>

            {MARKETPLACE_CATEGORIES.map(
              (item) => (
                <option
                  key={item.slug}
                  value={item.slug}
                >
                  {item.name}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
            Sort
          </label>

          <select
            name="sort"
            defaultValue={sort}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
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

        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
        >
          Apply
        </button>

        <span className="ml-auto text-xs text-slate-500">
          {results.length} result
          {results.length === 1
            ? ""
            : "s"}
        </span>
      </form>

      {results.length === 0 ? (
        <section className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="font-semibold text-slate-950">
            No matching package yet
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Post your project and TAKATAK will
            organize the brief and delivery
            process.
          </p>

          <Link
            href="/marketplace/post-project"
            className="mt-4 inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Post a project
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((item) => (
            <PackageResultCard
              key={item.id}
              pkg={item}
            />
          ))}
        </section>
      )}
    </div>
  );
}