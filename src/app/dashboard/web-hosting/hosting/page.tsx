import { HostingOverview } from "@/components/web-hosting/hosting-overview";
import { syncUpmindHostingForSession } from "@/lib/integrations/upmind/upmind-hosting-sync";
import {
  getDomainAssetsData,
  getHostingServicesData,
  getProvisioningTimelineData,
} from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function HostingPackagesPage() {
  await syncUpmindHostingForSession();

  const [hosting, domains, steps] = await Promise.all([
    getHostingServicesData(),
    getDomainAssetsData(),
    getProvisioningTimelineData(),
  ]);

  const liveHosting = hosting.hostingServices.filter(
    (service) => service.fromUpmind,
  );
  const sourceLabel =
    hosting.source === "database"
      ? liveHosting.length
        ? "Upmind — hosting recorded from paid or provisioned events."
        : "No Upmind hosting yet. Demo placeholders are hidden until a real plan lands."
      : hosting.sourceLabel;

  return (
    <HostingOverview
      services={liveHosting}
      domains={domains.domains.filter(
        (domain) => domain.registrar !== "internal_demo",
      )}
      activity={steps.steps}
      sourceLabel={sourceLabel}
    />
  );
}
