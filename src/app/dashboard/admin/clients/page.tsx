import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { AdminTable, type AdminColumn } from "@/components/admin/admin-table";
import { Badge } from "@/components/ui/badge";
import { adminToneForStatus } from "@/lib/admin/status";
import { getAdminClientsData } from "@/lib/admin/admin-data";
import type { AdminClientSummary } from "@/lib/admin/types";
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function clientColumns(fr: boolean): AdminColumn<AdminClientSummary>[] {
  return [
  { key: "name", header: "Client", render: (c) => <span className="text-xs font-medium text-slate-800">{c.name}</span> },
  { key: "status", header: fr ? "État" : "Status", render: (c) => <Badge tone={adminToneForStatus(c.status)}>{adminFr(c.status, fr)}</Badge> },
  { key: "brands", header: fr ? "Marques" : "Brands", render: (c) => <span className="text-xs text-slate-600">{c.brandCount}</span> },
  { key: "services", header: "Services", render: (c) => <span className="text-xs text-slate-600">{c.serviceCount}</span> },
  { key: "members", header: fr ? "Membres" : "Members", render: (c) => <span className="text-xs text-slate-600">{c.memberCount}</span> },
  { key: "created", header: fr ? "Créé le" : "Created", render: (c) => <span className="text-xs text-slate-400">{c.createdAt}</span> },
  ];
}

export default async function AdminClientsPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const data = await getAdminClientsData();
  return (
    <div className="space-y-5">
      <AdminHeader
        title="Clients"
        subtitle={
          fr
            ? "Tous les comptes clients. Modifier, désactiver et changer de forfait ne sont pas encore actifs."
            : "All client accounts. Edit, disable, and plan changes are not active in Phase 13."
        }
        badges={[fr ? "Lecture seule" : "View only"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />
      <AdminTable
        columns={clientColumns(fr)}
        rows={data.clients}
        rowKey={(c) => c.id}
        caption={fr ? "Comptes clients (lecture seule)" : "Client accounts (view only)"}
      />
    </div>
  );
}
