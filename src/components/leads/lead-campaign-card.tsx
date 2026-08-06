import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LEAD_CAMPAIGN_STATUS_LABELS, leadToneForStatus } from "@/lib/leads/status";
import type { LeadCampaignSummary } from "@/lib/leads/types";

export function LeadCampaignCard({ campaign }: { campaign: LeadCampaignSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{campaign.name}</h3>
            <p className="text-[11px] text-slate-400">{campaign.brandName ?? "Unassigned brand"}</p>
          </div>
          <Badge tone={leadToneForStatus(campaign.status)}>{LEAD_CAMPAIGN_STATUS_LABELS[campaign.status] ?? campaign.status}</Badge>
        </div>
        {campaign.goal ? <p className="text-xs text-slate-600">{campaign.goal}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {campaign.sourceName ? <span>Source: {campaign.sourceName}</span> : null}
          <span>· {campaign.leadCount} lead{campaign.leadCount === 1 ? "" : "s"}</span>
          <span>· {campaign.budgetCents != null ? `Budget ${(campaign.budgetCents / 100).toFixed(2)} ${campaign.currency}` : "No budget recorded"}</span>
          {campaign.startsAt ? <span>· {campaign.startsAt}{campaign.endsAt ? ` → ${campaign.endsAt}` : ""}</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}
