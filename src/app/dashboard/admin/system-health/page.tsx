import Link from "next/link";

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
      <AdminHeader title="System Health" subtitle="Application, database and provider settings, read from the server. For the full live picture and what to do next, use the go-live checklist." />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <Link
        href="/dashboard/admin/go-live"
        className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900 hover:border-blue-300"
      >
        <span>Mise en service · Go-live checklist: every item measured live, with one percentage and exactly what closes each one.</span>
        <span aria-hidden>→</span>
      </Link>
      <SystemHealthPanel title="Application" items={health.app} />
      <SystemHealthPanel
        title="Providers"
        subtitle="Env presence only. No provider shows Connected until a real credentialed test succeeds — run live tests on the provider pages under Integrations."
        items={health.providers}
      />
      <AdminBoundaryWarning />
    </div>
  );
}
