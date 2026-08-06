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
        subtitle="Citation and NAP tracking. Internal foundation records only — no citation scan runs until a provider is connected."
        badges={[{ label: "Foundation" }, { label: "Manual/internal tracking" }]}
      />
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
