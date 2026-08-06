import { ClientForm } from "@/components/clients/client-form";
import { ModuleHeader } from "@/components/saas/module-header";
import {
  Card,
  CardBody,
} from "@/components/ui/card";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const access = await requireAdminAccess();

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Create client workspace"
        description="The initial owner must already have an active TAKATAK profile. Workspace isolation begins as soon as this record is created."
      />

      {!access.enforced ? (
        <Card>
          <CardBody>
            <p className="text-sm font-medium text-slate-900">
              Workspace creation unavailable
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Configure Supabase authentication and PostgreSQL before creating real workspaces.
            </p>
          </CardBody>
        </Card>
      ) : (
        <ClientForm
          mode="create"
          initialValues={{
            name: "",
            companyName: "",
            email: "",
            phone: "",
            planName: "",
            timezone: "America/Toronto",
            status: "active",
            ownerEmail: "",
            assignedAdminEmail: "",
          }}
        />
      )}
    </div>
  );
}