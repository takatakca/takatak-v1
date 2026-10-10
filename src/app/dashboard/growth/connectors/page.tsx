import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, GrowthKpi, HonestyNote } from "@/components/growth/growth-header";
import { requireGrowthAccess } from "@/lib/growth/access";
import { CONNECTOR_CATEGORY_LABELS, CONNECTOR_CATEGORY_ORDER } from "@/lib/growth/connectors";
import { getConnectorStatuses } from "@/lib/growth/status";

export const dynamic = "force-dynamic";

export default async function ConnectorsPage() {
  const { showSetupDetails } = await requireGrowthAccess("/dashboard/growth/connectors");
  const connectors = getConnectorStatuses();
  const count = (state: string) => connectors.filter((c) => c.state === state).length;

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Connectors"
        description="Every outside platform TAKATAK plugs into: domains, social, analytics, ads, reviews, listings, messaging, SEO, leads and payments."
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <GrowthKpi label="Built in" value={String(count("built_in"))} />
        <GrowthKpi label="Credentials set" value={String(count("configured_untested"))} hint="Untested until a real API call succeeds" />
        <GrowthKpi label="Not connected" value={String(count("not_configured"))} />
        <GrowthKpi label="Planned" value={String(count("planned"))} />
      </section>
      <HonestyNote>
        Status is based on server credentials only. No connector is ever labelled “connected” until a real, documented API call succeeds.
        {showSetupDetails ? " Missing environment variable names are shown to platform operators only." : ""}
      </HonestyNote>
      {CONNECTOR_CATEGORY_ORDER.map((category) => {
        const items = connectors.filter((c) => c.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">{CONNECTOR_CATEGORY_LABELS[category]}</h2>
            <ConnectorGrid connectors={items} showSetupDetails={showSetupDetails} />
          </section>
        );
      })}
    </div>
  );
}
