import { WebIntegrationOverview } from "@/components/web-hosting/web-integration-overview";
import { getSslCertificatesData, getWebHostingOverviewData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function WebHostingOverviewPage() {
  const [data, ssl] = await Promise.all([getWebHostingOverviewData(), getSslCertificatesData()]);
  return <WebIntegrationOverview data={data} certificates={ssl.certificates} />;
}
