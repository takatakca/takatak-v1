import { HostingAccountsOverview } from "@/components/web-hosting/hosting-accounts-overview";
import { getDomainAssetsData, getHostingServicesData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function HostingAccountsPage() {
  const [hosting, domains] = await Promise.all([getHostingServicesData(), getDomainAssetsData()]);

  return (
    <HostingAccountsOverview
      services={hosting.hostingServices}
      domains={domains.domains}
      sourceLabel={hosting.sourceLabel}
    />
  );
}
