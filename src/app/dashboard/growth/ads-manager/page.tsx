import { AdsSummaryCard } from "@/components/growth/ads-summary-card";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { getActiveWorkspaceAdsSummary } from "@/lib/growth/ads-summary";
import { getConnectorStatuses } from "@/lib/growth/status";

export const dynamic = "force-dynamic";

const CAPABILITIES = [
  { name: "All networks, one table", detail: "Spend, clicks, leads and cost-per-lead for Google, Meta, TikTok, Microsoft and TAKATAK ADS." },
  { name: "Budget guardrails", detail: "Daily caps and alerts. AI suggests shifts; a human approves any spend change." },
  { name: "Lead attribution", detail: "Every lead traced back to the campaign, ad and keyword through FLEXS." },
  { name: "AI ad copy", detail: "Headlines and descriptions generated from the brand voice, paid with credits." },
  { name: "Google Business ads", detail: "Local service and map-pack promotion tied to Local Listings." },
  { name: "Lead-form sync", detail: "Facebook and Google lead forms land straight in the Leads pipeline." },
];

export default async function AdsManagerPage() {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/ads-manager");
  const ads = await getActiveWorkspaceAdsSummary(access);
  const connectors = getConnectorStatuses().filter((c) => c.category === "ads");

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Ads Manager"
        description="Run and compare every ad network from one screen, starting with TAKATAK ADS, which is already live."
      />
      <AdsSummaryCard summary={ads} />
      <Card>
        <CardHeader title="What Ads Manager does" />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {CAPABILITIES.map((c) => (
            <div key={c.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{c.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{c.detail}</p>
            </div>
          ))}
        </CardBody>
      </Card>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Ad networks</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>External networks never spend money from this dashboard without an explicit, human-approved action.</HonestyNote>
      </section>
    </div>
  );
}
