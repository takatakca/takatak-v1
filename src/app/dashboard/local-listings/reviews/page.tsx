import { ReviewCard } from "@/components/local-listings/review-card";
import { QmapsReplyForm } from "@/components/local-listings/qmaps-reply-form";
import { LocalListingsEmptyState } from "@/components/local-listings/local-listings-empty-state";
import { LocalListingsHeader } from "@/components/local-listings/local-listings-header";
import { LocalSourceBanner } from "@/components/local-listings/source-banner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getListingReviewsData } from "@/lib/local-listings/local-listings-data";

export const dynamic = "force-dynamic";

export default async function ReviewsPage() {
  const data = await getListingReviewsData();
  return (
    <div className="space-y-5">
      <LocalListingsHeader
        title="Reviews"
        subtitle="A reply is posted on QMAPS only when that integration is configured and QMAPS accepts it. Google replies stay on Growth reviews."
        badges={[{ label: "QMAPS reply" }, { label: "Sent only after acceptance" }]}
      />
      <LocalSourceBanner source={data.source} label={data.sourceLabel} />
      <Card>
        <CardHeader
          title="Répondre à un avis QMAPS"
          subtitle="La réponse n'est publiée que si QMAPS l'accepte. Sinon elle reste un brouillon dans cet espace."
        />
        <CardBody>
          <QmapsReplyForm />
        </CardBody>
      </Card>
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
