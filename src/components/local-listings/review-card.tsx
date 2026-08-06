import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LISTING_PROVIDER_LABELS, REPLY_STATUS_LABELS, REVIEW_STATUS_LABELS, SENTIMENT_LABELS, localToneForStatus } from "@/lib/local-listings/status";
import type { ListingReviewSummary } from "@/lib/local-listings/types";

export function ReviewCard({ review }: { review: ListingReviewSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{review.title ?? "Untitled review"}</h3>
            <p className="text-[11px] text-slate-400">
              {review.reviewerName ?? "Anonymous"} · {review.listingName ?? "Unlinked"}{review.reviewedAt ? ` · ${review.reviewedAt}` : ""}
            </p>
          </div>
          <Badge tone={localToneForStatus(review.status)}>{REVIEW_STATUS_LABELS[review.status] ?? review.status}</Badge>
        </div>
        {typeof review.rating === "number" ? (
          <p className="flex items-center gap-1 text-xs text-slate-600">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`h-3.5 w-3.5 ${i < (review.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-slate-200"}`} />
            ))}
            <span className="ml-1 text-[11px] text-slate-400">{review.rating}/5</span>
          </p>
        ) : null}
        {review.bodyPreview ? <p className="text-xs leading-relaxed text-slate-600">{review.bodyPreview}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <Badge tone={localToneForStatus(review.sentiment)}>{SENTIMENT_LABELS[review.sentiment] ?? review.sentiment}</Badge>
          <Badge tone={localToneForStatus(review.replyStatus)}>{REPLY_STATUS_LABELS[review.replyStatus] ?? review.replyStatus}</Badge>
          <Badge tone="muted">{LISTING_PROVIDER_LABELS[review.provider] ?? review.provider}</Badge>
          {review.replyStatus === "draft_reply" ? <span>Draft reply — future workflow.</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}
