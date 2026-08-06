import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminBoundaryWarning } from "@/components/admin/admin-boundary-warning";
import { AdminHeader } from "@/components/admin/admin-header";
import { SystemHealthPanel } from "@/components/admin/system-health-panel";
import { getAdminSystemHealthData } from "@/lib/admin/admin-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function AdminSystemHealthPage() {
  const access = await requireAdminAccess();
  const health = getAdminSystemHealthData();
  return (
    <div className="space-y-5">
      <AdminHeader title="System Health" subtitle="Configuration and capability status from env presence only — this page performs no live provider calls." badges={["View only", "No live tests"]} />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <SystemHealthPanel title="Application" items={health.app} />
      <SystemHealthPanel
        title="Providers"
        subtitle="Env presence only. No provider shows Connected until a real credentialed test succeeds — run live tests on the provider pages under Integrations."
        items={health.providers}
      />
      <SystemHealthPanel title="Capability boundaries" subtitle="Foundation flags — matches /api/health." items={health.foundations} />
      <AdminBoundaryWarning />
    </div>
  );
}
