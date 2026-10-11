import { MapPinned } from "lucide-react";

import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { QmapsLinkForm } from "@/app/dashboard/admin/qmaps/link-form";
import { getPrisma } from "@/lib/db/prisma";
import { readLinkState, readQmapsBusinessId } from "@/lib/qmaps/bridge";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function QmapsAdminPage() {
  const access = await requireAdminAccess();
  const prisma = getPrisma();
  const clients = prisma
    ? await prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 })
    : [];
  const listings = prisma
    ? await prisma.localListing.findMany({
        where: { provider: "qmaps" },
        include: { client: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 100,
      })
    : [];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="QMAPS"
        subtitle="Lie chaque fiche QMAPS à un espace client TAKATAK. Le lien n'est confirmé que lorsque QMAPS accepte l'écriture."
        badges={["Admin", "Pas de synchronisation inventée"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />

      <Card>
        <CardHeader
          title="Nouveau lien"
          subtitle="TAKATAK garde le lien dans la fiche locale. QMAPS est mis à jour seulement si QMAPS_FUNCTIONS_BASE_URL et QMAPS_INTEGRATION_SECRET sont définis."
        />
        <CardBody>
          {prisma ? (
            <QmapsLinkForm clients={clients} />
          ) : (
            <p className="text-sm text-slate-500">La base TAKATAK n'est pas configurée. Aucun lien ne peut être enregistré.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Liens enregistrés" subtitle="Confirmé sur QMAPS, ou enregistré dans TAKATAK seulement." />
        <CardBody className="space-y-3">
          {listings.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune fiche QMAPS liée.</p>
          ) : (
            listings.map((listing) => {
              const businessId = readQmapsBusinessId(listing.metadata);
              const state = readLinkState(listing.metadata);
              const confirmed = state === "confirmed_on_qmaps";
              return (
                <div key={listing.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{listing.name}</p>
                    <p className="text-xs text-slate-500">
                      {listing.client.name}
                      {listing.city ? ` · ${listing.city}` : ""}
                      {businessId ? ` · ${businessId}` : ""}
                    </p>
                  </div>
                  <Badge tone={confirmed ? "success" : "warning"}>
                    {confirmed ? "Confirmé sur QMAPS" : "Enregistré dans TAKATAK seulement"}
                  </Badge>
                </div>
              );
            })
          )}
          <p className="flex items-center gap-2 text-xs text-slate-400">
            <MapPinned className="h-3.5 w-3.5" />
            Une fiche planifiée n'est pas une fiche publiée.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
