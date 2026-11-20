import Link from "next/link";
import { CitationCard } from "@/components/local-listings/citation-card";
import { LocalListingsEmptyState } from "@/components/local-listings/local-listings-empty-state";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";
import { LocalSourceBanner } from "@/components/local-listings/source-banner";
import { getListingCitationsData } from "@/lib/local-listings/local-listings-data";

export const dynamic = "force-dynamic";

export default async function CitationsPage() {
  const data = await getListingCitationsData();
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Citations"
        subtitle="Your business name, address and phone on each directory, checked by the TAKATAK team."
      />
      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label="Citation audit tool">
        <h2 className="text-base font-semibold text-slate-900">Local Citation Audit</h2>
        <p className="mt-1 text-sm text-slate-600">
          Compare business details against your own CSV of directory citations. Identify mismatched phone numbers,
          addresses and websites; download a correction report. This does not scan or modify external directories.
        </p>
        <Link href="/dashboard/local-listings/citations/audit"
          className="mt-3 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
          Audit supplied citations
        </Link>
      </section>
      <LocalSourceBanner source={data.source} label={data.sourceLabel} />
      {data.citations.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.citations.map((c) => <CitationCard key={c.id} citation={c} />)}
        </div>
      ) : (
        <LocalListingsEmptyState title="No citations yet" description="Directory citations appear here." />
      )}
    </div>
  );
}
