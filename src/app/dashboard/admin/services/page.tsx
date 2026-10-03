import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { AdminRentautoProvisioning } from "@/components/admin/admin-rentauto-provisioning";
import { AdminTable, type AdminColumn } from "@/components/admin/admin-table";
import { Badge } from "@/components/ui/badge";
import { adminToneForStatus } from "@/lib/admin/status";
import { getAdminServicesData } from "@/lib/admin/admin-data";
import { getAdminRentautoProvisioningData } from "@/lib/admin/rentauto-service-admin";
import type { AdminServiceSummary } from "@/lib/admin/types";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const columns: AdminColumn<AdminServiceSummary>[] = [
  { key: "name", header: "Service", render: (s) => <span className="text-xs font-medium text-slate-800">{s.name}</span> },
  { key: "type", header: "Type", render: (s) => <span className="text-xs text-slate-600">{s.serviceType}</span> },
  { key: "provider", header: "Provider", render: (s) => <span className="text-xs text-slate-600">{s.provider ?? "—"}</span> },
  { key: "status", header: "Status", render: (s) => <Badge tone={adminToneForStatus(s.status)}>{s.status}</Badge> },
  { key: "client", header: "Client / Brand", render: (s) => <span className="text-xs text-slate-600">{s.clientName}{s.brandName ? ` · ${s.brandName}` : ""}</span> },
  { key: "price", header: "Price", render: (s) => <span className="text-xs text-slate-600">{s.priceCents != null ? `${(s.priceCents / 100).toFixed(2)} ${s.currency}` : "Not set"}</span> },
  { key: "renewal", header: "Renewal", render: (s) => <span className="text-xs text-slate-400">{s.renewalDate ?? "—"}</span> },
];

export default async function AdminServicesPage() {
  const access = await requireAdminAccess();
  const [data, rentautoRows] = await Promise.all([
    getAdminServicesData(),
    getAdminRentautoProvisioningData(access.enforced),
  ]);
  return (
    <div className="space-y-5">
      <AdminHeader
        title="Services"
        subtitle="Provision optional services for client workspaces and inspect all service instances."
        badges={[access.enforced ? "Provisioning controls" : "Foundation preview"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />
      <AdminRentautoProvisioning
        rows={rentautoRows}
        enabled={access.enforced}
      />
      <AdminTable columns={columns} rows={data.services} rowKey={(s) => s.id} caption="Service instances" />
    </div>
  );
}
