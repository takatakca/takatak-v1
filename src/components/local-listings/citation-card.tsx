import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { CITATION_STATUS_LABELS, LISTING_SOURCE_LABELS, NAP_STATUS_LABELS, localToneForStatus } from "@/lib/local-listings/status";
import type { ListingCitationSummary } from "@/lib/local-listings/types";

export function CitationCard({ citation }: { citation: ListingCitationSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{citation.directoryName}</h3>
            <p className="text-[11px] text-slate-400">{citation.listingName ?? "Unlinked"}</p>
          </div>
          <Badge tone={localToneForStatus(citation.status)}>{CITATION_STATUS_LABELS[citation.status] ?? citation.status}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span>NAP:</span>
          <Badge tone={localToneForStatus(citation.napStatus)}>{NAP_STATUS_LABELS[citation.napStatus] ?? citation.napStatus}</Badge>
          <Badge tone="muted">{LISTING_SOURCE_LABELS[citation.source] ?? citation.source}</Badge>
          <span>{citation.url ?? "No URL (internal tracking)"}</span>
          <span>· {citation.lastCheckedAt ? `Checked ${citation.lastCheckedAt}` : "Never checked"}</span>
        </div>
      </CardBody>
    </Card>
  );
}
