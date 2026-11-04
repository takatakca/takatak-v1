import type { Metadata } from "next";

import { DealsBoard } from "@/components/website/funnel/DealsBoard";
import { listActiveCampaigns } from "@/lib/promotions/catalog";
import { HomeThemeRoot } from "@/lib/website/home-theme";

// Campaigns start and end by date: read the server catalog on every request.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Offres du moment · Current offers",
  description:
    "Les offres TAKATAK qui existent vraiment aujourd'hui : 10 % sur votre premier service et les promotions saisonnières en cours. The TAKATAK offers live today.",
  alternates: { canonical: "/deals" },
};

export default function DealsPage() {
  const campaigns = listActiveCampaigns().map(({ code, percentOff, endsAt, title }) => ({ code, percentOff, endsAt, title }));
  return (
    <div className="tk-page">
      <HomeThemeRoot>
        <DealsBoard campaigns={campaigns} />
      </HomeThemeRoot>
    </div>
  );
}
