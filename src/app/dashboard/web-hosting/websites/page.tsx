import { WebsitesManager } from "@/components/web-hosting/websites-manager";
import { getDomainAssetsData, getHostingServicesData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function WebsitesPage() {
  const [domains, hosting] = await Promise.all([getDomainAssetsData(), getHostingServicesData()]);

  return (
    <WebsitesManager
      domains={domains.domains}
      hosting={hosting.hostingServices}
      sourceLabel={domains.sourceLabel}
    />
  );
}
