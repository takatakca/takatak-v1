import type { Metadata } from "next";
import Link from "next/link";

import { PackageResultCard } from "@/components/website/marketplace/package-result-card";
import { PUBLIC_SERVICES } from "@/lib/website/public-services";
import { searchMarketplacePackages } from "@/lib/website/marketplace-catalog";

export const metadata: Metadata = {
  title: "Search — TAKATAK",
};

function readValue(
  value: string | string[] | undefined,
): string {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

export default async function SearchPage({
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

  const normalized =
    query.trim().toLowerCase();

  const packages =
    searchMarketplacePackages(
      query,
    );

  const services =
    PUBLIC_SERVICES.filter(
      (service) =>
        !normalized ||
        [
          service.title,
          service.shortDescription,
          service.longDescription,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
    );

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <header>
          <h1 className="text-3xl font-bold text-slate-950">
            {query
              ? `Results for “${query}”`
              : "Search TAKATAK"}
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Search marketplace packages,
            domains, hosting, and public
            TAKATAK services.
          </p>

          <form
            method="get"
            className="mt-5 flex max-w-xl overflow-hidden rounded-lg border border-slate-200"
          >
            <input
              name="q"
              defaultValue={query}
              placeholder="Search TAKATAK"
              className="min-w-0 flex-1 px-4 py-3 text-sm outline-none"
            />

            <button
              type="submit"
              className="bg-emerald-600 px-5 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>
        </header>

        {normalized.includes(
          "domain",
        ) ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
            Looking for a domain?{" "}
            <Link
              href="/domain"
              className="font-semibold text-emerald-700"
            >
              Search domains →
            </Link>
          </div>
        ) : null}

        {normalized.includes(
          "hosting",
        ) ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
            Looking for hosting?{" "}
            <Link
              href="/hosting"
              className="font-semibold text-emerald-700"
            >
              View hosting plans →
            </Link>
          </div>
        ) : null}

        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Marketplace packages{" "}
              {packages.length > 0
                ? `(${packages.length})`
                : ""}
            </h2>

            <Link
              href="/marketplace"
              className="text-xs font-medium text-emerald-700"
            >
              Browse marketplace
            </Link>
          </div>

          {packages.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <h3 className="font-semibold text-slate-950">
                No matching package yet
              </h3>

              <p className="mt-1 text-sm text-slate-600">
                Post a custom project to
                continue.
              </p>

              <Link
                href="/marketplace/post-project"
                className="mt-4 inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Post a project
              </Link>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {packages.map((item) => (
                <PackageResultCard
                  key={item.id}
                  pkg={item}
                />
              ))}
            </div>
          )}
        </section>

        {services.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              TAKATAK services
            </h2>

            <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {services.map(
                (service) => (
                  <li key={service.slug}>
                    <Link
                      href={`/services/${service.slug}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-950">
                          {service.title}
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {
                            service.shortDescription
                          }
                        </p>
                      </div>

                      <span className="shrink-0 text-xs text-emerald-700">
                        Open →
                      </span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}