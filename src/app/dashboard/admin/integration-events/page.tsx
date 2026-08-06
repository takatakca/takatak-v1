import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { IntegrationEventCard } from "@/components/admin/integration-event-card";
import { getAdminIntegrationEventsData } from "@/lib/admin/admin-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationEventsPage() {
  const access = await requireAdminAccess();
  const data = await getAdminIntegrationEventsData();
  return (
    <div className="space-y-5">
      <AdminHeader title="Integration Events" subtitle="Provider event log. Payloads stay server-side; webhook replay is not active." badges={["View only"]} />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />
      {data.events.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.events.map((e) => <IntegrationEventCard key={e.id} event={e} />)}
        </div>
      ) : (
        <AdminEmptyState
          title="No integration events yet"
          description="Events appear only after a real webhook or credentialed provider test writes one. The seed honestly creates none."
        />
      )}
    </div>
  );
}
