import { Building2, Plus } from "lucide-react";

import { ClientList } from "@/components/clients/client-list";
import { EmptyState } from "@/components/saas/empty-state";
import { ModuleHeader } from "@/components/saas/module-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
} from "@/components/ui/card";
import { getClientDirectoryData } from "@/lib/clients/client-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const access = await requireAdminAccess();

  const data =
    await getClientDirectoryData(access);

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Client workspaces"
        description="Create and manage real tenant workspaces, ownership, plans, status, and platform-admin assignment."
        actions={
          access.enforced ? (
            <Button href="/dashboard/clients/new">
              <Plus className="h-4 w-4" />
              Add workspace
            </Button>
          ) : null
        }
      />

      {data.source === "unavailable" ? (
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-slate-900">
              Workspace management unavailable
            </p>

            <p className="mt-1 text-sm text-slate-500">
              {data.message}
            </p>
          </CardBody>
        </Card>
      ) : data.clients.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No client workspaces yet"
          description="Create the first workspace and assign an existing active profile as its owner."
        />
      ) : (
        <ClientList clients={data.clients} />
      )}
    </div>
  );
}

// import { UserPlus } from "lucide-react";
// import { DataTable, type Column } from "@/components/saas/data-table";
// import { DisabledActionButton } from "@/components/saas/disabled-action-button";
// import { FoundationNotice } from "@/components/saas/foundation-notice";
// import { ModuleHeader } from "@/components/saas/module-header";
// import { StatusBadge } from "@/components/saas/status-badge";
// import { CLIENTS, brandsForClient } from "@/lib/data/mock-data";
// import type { Client } from "@/lib/data/types";

// const columns: Column<Client>[] = [
//   {
//     key: "client",
//     header: "Client",
//     render: (c) => (
//       <div>
//         <p className="font-medium text-slate-800">{c.company}</p>
//         <p className="text-xs text-slate-400">{c.name} · {c.email}</p>
//       </div>
//     ),
//   },
//   { key: "plan", header: "Plan", render: (c) => <StatusBadge status={c.plan} /> },
//   { key: "brands", header: "Brands", render: (c) => `${brandsForClient(c.id).length}` },
//   { key: "admin", header: "Assigned admin", render: (c) => <span className="text-xs text-slate-500">{c.assignedAdmin}</span> },
//   { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
//   { key: "created", header: "Created", render: (c) => <span className="text-xs text-slate-500">{c.createdAt}</span> },
// ];

// // Clients module — manages all client accounts (profiles, plans, services).
// export default function ClientsPage() {
//   return (
//     <div className="space-y-5">
//       <ModuleHeader
//         title="Clients"
//         description="Manage all client accounts: profiles, plans, assigned admins, businesses, and services."
//         statuses={["foundation", "mock_data"]}
//         actions={<DisabledActionButton label="Add Client" reason="Needs auth + DB" icon={UserPlus} />}
//       />
//       <FoundationNotice
//         mock="The 3 clients below are typed mock records defined in src/lib/data/mock-data.ts."
//         future="Real client records with create/edit/disable, search, and filters arrive with Supabase Auth (Phase 3) and the Prisma database (Phase 4)."
//         notConnected="Database, auth, and billing providers."
//       />
//       <DataTable columns={columns} rows={CLIENTS} rowKey={(c) => c.id} caption="Mock foundation clients" />
//     </div>
//   );
// }
