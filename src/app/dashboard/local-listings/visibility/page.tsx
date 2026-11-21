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
        title="Visibilité · Visibility"
        subtitle="Des relevés de la visibilité locale de votre entreprise, tirés des dossiers que l’équipe TAKATAK tient pour vous · Snapshots of your local visibility."
      />
      <LocalSourceBanner source={data.source} label={data.sourceLabel} />
      {data.snapshots.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.snapshots.map((s) => <VisibilitySnapshotCard key={s.id} snapshot={s} />)}
        </div>
      ) : (
        <LocalListingsEmptyState title="Aucun relevé pour l’instant · No snapshots yet" description="Les relevés de visibilité paraissent ici · Visibility snapshots appear here." />
      )}
    </div>
  );
}
