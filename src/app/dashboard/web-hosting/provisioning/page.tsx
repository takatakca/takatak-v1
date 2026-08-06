import { ProvisioningTimeline } from "@/components/web-hosting/provisioning-timeline";
import { WebHostingEmptyState } from "@/components/web-hosting/web-hosting-empty-state";
import { WebHostingHeader } from "@/components/web-hosting/web-hosting-header";
import { WebSourceBanner } from "@/components/web-hosting/source-banner";
import { getProvisioningTimelineData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

export default async function ProvisioningPage() {
  const data = await getProvisioningTimelineData();
  return (
    <div className="space-y-5">
      <WebHostingHeader
        title="Provisioning"
        subtitle="Setup timelines per hosting service. Statuses marked internal are foundation tracking only — no workers run, and no retry actions exist yet."
        badges={[{ label: "Foundation" }]}
      />
      <WebSourceBanner source={data.source} label={data.sourceLabel} />
      {data.steps.length ? (
        <ProvisioningTimeline steps={data.steps} />
      ) : (
        <WebHostingEmptyState title="No provisioning steps yet" description="Setup timelines appear here." />
      )}
    </div>
  );
}
