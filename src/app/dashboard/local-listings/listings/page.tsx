import { LocalListingCard } from "@/components/local-listings/local-listing-card";
import { LocalListingsEmptyState } from "@/components/local-listings/local-listings-empty-state";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";
import { LocalSourceBanner } from "@/components/local-listings/source-banner";
import { getLocalListingsData } from "@/lib/local-listings/local-listings-data";

export const dynamic = "force-dynamic";

export default async function ListingsPage() {
  const data = await getLocalListingsData();
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Listings"
        subtitle="Your business listings by platform, and whether your name, address and phone are ready. To change a listing, ask the team."
      />
      <LocalSourceBanner source={data.source} label={data.sourceLabel} />
      {data.listings.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.listings.map((l) => <LocalListingCard key={l.id} listing={l} />)}
        </div>
      ) : (
        <LocalListingsEmptyState title="No listings yet" description="Tracked business listings appear here." />
      )}
    </div>
  );
}
