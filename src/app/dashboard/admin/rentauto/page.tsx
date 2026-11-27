import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  CarFront,
  ClipboardCheck,
  LifeBuoy,
  Route,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react";

import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { RentautoDriverVerificationsCard } from "@/components/rentauto/rentauto-driver-verifications-card";
import { RentautoHostApplicationsCard } from "@/components/rentauto/rentauto-host-applications-card";
import { RentautoHostVerificationsCard } from "@/components/rentauto/rentauto-host-verifications-card";
import { RentautoVehicleReviewsCard } from "@/components/rentauto/rentauto-vehicle-reviews-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getRentautoAdminData } from "@/lib/rentauto/rentauto-admin-data";
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function money(minor: number, currency: string, fr: boolean): string {
  return new Intl.NumberFormat(fr ? "fr-CA" : "en-CA", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

function when(value: string | null, fr: boolean): string {
  if (!value) return fr ? "Aucune synchronisation pour l’instant" : "No synchronization yet";
  return new Intl.DateTimeFormat(fr ? "fr-CA" : "en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

export default async function RentautoAdminPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const data = await getRentautoAdminData();

  const kpis = [
    { label: fr ? "Comptes Rentauto" : "Rentauto accounts", value: data.customers, icon: Users },
    { label: fr ? "Hôtes" : "Hosts", value: data.operations.hosts, icon: ShieldCheck },
    { label: fr ? "Véhicules" : "Vehicles", value: data.operations.vehicles, icon: CarFront },
    { label: fr ? "Trajets en cours" : "Active trips", value: data.operations.activeTrips, icon: Route },
    { label: fr ? "Demandes d’hôtes" : "Host applications", value: data.operations.pendingHostApplications, icon: ClipboardCheck },
    { label: fr ? "Véhicules à vérifier" : "Vehicle reviews", value: data.operations.pendingVehicleReviews, icon: BadgeCheck },
    { label: fr ? "Conducteurs à vérifier" : "Driver reviews", value: data.operations.pendingDriverVerifications, icon: BadgeCheck },
    { label: fr ? "Demandes de réservation" : "Booking requests", value: data.operations.pendingBookingRequests, icon: ClipboardCheck },
    { label: fr ? "Approuvées / non payées" : "Approved / unpaid", value: data.operations.approvedAwaitingPayment, icon: Route },
    { label: fr ? "Soutien ouvert" : "Open support", value: data.operations.openSupportTickets, icon: LifeBuoy },
    { label: fr ? "Incidents ouverts" : "Open incidents", value: data.operations.openIncidents, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Rentauto"
        subtitle={
          fr
            ? "Le poste de contrôle TAKATAK des opérations en direct du marché Rentauto : identité, flotte, trajets, vérification, soutien et résumés financiers."
            : "TAKATAK control plane for live Rentauto marketplace operations, identity, fleet, trips, verification, support and financial summaries."
        }
        badges={
          fr
            ? ["Secteur TAKATAK", "Opérations en direct", "Identité partagée", "Aucun GPS ni document privé"]
            : ["TAKATAK vertical", "Live operations", "Shared identity", "No private GPS/documents"]
        }
      />

      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner
        source={data.available ? "database" : "unavailable"}
        label={data.sourceLabel}
      />

      <section aria-label={fr ? "Chiffres clés Rentauto" : "Rentauto key metrics"}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={fr ? "Finances du marché" : "Marketplace financials"}
            subtitle={
              fr
                ? "Valeur des réservations en direct et projection normalisée des paiements TAKATAK. Stripe et Rentauto restent l’autorité des transactions."
                : "Live booking value plus the normalized TAKATAK payment projection. Stripe and Rentauto remain transaction authority."
            }
          />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">{fr ? "Valeur brute des réservations en direct" : "Live gross booking value"}</span>
              <strong className="text-slate-900">
                {money(data.operations.grossBookingValueMinor, data.currency, fr)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">{fr ? "Montant payé projeté" : "Projected paid amount"}</span>
              <strong className="text-slate-900">
                {money(data.paidAmountMinor, data.currency, fr)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">{fr ? "Remboursements inscrits" : "Recorded refunds"}</span>
              <strong className="text-slate-900">
                {money(data.refundedAmountMinor, data.currency, fr)}
              </strong>
            </div>
            <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
              {fr
                ? "TAKATAK garde une projection normalisée pour le tableau de bord, le CRM et les rapports. Elle ne remplace pas l’autorité de Rentauto sur les trajets et les paiements."
                : "TAKATAK stores a normalized projection for dashboard, CRM and reporting. It does not replace Rentauto trip/payment authority."}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={fr ? "Santé de la synchronisation" : "Synchronization health"}
            subtitle={fr ? "Réception des événements Rentauto → TAKATAK, de serveur à serveur." : "Server-to-server Rentauto → TAKATAK event ingestion."}
          />
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-800">
                {fr ? "Contrat d’événements idempotent à la source" : "Idempotent source event contract"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="text-sm text-slate-600">
                {fr ? "Dernière activité :" : "Last activity:"} {when(data.lastSynchronizedAt, fr)}
              </span>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              {fr
                ? "Les mots de passe, codes à usage unique, sessions, documents privés et l’historique GPS exact sont exclus exprès de la projection maîtresse."
                : "Passwords, OTPs, sessions, private documents and exact GPS history are intentionally excluded from the master projection."}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title={fr ? "Règlements Rentauto" : "Rentauto settlements"}
          subtitle={
            fr
              ? "Vue de contrôle financier en lecture seule. L’autorité des virements Stripe reste dans Rentauto."
              : "Read-only financial control view. Stripe transfer authority stays inside Rentauto."
          }
          action={
            <a
              href="https://rentauto.ca/admin/payouts"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
            >
              {fr ? "Ouvrir les versements" : "Open payout authority"}
              <WalletCards className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          }
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {fr ? "Politique de versement" : "Payout policy"}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {data.settlements.policyConfigured
                  ? data.settlements.payoutsEnabled
                    ? fr ? "Configurée · versements activés" : "Configured · release enabled"
                    : fr ? "Configurée · versements désactivés" : "Configured · release disabled"
                  : fr ? "Non configurée" : "Not configured"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.settlements.platformFeeBps === null
                  ? fr ? "Aucuns frais de plateforme configurés" : "No platform fee configured"
                  : fr
                    ? `Frais ${(data.settlements.platformFeeBps / 100).toFixed(2).replace(".", ",")} %`
                    : `Fee ${(data.settlements.platformFeeBps / 100).toFixed(2)}%`}
                {data.settlements.disputeWindowHours === null
                  ? ""
                  : fr
                    ? ` · ${data.settlements.disputeWindowHours} h pour contester`
                    : ` · ${data.settlements.disputeWindowHours}h dispute window`}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {fr ? "Gains des hôtes admissibles" : "Eligible host earnings"}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {money(data.settlements.eligibleAmountMinor, data.currency, fr)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.settlements.eligibleCount} {fr ? "règlement" : "settlement"}{data.settlements.eligibleCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {fr ? "Retenus / bloqués" : "Held / blocked"}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {money(data.settlements.heldAmountMinor, data.currency, fr)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.settlements.heldCount} {fr ? "retenus" : "held"} · {data.settlements.blockedCount} {fr ? "bloqués" : "blocked"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {fr ? "Net viré" : "Net transferred"}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-950">
                {money(data.settlements.transferredNetMinor, data.currency, fr)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {fr
                  ? `${data.settlements.transferredCount} virement${data.settlements.transferredCount === 1 ? "" : "s"} · ${data.settlements.reversalRequiredCount} annulation(s) à revoir`
                  : `${data.settlements.transferredCount} transfer${data.settlements.transferredCount === 1 ? "" : "s"} · ${data.settlements.reversalRequiredCount} reversal required`}
              </p>
            </div>
          </div>

          {data.settlements.reversalRequiredCount > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {fr
                ? `${data.settlements.reversalRequiredCount} règlement(s) viré(s) demandent une révision d’annulation dans Rentauto avant que le dossier financier soit en règle.`
                : `${data.settlements.reversalRequiredCount} transferred settlement${data.settlements.reversalRequiredCount === 1 ? "" : "s"} require a Rentauto reversal review before the financial record is clear.`}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={fr ? "Projection des données maîtresses TAKATAK" : "TAKATAK master-data projection"}
          subtitle={
            fr
              ? "Vue identité, CRM et rapports commune aux produits. Les données d’exploitation Rentauto ci-dessus restent la source en direct."
              : "Cross-product identity, CRM and reporting view. Operational Rentauto data above remains the live source."
          }
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{fr ? "Clients projetés" : "Projected customers"}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{data.projectedCustomers}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{fr ? "Courriel vérifié" : "Verified email"}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{data.verifiedEmailProfiles}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{fr ? "Téléphone vérifié" : "Verified phone"}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{data.verifiedPhoneProfiles}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{fr ? "Résumés de paiement" : "Payment summaries"}</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{data.paymentSummaries}</p>
            </div>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
            {fr
              ? `${data.operations.approvedHostApplications} demande(s) d’hôte approuvée(s) · ${data.operations.activeVehicles} véhicule(s) actif(s) · ${data.operations.completedTrips} trajet(s) terminé(s).`
              : `${data.operations.approvedHostApplications} approved host application${data.operations.approvedHostApplications === 1 ? "" : "s"} · ${data.operations.activeVehicles} active vehicle${data.operations.activeVehicles === 1 ? "" : "s"} · ${data.operations.completedTrips} completed trip${data.operations.completedTrips === 1 ? "" : "s"}.`}
          </p>
        </CardBody>
      </Card>

      <RentautoDriverVerificationsCard />
      <RentautoHostApplicationsCard />
      <RentautoHostVerificationsCard />
      <RentautoVehicleReviewsCard />

      <Card>
        <CardHeader
          title={fr ? "Événements récents de synchronisation Rentauto" : "Recent Rentauto synchronization events"}
          subtitle={
            fr
              ? "Métadonnées des événements seulement : les contenus et les données sensibles de la source ne sont pas affichés."
              : "Event metadata only — payloads and sensitive source data are not displayed."
          }
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
                      {when(event.createdAt, fr)}
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
              {fr ? "Aucun événement de synchronisation Rentauto reçu pour l’instant." : "No Rentauto synchronization events have been received yet."}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
