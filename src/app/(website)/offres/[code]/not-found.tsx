import { CampaignEnded } from "@/components/website/funnel/CampaignLanding";
import { HomeThemeRoot } from "@/lib/website/home-theme";

// Ended or unknown campaign code: a 404 that says so and offers deal alerts.
export default function OfferNotFound() {
  return (
    <div className="tk-page">
      <HomeThemeRoot>
        <CampaignEnded />
      </HomeThemeRoot>
    </div>
  );
}
