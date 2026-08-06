import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { AuditLogCard } from "@/components/admin/audit-log-card";
import { getAdminAuditLogsData } from "@/lib/admin/admin-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogsPage() {
  const access = await requireAdminAccess();
  const data = await getAdminAuditLogsData();
  return (
    <div className="space-y-5">
      <AdminHeader title="Audit Logs" subtitle="System-internal audit trail. Only safe note text renders — raw metadata, IP addresses, and user agents are never displayed." badges={["View only"]} />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />
      <div className="grid gap-3 sm:grid-cols-2">
        {data.entries.map((a) => <AuditLogCard key={a.id} entry={a} />)}
      </div>
    </div>
  );
}
