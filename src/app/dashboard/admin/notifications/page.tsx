import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { NOTIFICATION_STATUS_LABELS, adminToneForStatus } from "@/lib/admin/status";
import { getAdminNotificationsData } from "@/lib/admin/admin-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function AdminNotificationsPage() {
  const access = await requireAdminAccess();
  const data = await getAdminNotificationsData();
  return (
    <div className="space-y-5">
      <AdminHeader title="Notifications" subtitle="System notifications overview. Sending and broadcast tools are not active in Phase 13." badges={["View only"]} />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />
      <div className="grid gap-3 sm:grid-cols-2">
        {data.notifications.map((n) => (
          <Card key={n.id}>
            <CardBody className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{n.title}</h3>
                <Badge tone={adminToneForStatus(n.status)}>{NOTIFICATION_STATUS_LABELS[n.status] ?? n.status}</Badge>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">{n.message}</p>
              <p className="text-[11px] text-slate-400">{n.type}{n.clientName ? ` · ${n.clientName}` : " · System-wide"} · {n.createdAt}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
