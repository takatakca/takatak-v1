import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Building2,
  MapPin,
  Users,
} from "lucide-react";

import { ClientForm } from "@/components/clients/client-form";
import { ModuleHeader } from "@/components/saas/module-header";
import { StatusBadge } from "@/components/saas/status-badge";
import {
  Card,
  CardBody,
  CardHeader,
} from "@/components/ui/card";
import { getClientDetailData } from "@/lib/clients/client-data";
import type { ClientStatusValue } from "@/lib/clients/client-validation";
import { requireAdminAccess } from "@/lib/security/guard";
import { isUuid } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" />
        </span>

        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {value}
          </p>

          <p className="text-xs text-slate-500">
            {label}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{
    clientId: string;
  }>;
}) {
  const access = await requireAdminAccess();
  const { clientId } = await params;

  if (!isUuid(clientId)) {
    notFound();
  }

  const data = await getClientDetailData(
    access,
    clientId,
  );

  if (data.source === "not_found") {
    notFound();
  }

  if (data.source === "unavailable") {
    return (
      <div className="space-y-5">
        <ModuleHeader
          title="Client workspace"
          description="Workspace details could not be loaded."
        />

        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">
              {data.message}
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { client } = data;

  return (
    <div className="space-y-5">
      <ModuleHeader
        title={client.name}
        description={`Workspace created ${new Intl.DateTimeFormat(
          "en-CA",
          {
            year: "numeric",
            month: "long",
            day: "numeric",
          },
        ).format(new Date(client.createdAt))}.`}
        statuses={[client.status]}
        actions={
          <Link
            href="/dashboard/clients"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Back to workspaces
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Brands"
          value={client.brandCount}
          icon={Building2}
        />

        <StatCard
          label="Locations"
          value={client.locationCount}
          icon={MapPin}
        />

        <StatCard
          label="Members"
          value={client.memberCount}
          icon={Users}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <ClientForm
          mode="edit"
          clientId={client.id}
          initialValues={{
            name: client.name,
            companyName:
              client.companyName ?? "",
            email: client.email ?? "",
            phone: client.phone ?? "",
            planName: client.planName ?? "",
            timezone: client.timezone,
            status:
              client.status as ClientStatusValue,
            ownerEmail: "",
            assignedAdminEmail:
              client.assignedAdminEmail ?? "",
          }}
        />

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Workspace state"
              subtitle="Paused and archived workspaces cannot be selected by members."
            />

            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">
                  Status
                </span>

                <StatusBadge
                  status={client.status}
                />
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">
                  Timezone
                </span>

                <span className="text-right font-medium text-slate-700">
                  {client.timezone}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500">
                  Updated
                </span>

                <span className="text-right font-medium text-slate-700">
                  {new Intl.DateTimeFormat(
                    "en-CA",
                    {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    },
                  ).format(
                    new Date(client.updatedAt),
                  )}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Workspace owners"
              subtitle="Owner membership changes remain in Team administration."
            />

            <CardBody className="space-y-3">
              {client.owners.length === 0 ? (
                <p className="text-sm text-amber-700">
                  No owner membership is assigned.
                </p>
              ) : (
                client.owners.map((owner) => (
                  <div
                    key={owner.id}
                    className="rounded-xl border border-slate-100 p-3"
                  >
                    <p className="text-sm font-medium text-slate-800">
                      {owner.displayName}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-500">
                      {owner.email}
                    </p>

                    <div className="mt-2">
                      <StatusBadge
                        status={owner.status}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}