import { DomainCard } from "@/components/web-hosting/domain-card";
import { WebHostingEmptyState } from "@/components/web-hosting/web-hosting-empty-state";
import { WebHostingHeader } from "@/components/web-hosting/web-hosting-header";
import { WebSourceBanner } from "@/components/web-hosting/source-banner";
import { getDomainAssetsData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function DomainsPage() {
  const data = await getDomainAssetsData();
  return (
    <div className="space-y-5">
      <WebHostingHeader
        title="Domains"
        subtitle="Domain portfolio with DNS and SSL readiness per brand."
        badges={[{ label: "Foundation" }, { label: "Upmind not connected", status: "not_configured" }]}
      />
      <WebSourceBanner source={data.source} label={data.sourceLabel} />
      {data.domains.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.domains.map((d) => <DomainCard key={d.id} domain={d} />)}
        </div>
      ) : (
        <WebHostingEmptyState title="No domains yet" description="Tracked domains appear here." />
      )}
      <p className="text-xs text-slate-400">Domain search and registration will be powered by Upmind in Phase 8.</p>
    </div>
  );
}
