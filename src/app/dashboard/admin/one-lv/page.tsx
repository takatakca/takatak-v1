import {
  Activity,
  BadgeCheck,
  Building2,
  CircleAlert,
  ShoppingBag,
  Smartphone,
  Users,
} from "lucide-react";

import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getOneLvMasterAdminData } from "@/lib/admin/one-lv-master-data";
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function when(value: string | null, fr: boolean): string {
  if (!value) return fr ? "Aucune synchronisation pour l’instant" : "No synchronization yet";
  return new Intl.DateTimeFormat(fr ? "fr-CA" : "en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

export default async function OneLvAdminPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const data = await getOneLvMasterAdminData();

  const kpis = [
    { label: fr ? "Clients 1LV" : "1LV customers", value: data.customers, icon: Users },
    { label: fr ? "Identités invitées" : "Guest identities", value: data.guests, icon: Users },
    { label: fr ? "Courriel vérifié" : "Verified email", value: data.verifiedEmail, icon: BadgeCheck },
    { label: fr ? "Téléphone vérifié" : "Verified phone", value: data.verifiedPhone, icon: Smartphone },
    { label: fr ? "Marchands maîtres" : "Master merchants", value: data.masterMerchants, icon: Building2 },
    { label: fr ? "Boutiques 1LV" : "1LV stores", value: data.sourceMerchants, icon: ShoppingBag },
    { label: fr ? "Événements traités" : "Processed events", value: data.processedEvents, icon: Activity },
    { label: fr ? "Événements en échec" : "Failed events", value: data.failedEvents, icon: CircleAlert },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title={fr ? "Poste de contrôle maître 1LV" : "1LV Master Control Plane"}
        subtitle={
          fr
            ? "Vue TAKATAK en lecture seule des projections 1LV : identité, marchands et synchronisation. 1LV reste l’autorité des transactions du marché."
            : "Read-only TAKATAK view of 1LV identity, merchant and synchronization projections. 1LV remains transaction authority for marketplace commerce."
        }
        badges={
          fr
            ? ["Identité maîtresse TAKATAK", "1LV indépendant dans ses opérations", "Lecture seule", "Aucun secret de paiement"]
            : ["TAKATAK master identity", "1LV operationally independent", "Read only", "No payment secrets"]
        }
      />

      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner
        source={data.available ? "database" : "unavailable"}
        label={data.sourceLabel}
      />

      <section aria-label={fr ? "Chiffres maîtres 1LV" : "1LV master metrics"}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((item) => (
            <AdminKpiCard
              key={item.label}
              label={item.label}
              value={item.value}
              icon={item.icon}
            />
          ))}
        </div>
      </section>

      <Card>
        <CardHeader
          title={fr ? "Santé de la synchronisation" : "Synchronization health"}
          subtitle={fr ? "Projection maîtresse 1LV → TAKATAK, de serveur à serveur." : "Server-to-server 1LV → TAKATAK master projection."}
        />
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="text-sm text-slate-700">
              {fr ? "Dernière activité :" : "Last activity:"} {when(data.lastSynchronizedAt, fr)}
            </span>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            {fr
              ? "TAKATAK garde seulement des projections normalisées des identités et des marchands. Les mots de passe, codes à usage unique, jetons de session, données de carte et secrets des fournisseurs sont refusés par le contrat de l’API maîtresse."
              : "TAKATAK stores normalized identity and merchant projections only. Passwords, OTP codes, session tokens, card data and provider secrets are rejected by the master API contract."}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={fr ? "Marchands 1LV récents" : "Recent 1LV merchants"}
          subtitle={fr ? "État d’exploitation seulement. Les identifiants financiers restent dans 1LV." : "Operational status only. Financial credentials remain in 1LV."}
        />
        <CardBody>
          {data.recentMerchants.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentMerchants.map((merchant) => (
                <div
                  key={merchant.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {merchant.storeName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {fr ? "Dernière synchronisation :" : "Last sync"} {when(merchant.lastSynchronizedAt, fr)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {merchant.marketplaceStatus ? (
                      <Badge>{adminFr(merchant.marketplaceStatus, fr)}</Badge>
                    ) : null}
                    {merchant.subscriptionStatus ? (
                      <Badge>{adminFr(merchant.subscriptionStatus, fr)}</Badge>
                    ) : null}
                    {merchant.subscriptionPlan ? (
                      <Badge>{merchant.subscriptionPlan}</Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {fr ? "Aucune projection de marchand 1LV reçue pour l’instant." : "No 1LV merchant projections have been received yet."}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={fr ? "Événements récents de synchronisation 1LV" : "Recent 1LV synchronization events"}
          subtitle={fr ? "Métadonnées seulement : les contenus bruts des événements ne sont pas affichés, exprès." : "Metadata only — raw event payloads are intentionally not rendered."}
        />
        <CardBody>
          {data.recentEvents.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {event.eventType}
                    </p>
                    <p className="text-xs text-slate-500">
                      {when(event.processedAt ?? event.createdAt, fr)}
                    </p>
                  </div>
                  <Badge
                    tone={
                      event.status === "PROCESSED"
                        ? "success"
                        : event.status === "FAILED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {adminFr(event.status, fr)}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              {fr ? "Aucun événement de synchronisation 1LV reçu pour l’instant." : "No 1LV synchronization events have been received yet."}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
