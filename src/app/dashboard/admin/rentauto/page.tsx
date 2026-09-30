import {
  Activity,
  BadgeCheck,
  CarFront,
  CreditCard,
  MailCheck,
  PhoneCall,
} from "lucide-react";

import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminSourceBanner } from "@/components/admin/source-banner";
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
    { label: "Rentauto customers", value: data.customers, icon: CarFront },
    { label: "Verified email", value: data.verifiedEmailProfiles, icon: MailCheck },
    { label: "Verified phone", value: data.verifiedPhoneProfiles, icon: PhoneCall },
    { label: "Payment records", value: data.paymentSummaries, icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Rentauto"
        subtitle="TAKATAK control-plane view of Rentauto identities, verification and financial summaries. Rental operations remain isolated inside Rentauto."
        badges={["TAKATAK vertical", "Live projection", "No private GPS/documents"]}
      />

      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner
        source={data.available ? "database" : "unavailable"}
        label={data.sourceLabel}
      />

      <section aria-label="Rentauto key metrics">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Financial projection"
            subtitle="Summary only. Stripe and Rentauto remain the financial transaction authority."
          />
          <CardBody className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-slate-500">Recorded paid amount</span>
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
