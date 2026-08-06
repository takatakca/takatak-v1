import type { Metadata } from "next";
import Link from "next/link";
import { Tag } from "lucide-react";

export const metadata: Metadata = {
  title: "Today's Deals — TAKATAK",
  description:
    "Limited-time bundles and discounts across TAKATAK services.",
};

export default function DealsPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16">
      <div className="text-center">
        <Tag className="mx-auto text-emerald-700" />

        <h1 className="mt-4 text-4xl font-bold text-slate-950">
          Today&apos;s Deals
        </h1>

        <p className="mt-3 text-slate-600">
          Curated bundles across domains,
          hosting, websites and marketing.
        </p>
      </div>

      <div className="mt-12 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-950">
          No active promotions right now
        </h2>

        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
          TAKATAK runs seasonal deals on
          hosting, domains, marketplace services,
          and business bundles.
        </p>

        <div className="mt-6 flex justify-center gap-2">
          <Link
            href="/services/websites"
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
          >
            Browse services
          </Link>

          <Link
            href="/marketplace"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
          >
            Visit marketplace
          </Link>
        </div>
      </div>
    </section>
  );
}