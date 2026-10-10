import { ProviderGatedModule } from "@/components/growth/provider-gated-module";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { listGoogleLinkedSites } from "@/lib/analytics/service";
import { fetchSearchQueries, googleServiceAccountConfigured } from "@/lib/integrations/google/client";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getConnectorStatusMap } from "@/lib/growth/status";

export const dynamic = "force-dynamic";

export default async function SeoKeywordsPage() {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/seo/keywords");
  let live: Array<{ siteName: string; property: string; result: Awaited<ReturnType<typeof fetchSearchQueries>> }> = [];
  if (access.mode === "client_scoped" && hasEffectivePermission(access, "view_reports") && googleServiceAccountConfigured()) {
    try {
      const sites = (await listGoogleLinkedSites(access.activeClientId)).filter((x) => x.searchConsoleProperty).slice(0, 3);
      live = await Promise.all(
        sites.map(async (x) => ({ siteName: x.name, property: x.searchConsoleProperty!, result: await fetchSearchQueries(x.searchConsoleProperty!, 28) })),
      );
    } catch {
      console.error("[seo] search console unavailable");
    }
  }
  const map = getConnectorStatusMap();
  const connectors = ["search_console", "semrush", "dataforseo", "brightlocal"].flatMap((k) => map.get(k) ?? []);
  return (
    <div className="space-y-6">
      {live.map((entry) => (
        <Card key={entry.property}>
          <CardHeader title={`Google searches — ${entry.siteName}`} subtitle={`Search Console · ${entry.property} · last 28 days`} />
          <CardBody className="p-0">
            {entry.result.ok && entry.result.data.length ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Query</th>
                    <th className="px-4 py-2 text-right font-medium">Clicks</th>
                    <th className="px-4 py-2 text-right font-medium">Impressions</th>
                    <th className="px-4 py-2 text-right font-medium">CTR</th>
                    <th className="px-4 py-2 text-right font-medium">Avg. position</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entry.result.data.map((q) => (
                    <tr key={q.query}>
                      <td className="px-4 py-2 text-slate-800">{q.query}</td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-900">{q.clicks.toLocaleString("en-CA")}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{q.impressions.toLocaleString("en-CA")}</td>
                      <td className="px-4 py-2 text-right text-slate-600">{(q.ctr * 100).toFixed(1)}%</td>
                      <td className="px-4 py-2 text-right text-slate-600">{q.position}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-5 py-4 text-sm text-slate-500">
                {entry.result.ok ? "No search data yet for this period." : `Search Console data is unavailable (${entry.result.reason.replace(/_/g, " ")}).`}
              </p>
            )}
          </CardBody>
        </Card>
      ))}
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
    </div>
  );
}
