import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { socialToneForStatus } from "@/lib/social/status";
import type { CampaignSummary } from "@/lib/social/types";

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">{campaign.name}</h3>
          <Badge tone={socialToneForStatus(campaign.status)}>
            {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
          </Badge>
        </div>
        {campaign.goal ? <p className="text-xs text-slate-500">{campaign.goal}</p> : null}
        <p className="text-[11px] text-slate-400">
          {campaign.brandName ?? "Unassigned brand"} · {campaign.postCount} post{campaign.postCount === 1 ? "" : "s"}
          {campaign.startsAt ? ` · ${campaign.startsAt} → ${campaign.endsAt ?? "open"}` : " · No dates set"}
        </p>
      </CardBody>
    </Card>
  );
}
