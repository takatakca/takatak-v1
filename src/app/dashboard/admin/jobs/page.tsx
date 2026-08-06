import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminBoundaryWarning } from "@/components/admin/admin-boundary-warning";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { JobStatusCard } from "@/components/admin/job-status-card";
import { getAdminJobsData } from "@/lib/admin/admin-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function AdminJobsPage() {
  const access = await requireAdminAccess();
  const data = await getAdminJobsData();
  return (
    <div className="space-y-5">
      <AdminHeader title="Jobs Monitor" subtitle="All jobs with logs. Every job is planned — no worker exists, so nothing has ever run, and retry stays disabled." badges={["View only", "Worker not active"]} />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />
      <div className="grid gap-3 sm:grid-cols-2">
        {data.jobs.map((j) => <JobStatusCard key={j.id} job={j} />)}
      </div>
      <AdminBoundaryWarning />
    </div>
  );
}
