import { VisibilitySnapshotCard } from "@/components/local-listings/visibility-snapshot-card";
import { LocalListingsEmptyState } from "@/components/local-listings/local-listings-empty-state";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";
import { LocalSourceBanner } from "@/components/local-listings/source-banner";
import { getLocalVisibilityData } from "@/lib/local-listings/local-listings-data";

export const dynamic = "force-dynamic";

export default async function VisibilityPage() {
  const data = await getLocalVisibilityData();
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Visibility"
        subtitle="Local visibility snapshots. Foundation counts from internal records — never a local SEO score from QMAPS or Google."
        badges={[{ label: "Foundation" }, { label: "Internal foundation" }]}
      />
      <LocalSourceBanner source={data.source} label={data.sourceLabel} />
      {data.snapshots.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.snapshots.map((s) => <VisibilitySnapshotCard key={s.id} snapshot={s} />)}
        </div>
      ) : (
        <LocalListingsEmptyState title="No snapshots yet" description="Visibility snapshots appear here." />
      )}
    </div>
  );
}
