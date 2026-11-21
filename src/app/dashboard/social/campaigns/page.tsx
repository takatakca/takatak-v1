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
        title="Campagnes · Campaigns"
        subtitle="Vos campagnes sur les réseaux sociaux par marque, avec objectifs, dates et publications ; pour en lancer une, écrivez à l’équipe · Your social campaigns per brand; to start one, ask the team."
      />
      <SourceBanner source={data.source} label={data.sourceLabel} />
      {data.campaigns.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      ) : (
        <SocialEmptyState title="Aucune campagne pour l’instant · No campaigns yet" description="Les campagnes paraissent ici dès leur création · Campaigns appear here once created." />
      )}
    </div>
  );
}
