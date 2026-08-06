import { HostingServiceCard } from "@/components/web-hosting/hosting-service-card";
import { WebHostingEmptyState } from "@/components/web-hosting/web-hosting-empty-state";
import { WebHostingHeader } from "@/components/web-hosting/web-hosting-header";
import { WebSourceBanner } from "@/components/web-hosting/source-banner";
import { getHostingServicesData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function HostingPage() {
  const data = await getHostingServicesData();
  return (
    <div className="space-y-5">
      <WebHostingHeader
        title="Hosting"
        subtitle="Hosting services tracked per brand with plan, server, and renewal status."
        badges={[{ label: "Foundation" }, { label: "Upmind not connected", status: "not_configured" }]}
      />
      <WebSourceBanner source={data.source} label={data.sourceLabel} />
      {data.hostingServices.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.hostingServices.map((h) => <HostingServiceCard key={h.id} service={h} />)}
        </div>
      ) : (
        <WebHostingEmptyState title="No hosting services yet" description="Hosting services appear here." />
      )}
      <p className="text-xs text-slate-400">Hosting provisioning will be powered by Upmind after real API configuration.</p>
    </div>
  );
}
