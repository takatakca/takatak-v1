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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10">
        <header>
          <h1 className="text-3xl font-bold text-foreground">
            {query
              ? `Results for “${query}”`
              : "Search TAKATAK"}
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            Search marketplace packages,
            domains, hosting, and public
            TAKATAK services.
          </p>

          <form
            method="get"
            className="mt-5 flex max-w-xl overflow-hidden rounded-lg border border-border"
          >
            <input
              name="q"
              defaultValue={query}
              placeholder="Search TAKATAK"
              className="min-w-0 flex-1 px-4 py-3 text-sm outline-none"
            />

            <button
              type="submit"
              className="bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              Search
            </button>
          </form>
        </header>

        {normalized.includes(
          "domain",
        ) ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
            Looking for a domain?{" "}
            <Link
              href="/domain"
              className="font-semibold text-primary"
            >
              Search domains →
            </Link>
          </div>
        ) : null}

        {normalized.includes(
          "hosting",
        ) ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
            Looking for hosting?{" "}
            <Link
              href="/hosting"
              className="font-semibold text-primary"
            >
              View hosting plans →
            </Link>
          </div>
        ) : null}

        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Marketplace packages{" "}
              {packages.length > 0
                ? `(${packages.length})`
                : ""}
            </h2>

            <Link
              href="/marketplace"
              className="text-xs font-medium text-primary"
            >
              Browse marketplace
            </Link>
          </div>

          {packages.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-card p-8 text-center">
              <h3 className="font-semibold text-foreground">
                No matching package yet
              </h3>

              <p className="mt-1 text-sm text-muted-foreground">
                Post a custom project to
                continue.
              </p>

              <Link
                href="/marketplace/post-project"
                className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              TAKATAK services
            </h2>

            <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
              {services.map(
                (service) => (
                  <li key={service.slug}>
                    <Link
                      href={`/services/${service.slug}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-secondary"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {service.title}
                        </p>

                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {
                            service.shortDescription
                          }
                        </p>
                      </div>

                      <span className="shrink-0 text-xs text-primary">
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