import { HostingEnvironmentView } from "@/components/web-hosting/hosting-environment-view";
import { HostingEnvironmentsView } from "@/components/web-hosting/hosting-environments-view";
import { getHostingServicesData, getSslCertificatesData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function HostingEnvironmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ env?: string }>;
}) {
  const params = await searchParams;
  const [hosting, ssl] = await Promise.all([getHostingServicesData(), getSslCertificatesData()]);
  const services = hosting.hostingServices;

  if (params.env) {
    const selected = services.find((service) => service.id === params.env);
    if (selected) {
      const certificate =
        ssl.certificates.find((item) => item.domainName === selected.primaryDomain) ?? null;
      return (
        <HostingEnvironmentView
          service={selected}
          certificate={certificate}
          sourceLabel={hosting.sourceLabel}
        />
      );
    }
  }

  return (
    <HostingEnvironmentsView
      services={services}
      certificates={ssl.certificates}
      sourceLabel={hosting.sourceLabel}
    />
  );
}
