import { LeadCampaignCard } from "@/components/leads/lead-campaign-card";
import { LeadsEmptyState } from "@/components/leads/leads-empty-state";
import { LeadsHeader } from "@/components/leads/leads-header";
import { LeadsSourceBanner } from "@/components/leads/source-banner";
import { getLeadCampaignsData } from "@/lib/leads/leads-data";

export const dynamic = "force-dynamic";

export default async function LeadCampaignsPage() {
  const data = await getLeadCampaignsData();
  return (
    <div className="space-y-5">
      <LeadsHeader
        title="Lead Campaigns"
        subtitle="Lead generation campaign tracking. No real ad spend, paid sync, or provider campaign exists — budgets are unrecorded by design."
        badges={[{ label: "Foundation" }, { label: "No ad spend" }]}
      />
      <LeadsSourceBanner source={data.source} label={data.sourceLabel} />
      {data.campaigns.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.campaigns.map((c) => <LeadCampaignCard key={c.id} campaign={c} />)}
        </div>
      ) : (
        <LeadsEmptyState title="No campaigns yet" description="Lead campaigns appear here." />
      )}
    </div>
  );
}
