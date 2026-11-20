import { ProvisioningTimeline } from "@/components/web-hosting/provisioning-timeline";
import { WebHostingEmptyState } from "@/components/web-hosting/web-hosting-empty-state";
import { WebHostingHeader } from "@/components/web-hosting/web-hosting-header";
import { WebSourceBanner } from "@/components/web-hosting/source-banner";
import { getProvisioningTimelineData } from "@/lib/web-hosting/web-hosting-data";
import { StaffOnly } from "@/components/dashboard/staff-only";

export const dynamic = "force-dynamic";

async function ProvisioningPageScreen() {
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

// Not self-serve for clients yet: TAKATAK staff see the screen, clients see
// what it is for and ask the team (owner's order, Nov 2026: no prototypes).
export default async function ProvisioningPage() {
  return (
    <StaffOnly
      title="Mise en service · Setup timeline"
      purpose="Où en est la mise en service de chaque hébergement · Where the setup of each hosting service stands."
    >
      <ProvisioningPageScreen />
    </StaffOnly>
  );
}
