import { CampaignCard } from "@/components/social/campaign-card";
import { SocialEmptyState } from "@/components/social/social-empty-state";
import { SocialHeader } from "@/components/social/social-header";
import { SourceBanner } from "@/components/social/source-banner";
import { getSocialCampaignsData } from "@/lib/social/social-data";

export const dynamic = "force-dynamic";

export default async function SocialCampaignsPage() {
  const data = await getSocialCampaignsData();
  return (
    <div className="space-y-5">
      <SocialHeader
        title="Campaigns"
        subtitle="Social campaigns per brand with goals, dates, and post counts. Campaign creation UI arrives in a later phase."
        badges={[{ label: "Foundation" }]}
      />
      <SourceBanner source={data.source} label={data.sourceLabel} />
      {data.campaigns.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      ) : (
        <SocialEmptyState title="No campaigns yet" description="Campaigns appear here once created." />
      )}
    </div>
  );
}
