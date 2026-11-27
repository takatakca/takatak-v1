import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { IntegrationEventCard } from "@/components/admin/integration-event-card";
import { getAdminIntegrationEventsData } from "@/lib/admin/admin-data";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

export default async function AdminIntegrationEventsPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const data = await getAdminIntegrationEventsData();
  return (
    <div className="space-y-5">
      <AdminHeader
        title={fr ? "Événements d’intégration" : "Integration Events"}
        subtitle={
          fr
            ? "Journal des événements des fournisseurs. Les contenus restent sur le serveur ; rejouer un webhook n’est pas actif."
            : "Provider event log. Payloads stay server-side; webhook replay is not active."
        }
        badges={[fr ? "Lecture seule" : "View only"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />
      {data.events.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.events.map((e) => <IntegrationEventCard key={e.id} event={e} />)}
        </div>
      ) : (
        <AdminEmptyState
          title={fr ? "Aucun événement d’intégration pour l’instant" : "No integration events yet"}
          description={
            fr
              ? "Un événement apparaît seulement quand un vrai webhook ou un test de fournisseur avec identifiants en écrit un. Les données de départ n’en créent aucun."
              : "Events appear only after a real webhook or credentialed provider test writes one. The seed honestly creates none."
          }
        />
      )}
    </div>
  );
}
