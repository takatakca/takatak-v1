import { ReviewCard } from "@/components/local-listings/review-card";
import { LocalListingsEmptyState } from "@/components/local-listings/local-listings-empty-state";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";
import { LocalSourceBanner } from "@/components/local-listings/source-banner";
import { getListingReviewsData } from "@/lib/local-listings/local-listings-data";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const data = await getListingReviewsData();
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Reviews"
        subtitle="Review monitoring foundation. All reviews below are internal demo records — nothing is imported from Google or QMAPS, and no reply is ever sent."
        badges={[{ label: "Foundation" }, { label: "Internal demo" }]}
      />
      <LocalSourceBanner source={data.source} label={data.sourceLabel} />
      {data.reviews.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.reviews.map((r) => <ReviewCard key={r.id} review={r} />)}
        </div>
      ) : (
        <LocalListingsEmptyState title="No reviews yet" description="Tracked reviews appear here." />
      )}
    </div>
  );
}
