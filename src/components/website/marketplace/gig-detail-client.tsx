"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useState,
} from "react";
import {
  Check,
  Clock,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Star,
} from "lucide-react";

import { ServiceThumbnail } from "@/components/website/marketplace/service-thumbnail";
import {
  formatStartingPrice,
  shortestDelivery,
  type MarketplacePackage,
} from "@/lib/website/marketplace-catalog";
import {
  saveCheckoutSelection,
  saveQuotePrefill,
} from "@/lib/website/marketplace-storage";

function dollars(
  cents: number,
): string {
  return `$${Math.round(
    cents / 100,
  ).toLocaleString("en-CA")}`;
}

export function GigDetailClient({
  pkg,
  related,
}: {
  pkg: MarketplacePackage;
  related: MarketplacePackage[];
}) {
  const router = useRouter();

  const [tierIndex, setTierIndex] =
    useState(
      pkg.tiers.length > 1
        ? 1
        : 0,
    );

  const [
    selectedAddons,
    setSelectedAddons,
  ] = useState<number[]>([]);

  const [promoCode, setPromoCode] =
    useState("");

  const [promoApplied, setPromoApplied] =
    useState(false);

  const tier =
    pkg.tiers[tierIndex];

  const addons =
    selectedAddons.map(
      (index) =>
        pkg.addons[index],
    );

  const addonsTotal =
    addons.reduce(
      (sum, item) =>
        sum + item.priceCents,
      0,
    );

  const subtotal =
    tier.priceCents +
    addonsTotal;

  const discount =
    promoApplied
      ? Math.round(
          subtotal * 0.1,
        )
      : 0;

  const total =
    subtotal - discount;

  function toggleAddon(
    index: number,
  ) {
    setSelectedAddons(
      (current) =>
        current.includes(index)
          ? current.filter(
              (item) =>
                item !== index,
            )
          : [...current, index],
    );
  }

  function createPrefill() {
    return {
      packageId: pkg.id,
      title: pkg.title,
      category: pkg.category,
      tierName: tier.name,
      tierPriceCents:
        tier.priceCents,
      addons: addons.map(
        (item) => ({
          label: item.label,
          priceCents:
            item.priceCents,
        }),
      ),
      totalCents: subtotal,
    };
  }

  function continueCheckout() {
    saveCheckoutSelection({
      ...createPrefill(),
      deliveryDays:
        tier.deliveryDays,
      promoCode:
        promoApplied
          ? "FIRST10"
          : null,
      discountCents:
        discount,
      finalTotalCents: total,
    });

    router.push("/checkout");
  }

  function requestQuote() {
    saveQuotePrefill(
      createPrefill(),
    );

    router.push(
      "/marketplace/post-project",
    );
  }

  function applyPromo() {
    setPromoApplied(
      promoCode
        .trim()
        .toUpperCase() ===
        "FIRST10",
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/marketplace"
        className="text-xs text-slate-500 transition hover:text-slate-950"
      >
        ← Back to marketplace
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <header>
            <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
              {pkg.categoryName}
            </p>

            <h1 className="mt-1 text-3xl font-bold leading-tight text-slate-950 md:text-4xl">
              {pkg.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <Star
                size={14}
                className="fill-slate-950 text-slate-950"
              />

              <span className="font-semibold text-slate-950">
                {pkg.rating.toFixed(1)}
              </span>

              <span>
                ({pkg.reviews} reviews)
              </span>

              <span>·</span>
              <span>
                Delivered through TAKATAK
              </span>
            </div>
          </header>

          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <ServiceThumbnail
              kind={pkg.thumb}
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              pkg.thumb,
              "branding",
              "seo",
              "social",
            ].map((kind, index) => (
              <div
                key={`${kind}-${index}`}
                className={`overflow-hidden rounded-lg border ${
                  index === 0
                    ? "border-emerald-600 ring-1 ring-emerald-200"
                    : "border-slate-200"
                }`}
              >
                <ServiceThumbnail
                  kind={
                    kind as MarketplacePackage["thumb"]
                  }
                />
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              What you get
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pkg.deliverables.map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <Check
                      size={14}
                      className="mt-1 shrink-0 text-emerald-700"
                    />

                    {item}
                  </div>
                ),
              )}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-[#090a1a] p-5 text-white">
            <div className="flex items-start gap-3">
              <ShieldCheck
                size={20}
                className="mt-0.5 shrink-0 text-emerald-400"
              />

              <div>
                <h2 className="font-semibold">
                  TAKATAK protection
                </h2>

                <p className="mt-1 text-sm leading-6 text-slate-300">
                  The project scope, files,
                  milestones, revisions, and
                  approvals remain organized
                  through TAKATAK.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              About this package
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {pkg.description}
            </p>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="grid grid-cols-3 border-b border-slate-200">
              {pkg.tiers.map(
                (tierItem, index) => (
                  <button
                    key={tierItem.name}
                    type="button"
                    onClick={() =>
                      setTierIndex(index)
                    }
                    className={`px-4 py-3 text-sm font-semibold ${
                      index === tierIndex
                        ? "border-b-2 border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "text-slate-500 hover:text-slate-950"
                    }`}
                  >
                    {tierItem.name}
                  </button>
                ),
              )}
            </div>

            <div className="p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="text-2xl font-bold text-slate-950">
                  {dollars(
                    tier.priceCents,
                  )}
                </p>

                <div className="flex gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />
                    {tier.deliveryDays} days
                  </span>

                  <span className="inline-flex items-center gap-1">
                    <RefreshCw size={12} />
                    {tier.revisions} revisions
                  </span>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {tier.includes.map(
                  (item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2"
                    >
                      <Check
                        size={14}
                        className="mt-1 shrink-0 text-emerald-700"
                      />

                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              Add-ons and upgrades
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Optional extras you can add to
              this package.
            </p>

            <ul className="mt-4 space-y-2">
              {pkg.addons.map(
                (item, index) => {
                  const selected =
                    selectedAddons.includes(
                      index,
                    );

                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() =>
                          toggleAddon(
                            index,
                          )
                        }
                        className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm ${
                          selected
                            ? "border-emerald-600 bg-emerald-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded border ${
                              selected
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300"
                            }`}
                          >
                            {selected ? (
                              <Check size={11} />
                            ) : null}
                          </span>

                          <span className="font-medium text-slate-950">
                            {item.label}
                          </span>
                        </span>

                        <span className="font-semibold text-slate-950">
                          +
                          {dollars(
                            item.priceCents,
                          )}
                        </span>
                      </button>
                    </li>
                  );
                },
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-950">
              Frequently asked questions
            </h2>

            <ul className="mt-3 divide-y divide-slate-200">
              {pkg.faq.map((item) => (
                <li
                  key={item.q}
                  className="py-3"
                >
                  <p className="text-sm font-medium text-slate-950">
                    {item.q}
                  </p>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {item.a}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {related.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-6">
              <h2 className="font-semibold text-slate-950">
                Related packages
              </h2>

              <ul className="mt-3 divide-y divide-slate-200">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/marketplace/gigs/${item.id}`}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-950">
                          {item.title}
                        </p>

                        <p className="truncate text-xs text-slate-500">
                          {item.categoryName} ·{" "}
                          {shortestDelivery(
                            item,
                          )}
                          -day delivery
                        </p>
                      </div>

                      <span className="shrink-0 text-sm font-semibold text-slate-950">
                        {formatStartingPrice(
                          item,
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="h-fit space-y-3 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between bg-[#090a1a] px-6 py-3 text-xs font-semibold text-white">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck
                  size={13}
                  className="text-emerald-400"
                />

                TAKATAK order
              </span>

              <span className="text-slate-400">
                CAD
              </span>
            </div>

            <div className="p-6">
              <p className="text-xs text-slate-500">
                Selected tier · {tier.name}
              </p>

              <p className="mt-1 text-3xl font-bold text-slate-950">
                {dollars(total)}
              </p>

              {pkg.intakeRequired ? (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                  Intake required — TAKATAK will
                  collect a project brief before
                  kickoff.
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 border-y border-slate-200 py-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Clock size={12} />
                  {tier.deliveryDays} days
                </span>

                <span>·</span>
                <span>
                  {tier.revisions} revisions
                </span>
              </div>

              <div className="mt-4">
                <label className="block text-xs font-medium text-slate-700">
                  Promotion code
                </label>

                <div className="mt-1 flex gap-2">
                  <input
                    value={promoCode}
                    onChange={(event) => {
                      setPromoCode(
                        event.target.value,
                      );

                      setPromoApplied(
                        false,
                      );
                    }}
                    placeholder="FIRST10"
                    className="min-w-0 flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-600"
                  />

                  <button
                    type="button"
                    onClick={applyPromo}
                    className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700"
                  >
                    Apply
                  </button>
                </div>

                {promoApplied ? (
                  <p className="mt-2 text-xs text-emerald-700">
                    10% discount applied: -
                    {dollars(discount)}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={continueCheckout}
                className="mt-4 w-full rounded-md bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                Continue ({dollars(total)})
              </button>

              <button
                type="button"
                onClick={requestQuote}
                className="mt-2 w-full rounded-md border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Request a custom quote
              </button>

              <p className="mt-3 inline-flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                <ShieldCheck
                  size={12}
                  className="mt-0.5 text-emerald-700"
                />

                Your selection is saved before
                continuing to the secure
                TAKATAK account flow.
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
            <p className="flex items-start gap-2">
              <Check
                size={12}
                className="mt-0.5 text-emerald-700"
              />

              TAKATAK organizes the project
              kickoff and delivery.
            </p>

            <p className="flex items-start gap-2">
              <Check
                size={12}
                className="mt-0.5 text-emerald-700"
              />

              Files and messages remain inside
              the project workspace.
            </p>

            <p className="flex items-start gap-2">
              <MessageSquare
                size={12}
                className="mt-0.5 text-emerald-700"
              />

              Revisions remain connected to the
              active project.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}