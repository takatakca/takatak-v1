import { AnalyticsPanel } from "@/components/analytics/analytics-panel";
import { AdsSummaryCard } from "@/components/growth/ads-summary-card";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getActiveWorkspaceAdsSummary } from "@/lib/growth/ads-summary";
import { getAnalyticsSummary, type AnalyticsSummary } from "@/lib/analytics/service";
import { publicAppOrigin } from "@/lib/growth/public-origin";
import { getConnectorStatuses } from "@/lib/growth/status";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

export const dynamic = "force-dynamic";

const UNIFIED_METRICS = [
  { name: "Website traffic", detail: "Visitors, sessions and top pages", source: "GA4" },
  { name: "Traffic sources", detail: "Search, social, ads, direct and referral", source: "GA4" },
  { name: "Organic search", detail: "Queries, impressions, clicks and average position", source: "Search Console" },
  { name: "Conversions", detail: "Calls, forms, bookings and purchases", source: "GA4 + Meta CAPI" },
  { name: "Paid performance", detail: "Spend, CPC, CPL and ROAS across every network", source: "Ads connectors" },
  { name: "Social growth", detail: "Followers, reach and engagement", source: "Social module" },
  { name: "Reputation", detail: "Average rating, review velocity and response rate", source: "Reviews connectors" },
  { name: "Lead pipeline", detail: "New leads by source and conversion to customers", source: "Leads module" },
];

export default async function GrowthAnalyticsPage({ searchParams }: { searchParams: Promise<{ site?: string; days?: string }> }) {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/analytics");
  const params = await searchParams;
  const scoped = access.mode === "client_scoped" && hasEffectivePermission(access, "view_reports");
  let summary: AnalyticsSummary | null = null;
  let unavailable = false;
  if (scoped) {
    try {
      summary = await getAnalyticsSummary(access.activeClientId, { siteId: params.site ?? null, days: Number(params.days) || 30 });
    } catch {
      unavailable = true;
      console.error("[analytics] summary unavailable");
    }
  }
  const origin = await publicAppOrigin();
  const ads = await getActiveWorkspaceAdsSummary(access);
  const connectors = getConnectorStatuses().filter((c) => c.category === "analytics");

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Analytics"
        description="TAKATAK Analytics (cookie-free, first-party) plus ads, search, social, reviews and leads in one scoreboard."
        badges={[{ label: "TAKATAK Analytics live", tone: "success" }]}
      />

      {summary ? (
        <AnalyticsPanel data={summary} canManage={access.mode === "client_scoped" && hasEffectivePermission(access, "manage_services")} origin={origin} />
      ) : (
        <HonestyNote>
          {unavailable
            ? "The analytics database is not reachable right now, so website numbers are hidden rather than guessed."
            : "Select a client workspace to add its websites, install TAKATAK Analytics and see live traffic."}
        </HonestyNote>
      )}

      <AdsSummaryCard summary={ads} />

      <Card>
        <CardHeader title="Unified scoreboard" subtitle="Each metric fills in as its source is connected." />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {UNIFIED_METRICS.map((m) => (
            <div key={m.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{m.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{m.detail}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Source: {m.source}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Tracking & analytics connectors</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>Website and search numbers appear only after GA4 or Search Console returns real data. Nothing is estimated.</HonestyNote>
      </section>
    </div>
  );
}
