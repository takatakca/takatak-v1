import { PhotoCard } from "@/components/local-listings/photo-card";
import { LocalListingsEmptyState } from "@/components/local-listings/local-listings-empty-state";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";
import { LocalSourceBanner } from "@/components/local-listings/source-banner";
import { getListingPhotosData } from "@/lib/local-listings/local-listings-data";

export const dynamic = "force-dynamic";

export default async function PhotosPage() {
  const data = await getListingPhotosData();
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Photos"
        subtitle="Listing photo foundation. Placeholders only — no upload or provider sync exists yet."
        badges={[{ label: "Foundation" }, { label: "Internal demo" }]}
      />
      <LocalSourceBanner source={data.source} label={data.sourceLabel} />
      {data.photos.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.photos.map((p) => <PhotoCard key={p.id} photo={p} />)}
        </div>
      ) : (
        <LocalListingsEmptyState title="No photos yet" description="Listing photo assets appear here." />
      )}
    </div>
  );
}
