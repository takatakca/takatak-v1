import { LeadSourceCard } from "@/components/leads/lead-source-card";
import { LeadsEmptyState } from "@/components/leads/leads-empty-state";
import { LeadsHeader } from "@/components/leads/leads-header";
import { LeadsSourceBanner } from "@/components/leads/source-banner";
import { getLeadSourcesData } from "@/lib/leads/leads-data";

export const dynamic = "force-dynamic";

export default async function LeadSourcesPage() {
  const data = await getLeadSourcesData();
  return (
    <div className="space-y-5">
      <LeadsHeader
        title="Sources"
        subtitle="Where leads come from. The FLEXS source is planned only — no capture widget or provider sync exists."
        badges={[{ label: "Foundation" }, { label: "FLEXS not connected" }]}
      />
      <LeadsSourceBanner source={data.source} label={data.sourceLabel} />
      {data.sources.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.sources.map((s) => <LeadSourceCard key={s.id} source={s} />)}
        </div>
      ) : (
        <LeadsEmptyState title="No sources yet" description="Lead sources appear here." />
      )}
    </div>
  );
}
