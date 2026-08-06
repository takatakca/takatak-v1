import { LeadCard } from "@/components/leads/lead-card";
import { LeadsEmptyState } from "@/components/leads/leads-empty-state";
import { LeadsHeader } from "@/components/leads/leads-header";
import { LeadsSourceBanner } from "@/components/leads/source-banner";
import { getLeadContactsData } from "@/lib/leads/leads-data";

export const dynamic = "force-dynamic";

export default async function LeadInboxPage() {
  const data = await getLeadContactsData();
  return (
    <div className="space-y-5">
      <LeadsHeader
        title="Lead Inbox"
        subtitle="All tracked leads. Every record is an internal foundation demo — nothing is imported from FLEXS or any provider, and no outreach is sent."
        badges={[{ label: "Foundation" }, { label: "Internal demo" }]}
      />
      <LeadsSourceBanner source={data.source} label={data.sourceLabel} />
      {data.leads.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.leads.map((l) => <LeadCard key={l.id} lead={l} />)}
        </div>
      ) : (
        <LeadsEmptyState title="No leads yet" description="Tracked leads appear here." />
      )}
    </div>
  );
}
