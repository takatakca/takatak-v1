import { PipelineBoard } from "@/components/leads/pipeline-board";
import { LeadsHeader } from "@/components/leads/leads-header";
import { LeadsSourceBanner } from "@/components/leads/source-banner";
import { getLeadsPipelineData } from "@/lib/leads/leads-data";

export const dynamic = "force-dynamic";

export default async function LeadsPipelinePage() {
  const data = await getLeadsPipelineData();
  return (
    <div className="space-y-5">
      <LeadsHeader
        title="Pipeline"
        subtitle="Leads grouped by internal stage. Display only — no drag and drop, and Won/Lost are internal tracking states, not real conversions."
        badges={[{ label: "Foundation" }, { label: "Internal tracking" }]}
      />
      <LeadsSourceBanner source={data.source} label={data.sourceLabel} />
      <PipelineBoard leads={data.leads} />
      <p className="text-xs text-slate-400">
        Stage configuration exists per brand ({data.stages.length} stage records) — a stage editor arrives in a later phase.
      </p>
    </div>
  );
}
