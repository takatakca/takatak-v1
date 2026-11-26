import Link from "next/link";
import { redirect } from "next/navigation";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { ModuleHeader } from "@/components/saas/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { listClientServices, SERVICE_STATUS_INFO, SERVICE_TYPE_INFO, type ClientServiceRow } from "@/lib/services/client-services";

export const dynamic = "force-dynamic";

export const metadata = { title: "Services" };

const SERVICES_PURPOSE = "Vos services TAKATAK et leur état, par entreprise · Your TAKATAK services and their status, per business.";

/**
 * A client's own TAKATAK services, read from the workspace's real service
 * records. Platform staff manage every client's services on the admin screen;
 * nobody sees sample records here.
 */
export default async function ServicesPage() {
  const { access } = await getServerAccessContext();
  if (access.mode === "platform_admin") redirect("/dashboard/admin/services");
  if (access.mode === "selection_required") redirect("/dashboard/select-client?next=%2Fdashboard%2Fservices");
  if (access.mode !== "client_scoped" || !hasEffectivePermission(access, "view_dashboard")) {
    return <ModulePlaceholder def={{ title: "Services", purpose: SERVICES_PURPOSE, status: "foundation", functions: [] }} />;
  }

  let services: ClientServiceRow[] | null = null;
  let unavailable = false;
  try {
    services = await listClientServices(access.activeClientId);
  } catch {
    unavailable = true;
    console.error("[services] list unavailable");
  }
  if (!services && !unavailable) {
    return <ModulePlaceholder def={{ title: "Services", purpose: SERVICES_PURPOSE, status: "foundation", functions: [] }} />;
  }

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Vos services · Your services"
        description="Les services TAKATAK de votre espace, avec leur état et leur date de renouvellement · The TAKATAK services in your workspace, with their status and renewal date."
        actions={
          <Link href="/dashboard/support" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300">
            Ajouter un service · Add a service →
          </Link>
        }
      />

      {unavailable ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          La liste des services est injoignable pour le moment ; elle est masquée plutôt qu’incomplète · The service list is not reachable right now.
        </p>
      ) : services && services.length === 0 ? (
        <Card>
          <CardBody className="space-y-2 text-sm text-slate-600">
            <p>Aucun service n’est encore inscrit à votre espace · No service is on your workspace yet.</p>
            <p>
              <Link href="/pricing" className="font-semibold text-indigo-700 hover:underline">
                Voir les forfaits · See the plans
              </Link>{" "}
              ·{" "}
              <Link href="/dashboard/support" className="font-semibold text-indigo-700 hover:underline">
                Écrire à l’équipe · Message the team
              </Link>
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(services ?? []).map((service) => {
            const type = SERVICE_TYPE_INFO[service.serviceType];
            const status = SERVICE_STATUS_INFO[service.status];
            return (
              <Card key={service.id}>
                <CardBody className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{service.name}</p>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    {type.label}
                    {service.brandName ? ` · ${service.brandName}` : ""}
                  </p>
                  {service.renewalDate ? (
                    <p className="text-xs text-slate-500">
                      Renouvellement · Renewal : {service.renewalDate.toLocaleDateString("fr-CA", { dateStyle: "medium", timeZone: "UTC" })}
                    </p>
                  ) : null}
                  <Link href={type.href} className="inline-flex min-h-10 items-center text-xs font-semibold text-indigo-700 hover:underline">
                    Ouvrir · Open →
                  </Link>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
