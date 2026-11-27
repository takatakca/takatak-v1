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
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function serviceColumns(fr: boolean): AdminColumn<AdminServiceSummary>[] {
  return [
  { key: "name", header: "Service", render: (s) => <span className="text-xs font-medium text-slate-800">{s.name}</span> },
  { key: "type", header: "Type", render: (s) => <span className="text-xs text-slate-600">{s.serviceType}</span> },
  { key: "provider", header: fr ? "Fournisseur" : "Provider", render: (s) => <span className="text-xs text-slate-600">{s.provider ?? "—"}</span> },
  { key: "status", header: fr ? "État" : "Status", render: (s) => <Badge tone={adminToneForStatus(s.status)}>{adminFr(s.status, fr)}</Badge> },
  { key: "client", header: fr ? "Client / Marque" : "Client / Brand", render: (s) => <span className="text-xs text-slate-600">{s.clientName}{s.brandName ? ` · ${s.brandName}` : ""}</span> },
  { key: "price", header: fr ? "Prix" : "Price", render: (s) => <span className="text-xs text-slate-600">{s.priceCents != null ? `${(s.priceCents / 100).toFixed(2)} ${s.currency}` : fr ? "Non réglé" : "Not set"}</span> },
  { key: "renewal", header: fr ? "Renouvellement" : "Renewal", render: (s) => <span className="text-xs text-slate-400">{s.renewalDate ?? "—"}</span> },
  ];
}

export default async function AdminServicesPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const [data, rentautoRows] = await Promise.all([
    getAdminServicesData(),
    getAdminRentautoProvisioningData(access.enforced),
  ]);
  return (
    <div className="space-y-5">
      <AdminHeader
        title="Services"
        subtitle={
          fr
            ? "Activez des services facultatifs pour les espaces clients et consultez tous les services activés."
            : "Provision optional services for client workspaces and inspect all service instances."
        }
        badges={[access.enforced ? (fr ? "Contrôles d’activation" : "Provisioning controls") : fr ? "Aperçu fondation" : "Foundation preview"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />
      <AdminRentautoProvisioning
        rows={rentautoRows}
        enabled={access.enforced}
      />
      <AdminTable
        columns={serviceColumns(fr)}
        rows={data.services}
        rowKey={(s) => s.id}
        caption={fr ? "Services activés" : "Service instances"}
      />
    </div>
  );
}
