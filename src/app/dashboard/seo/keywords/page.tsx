import { ProviderGatedModule } from "@/components/growth/provider-gated-module";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getConnectorStatusMap } from "@/lib/growth/status";

export const dynamic = "force-dynamic";

export default async function SeoKeywordsPage() {
  const { showSetupDetails } = await requireGrowthAccess("/dashboard/seo/keywords");
  const map = getConnectorStatusMap();
  const connectors = ["search_console", "semrush", "dataforseo", "brightlocal"].flatMap((k) => map.get(k) ?? []);
  return (
    <ProviderGatedModule
      title="Keywords"
      description="Track where each client ranks on Google, find the keywords competitors win, and measure local map-pack positions."
      emptyTitle="No tracked keywords yet"
      emptyBody="Connect Google Search Console for the client's own query data, then Semrush or DataForSEO for volumes, difficulty and daily rank tracking."
      features={[
        { name: "Rank tracking", detail: "Daily Google positions per keyword, desktop and mobile." },
        { name: "Local grid ranking", detail: "Map-pack rank across a geo grid around the business." },
        { name: "Search volume & difficulty", detail: "Monthly volume, CPC and competition for each keyword." },
        { name: "Competitor gap", detail: "Keywords competitors rank for that the client does not." },
        { name: "Search Console queries", detail: "Real impressions, clicks and CTR from Google." },
        { name: "AI content briefs", detail: "Turn a keyword into a page outline with AI credits." },
      ]}
      connectors={connectors}
      showSetupDetails={showSetupDetails}
    />
  );
}
