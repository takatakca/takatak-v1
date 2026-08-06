import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { LEAD_ACTIVITY_STATUS_LABELS, LEAD_ACTIVITY_TYPE_LABELS, leadToneForStatus } from "@/lib/leads/status";
import type { LeadActivitySummary } from "@/lib/leads/types";

export function LeadActivityCard({ activity }: { activity: LeadActivitySummary }) {
  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{activity.title}</h3>
            <p className="text-[11px] text-slate-400">
              {activity.leadName ?? activity.campaignName ?? "Unlinked"}
            </p>
          </div>
          <Badge tone={leadToneForStatus(activity.status)}>{LEAD_ACTIVITY_STATUS_LABELS[activity.status] ?? activity.status}</Badge>
        </div>
        {activity.notePreview ? <p className="text-xs leading-relaxed text-slate-600">{activity.notePreview}</p> : null}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <Badge tone="muted">{LEAD_ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}</Badge>
          {activity.dueAt ? <span>Due {activity.dueAt}</span> : null}
          {activity.completedAt ? <span>Completed (internal) {activity.completedAt}</span> : null}
        </div>
      </CardBody>
    </Card>
  );
}
