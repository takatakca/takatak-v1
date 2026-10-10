import { ConnectorGrid } from "@/components/growth/connector-card";
import { GrowthHeader, HonestyNote } from "@/components/growth/growth-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import type { ConnectorStatus } from "@/lib/growth/types";

/** Module page whose data comes entirely from external providers not yet wired. */
export function ProviderGatedModule({
  title,
  description,
  features,
  connectors,
  showSetupDetails,
  emptyTitle,
  emptyBody,
}: {
  title: string;
  description: string;
  features: Array<{ name: string; detail: string }>;
  connectors: ConnectorStatus[];
  showSetupDetails: boolean;
  emptyTitle: string;
  emptyBody: string;
}) {
  const ready = connectors.some((c) => c.state === "configured_untested" || c.state === "built_in");
  return (
    <div className="space-y-6">
      <GrowthHeader
        title={title}
        description={description}
        badges={[ready ? { label: "Provider credentials set", tone: "accent" } : { label: "Awaiting provider", tone: "warning" }]}
      />

      <Card>
        <CardHeader title={emptyTitle} subtitle="No data is shown until a provider returns real results." />
        <CardBody>
          <p className="text-sm text-slate-600">{emptyBody}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="What this module delivers" />
        <CardBody className="grid gap-2 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
              <p className="text-xs font-semibold text-slate-800">{f.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{f.detail}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Data providers</h2>
        <ConnectorGrid connectors={connectors} showSetupDetails={showSetupDetails} />
        <HonestyNote>Nothing on this page is estimated or simulated. Each provider activates after a verified, credentialed API call.</HonestyNote>
      </section>
    </div>
  );
}
