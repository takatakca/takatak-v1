import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LEAD_STATUS_LABELS, leadToneForStatus } from "@/lib/leads/status";
import type { LeadSummary } from "@/lib/leads/types";

const PIPELINE: { status: string; stage: string }[] = [
  { status: "new_internal", stage: "New" },
  { status: "follow_up_planned", stage: "Follow-up Planned" },
  { status: "contacted_internal", stage: "Contacted" },
  { status: "qualified_internal", stage: "Qualified" },
  { status: "proposal_planned", stage: "Proposal Planned" },
  { status: "won_internal", stage: "Won" },
  { status: "lost_internal", stage: "Lost" },
];

/** Foundation pipeline board — leads grouped by status. Display only,
 *  no drag/drop; all stage results are internal tracking only. */
export function PipelineBoard({ leads }: { leads: LeadSummary[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {PIPELINE.map(({ status, stage }) => {
        const stageLeads = leads.filter((l) => l.status === status);
        return (
          <Card key={status}>
            <CardHeader
              title={stage}
              subtitle={`${stageLeads.length} lead${stageLeads.length === 1 ? "" : "s"} · internal only`}
              action={<Badge tone={leadToneForStatus(status)}>{stageLeads.length}</Badge>}
            />
            <CardBody className="space-y-1.5">
              {stageLeads.length ? (
                stageLeads.map((l) => (
                  <div key={l.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5">
                    <p className="truncate text-xs font-medium text-slate-700">{l.name ?? "Unnamed lead"}</p>
                    <p className="truncate text-[10px] text-slate-400">{LEAD_STATUS_LABELS[l.status] ?? l.status}</p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-300">Empty</p>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
