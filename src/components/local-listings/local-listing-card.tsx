import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LISTING_PROVIDER_LABELS, LISTING_STATUS_LABELS, NAP_STATUS_LABELS, localToneForStatus } from "@/lib/local-listings/status";
import type { LocalListingSummary } from "@/lib/local-listings/types";

export function LocalListingCard({ listing }: { listing: LocalListingSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{listing.name}</h3>
            <p className="text-[11px] text-slate-400">
              {listing.brandName ?? "Unassigned brand"}{listing.category ? ` · ${listing.category}` : ""}
            </p>
          </div>
          <Badge tone={localToneForStatus(listing.status)}>{LISTING_STATUS_LABELS[listing.status] ?? listing.status}</Badge>
        </div>
        <p className="text-xs text-slate-500">
          {listing.platformName} · <Badge tone="muted">{LISTING_PROVIDER_LABELS[listing.provider] ?? listing.provider}</Badge>
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>NAP:</span>
          <Badge tone={localToneForStatus(listing.napStatus)}>{NAP_STATUS_LABELS[listing.napStatus] ?? listing.napStatus}</Badge>
          <span>{[listing.city, listing.region, listing.country].filter(Boolean).join(", ")}</span>
          {listing.lastCheckedAt ? <span>· Checked {listing.lastCheckedAt}</span> : <span>· Never checked</span>}
        </div>
      </CardBody>
    </Card>
  );
}
