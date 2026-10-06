import { AdsSummaryCard } from "@/components/growth/ads-summary-card";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getActiveWorkspaceAdsSummary } from "@/lib/growth/ads-summary";
import { getConnectorStatuses } from "@/lib/growth/status";

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

export default async function GrowthAnalyticsPage() {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/analytics");
  const ads = await getActiveWorkspaceAdsSummary(access);
  const connectors = getConnectorStatuses().filter((c) => c.category === "analytics");

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Analytics"
        description="One scoreboard for the whole business: website, search, ads, social, reviews and leads, reported in plain language."
      />

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
