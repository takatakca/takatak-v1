import { PlugZap } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DisabledActionButton } from "@/components/saas/disabled-action-button";
import { FoundationNotice } from "@/components/saas/foundation-notice";
import { IntegrationStatusRow } from "@/components/saas/integration-status-row";
import { ModuleHeader } from "@/components/saas/module-header";
import { INTEGRATIONS } from "@/lib/data/mock-data";

// Integrations — provider registry. Real adapters begin in Phase 6.
export default function IntegrationsPage() {
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Integrations"
        description="Every external engine behind TAKATAK, with honest connection states. No provider is connected."
        statuses={["not_connected", "mock_data"]}
        actions={<DisabledActionButton label="Connect Provider" reason="Adapters in Phase 6+" icon={PlugZap} />}
      />
      <FoundationNotice
        mock="Provider records below are a typed registry — statuses, requirements, and env var names (never values)."
        future="Test-connection and credential flows arrive with each adapter phase: Supabase (Phase 3), Metricool (Phase 6), Upmind (Phase 8), TryHolo (Phase 10), QMAPS/FLEXS (post-MVP)."
        notConnected="Everything. A provider only shows Connected after a real credentialed API call succeeds."
      />
      <Card>
        <CardHeader title="Provider registry" subtitle="Statuses are honest by design — see docs §25/§28." />
        <CardBody className="divide-y divide-slate-100 p-0">
          {INTEGRATIONS.map((i) => (
            <IntegrationStatusRow key={i.id} integration={i} />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
