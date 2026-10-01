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
} from "lucide-react";

import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { RentautoDriverVerificationsCard } from "@/components/rentauto/rentauto-driver-verifications-card";
import { RentautoHostApplicationsCard } from "@/components/rentauto/rentauto-host-applications-card";
import { RentautoVehicleReviewsCard } from "@/components/rentauto/rentauto-vehicle-reviews-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getRentautoAdminData } from "@/lib/rentauto/rentauto-admin-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

function money(minor: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(minor / 100);
}

function when(value: string | null): string {
  if (!value) return "No synchronization yet";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

export default async function RentautoAdminPage() {
  const access = await requireAdminAccess();
  const data = await getRentautoAdminData();

  const kpis = [
    { label: "Rentauto accounts", value: data.customers, icon: Users },
    { label: "Hosts", value: data.operations.hosts, icon: ShieldCheck },
    { label: "Vehicles", value: data.operations.vehicles, icon: CarFront },
    { label: "Active trips", value: data.operations.activeTrips, icon: Route },
    { label: "Host applications", value: data.operations.pendingHostApplications, icon: ClipboardCheck },
    { label: "Vehicle reviews", value: data.operations.pendingVehicleReviews, icon: BadgeCheck },
    { label: "Driver reviews", value: data.operations.pendingDriverVerifications, icon: BadgeCheck },
    { label: "Open support", value: data.operations.openSupportTickets, icon: LifeBuoy },
    { label: "Open incidents", value: data.operations.openIncidents, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Rentauto"
        subtitle="TAKATAK control plane for live Rentauto marketplace operations, identity, fleet, trips, verification, support and financial summaries."
        badges={["TAKATAK vertical", "Live operations", "Shared identity", "No private GPS/documents"]}
      />

      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner
        source={data.available ? "database" : "unavailable"}
        label={data.sourceLabel}
      />

      <section aria-label="Rentauto key metrics">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-9">
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
            title="Marketplace financials"
            subtitle="Live booking value plus the normalized TAKATAK payment projection. Stripe and Rentauto remain transaction authority."
          />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Live gross booking value</span>
              <strong className="text-slate-900">
                {money(data.operations.grossBookingValueMinor, data.currency)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Projected paid amount</span>
              <strong className="text-slate-900">
                {money(data.paidAmountMinor, data.currency)}
              </strong>
            </div>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Recorded refunds</span>
              <strong className="text-slate-900">
                {money(data.refundedAmountMinor, data.currency)}
              </strong>
            </div>
            <p className="border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
              TAKATAK stores a normalized projection for dashboard, CRM and
              reporting. It does not replace Rentauto trip/payment authority.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Synchronization health"
            subtitle="Server-to-server Rentauto → TAKATAK event ingestion."
          />
          <CardBody className="space-y-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span className="text-sm font-medium text-slate-800">
                Idempotent source event contract
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span className="text-sm text-slate-600">
                Last activity: {when(data.lastSynchronizedAt)}
              </span>
            </div>
            <p className="text-xs leading-5 text-slate-500">
              Passwords, OTPs, sessions, private documents and exact GPS
              history are intentionally excluded from the master projection.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="TAKATAK master-data projection"
          subtitle="Cross-product identity, CRM and reporting view. Operational Rentauto data above remains the live source."
        />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Projected customers</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{data.projectedCustomers}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Verified email</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{data.verifiedEmailProfiles}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Verified phone</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{data.verifiedPhoneProfiles}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Payment summaries</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{data.paymentSummaries}</p>
            </div>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">
            {data.operations.approvedHostApplications} approved host application{data.operations.approvedHostApplications === 1 ? "" : "s"} · {data.operations.activeVehicles} active vehicle{data.operations.activeVehicles === 1 ? "" : "s"} · {data.operations.completedTrips} completed trip{data.operations.completedTrips === 1 ? "" : "s"}.
          </p>
        </CardBody>
      </Card>

      <RentautoDriverVerificationsCard />
      <RentautoHostApplicationsCard />
      <RentautoVehicleReviewsCard />

      <Card>
        <CardHeader
          title="Recent Rentauto synchronization events"
          subtitle="Event metadata only — payloads and sensitive source data are not displayed."
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
                      {when(event.createdAt)}
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
                    {event.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No Rentauto synchronization events have been received yet.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
