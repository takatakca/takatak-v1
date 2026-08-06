import { PlusCircle } from "lucide-react";
import { DisabledActionButton } from "@/components/saas/disabled-action-button";
import { FoundationNotice } from "@/components/saas/foundation-notice";
import { ModuleHeader } from "@/components/saas/module-header";
import { ServiceInstanceCard } from "@/components/saas/service-instance-card";
import { SERVICE_INSTANCES } from "@/lib/data/mock-data";

// Services — every purchased/active TAKATAK service instance per brand.
export default function ServicesPage() {
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Services"
        description="Every TAKATAK service instance across clients and brands: social, web/hosting, listings, leads, and AI studio."
        statuses={["foundation", "mock_data"]}
        actions={<DisabledActionButton label="Add Service" reason="Needs DB" icon={PlusCircle} />}
      />
      <FoundationNotice
        mock="The service instances below are typed mock records showing the structure real orders will use."
        future="Service ordering, activation, and per-service billing status arrive with the database (Phase 4) and provider adapters (Phases 6–10)."
        notConnected="All engines: Metricool, Upmind, QMAPS, FLEXS, TryHolo. No service is live."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SERVICE_INSTANCES.map((s) => (
          <ServiceInstanceCard key={s.id} service={s} />
        ))}
      </div>
    </div>
  );
}
