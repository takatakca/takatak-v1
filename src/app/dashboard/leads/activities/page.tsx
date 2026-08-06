import { LeadActivityCard } from "@/components/leads/lead-activity-card";
import { LeadsEmptyState } from "@/components/leads/leads-empty-state";
import { LeadsHeader } from "@/components/leads/leads-header";
import { LeadsSourceBanner } from "@/components/leads/source-banner";
import { getLeadActivitiesData } from "@/lib/leads/leads-data";

export const dynamic = "force-dynamic";

export default async function LeadActivitiesPage() {
  const data = await getLeadActivitiesData();
  return (
    <div className="space-y-5">
      <LeadsHeader
        title="Activities"
        subtitle="Follow-ups, notes, and reminders. All internal tracking — the system sends no emails, SMS, or calls."
        badges={[{ label: "Foundation" }, { label: "No outreach automation" }]}
      />
      <LeadsSourceBanner source={data.source} label={data.sourceLabel} />
      {data.activities.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.activities.map((a) => <LeadActivityCard key={a.id} activity={a} />)}
        </div>
      ) : (
        <LeadsEmptyState title="No activities yet" description="Lead activities appear here." />
      )}
    </div>
  );
}
