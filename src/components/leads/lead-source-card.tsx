import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LEAD_PROVIDER_LABELS, LEAD_SOURCE_STATUS_LABELS, LEAD_SOURCE_TYPE_LABELS, leadToneForStatus } from "@/lib/leads/status";
import type { LeadSourceSummary } from "@/lib/leads/types";

export function LeadSourceCard({ source }: { source: LeadSourceSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{source.name}</h3>
            <p className="text-[11px] text-slate-400">{source.brandName ?? "Unassigned brand"}</p>
          </div>
          <Badge tone={leadToneForStatus(source.status)}>{LEAD_SOURCE_STATUS_LABELS[source.status] ?? source.status}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <Badge tone="muted">{LEAD_SOURCE_TYPE_LABELS[source.type] ?? source.type}</Badge>
          <Badge tone="muted">{LEAD_PROVIDER_LABELS[source.provider] ?? source.provider}</Badge>
          <span>{source.leadCount} lead{source.leadCount === 1 ? "" : "s"}</span>
        </div>
      </CardBody>
    </Card>
  );
}
