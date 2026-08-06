import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LEAD_PRIORITY_LABELS, LEAD_STATUS_LABELS, leadToneForStatus } from "@/lib/leads/status";
import type { LeadSummary } from "@/lib/leads/types";

export function LeadCard({ lead }: { lead: LeadSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{lead.name ?? "Unnamed lead"}</h3>
            <p className="text-[11px] text-slate-400">
              {[lead.company, lead.email, lead.phone].filter(Boolean).join(" · ") || "No contact details"}
            </p>
          </div>
          <Badge tone={leadToneForStatus(lead.status)}>{LEAD_STATUS_LABELS[lead.status] ?? lead.status}</Badge>
        </div>
        {lead.messagePreview ? <p className="text-xs leading-relaxed text-slate-600">{lead.messagePreview}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <Badge tone={leadToneForStatus(lead.priority)}>{LEAD_PRIORITY_LABELS[lead.priority] ?? lead.priority}</Badge>
          {lead.sourceName ? <span>Source: {lead.sourceName}</span> : null}
          {lead.campaignName ? <span>· {lead.campaignName}</span> : null}
          {lead.brandName ? <span>· {lead.brandName}</span> : null}
          {lead.followUpAt ? <span>· Follow-up {lead.followUpAt}</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}
