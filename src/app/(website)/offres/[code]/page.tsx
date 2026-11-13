import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CampaignLanding } from "@/components/website/funnel/CampaignLanding";
import { listActiveCampaigns, normalizePromoCode } from "@/lib/promotions/catalog";
import { HomeThemeRoot } from "@/lib/website/home-theme";

export const dynamic = "force-dynamic";

function liveCampaign(code: string) {
  const wanted = normalizePromoCode(code);
  return listActiveCampaigns().find((c) => c.code === wanted) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const campaign = liveCampaign((await params).code);
  if (!campaign) return { title: "Offer", robots: { index: false } };
  const name = campaign.title?.en ?? campaign.code;
  return {
    title: `${name} — ${campaign.percentOff}% off`,
    description: `${campaign.percentOff}% off TAKATAK services with code ${campaign.code}, until ${campaign.endsAt.slice(0, 10)}.`,
    robots: { index: false, follow: true },
  };
}

// A campaign landing page for social ads (owner's brief A, 2026-10-31). It only
// exists while the campaign is live in the server catalog; after `endsAt` the
// code and this page are gone, so the countdown is always true.
export default async function OfferPage({ params }: { params: Promise<{ code: string }> }) {
  const campaign = liveCampaign((await params).code);
  if (!campaign) notFound();
  return (
    <div className="tk-page">
      <HomeThemeRoot>
        <CampaignLanding campaign={campaign} />
      </HomeThemeRoot>
    </div>
  );
}
