import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CalendarDays,
  CarFront,
  CircleDollarSign,
  MailCheck,
  PhoneCall,
  ShieldCheck,
  WalletCards,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getRentautoClientData } from "@/lib/rentauto/rentauto-client-data";

export const dynamic = "force-dynamic";

function money(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: currency || "CAD",
  }).format(amountMinor / 100);
}

function when(value: string | null): string {
  if (!value) return "Not synchronized yet";
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(new Date(value));
}

function dateRange(startAt: string, endAt: string): string {
  const format = new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Toronto",
  });

  return `${format.format(new Date(startAt))} – ${format.format(
    new Date(endAt),
  )}`;
}

function tripTone(status: string): "success" | "warning" | "neutral" | "danger" {
  if (status === "active" || status === "confirmed") return "success";
  if (
    status === "pending_payment" ||
    status === "check_in_pending" ||
    status === "check_out_pending" ||
    status === "draft"
  ) {
    return "warning";
  }
  if (status === "cancelled" || status === "disputed") return "danger";
  return "neutral";
}

function sentenceStatus(value: string | null): string {
  if (!value) return "Not started";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default async function RentautoDashboardPage() {
  const data = await getRentautoClientData();

  const hostVisible =
    data.roles.includes("host") ||
    data.roles.includes("admin") ||
    Boolean(data.host.applicationStatus);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <CarFront className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-600">
                TAKATAK connected service
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                Rentauto
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                One TAKATAK identity for your Rentauto account, trips, host
                access and payment summaries. Rental operations remain isolated
                inside Rentauto.
              </p>
            </div>
          </div>

          <Link
            href="https://rentauto.ca"
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Open Rentauto
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid border-t border-slate-100 sm:grid-cols-3">
          <div className="px-6 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Upcoming trips
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {data.upcomingTripCount}
            </p>
          </div>
          <div className="border-t border-slate-100 px-6 py-4 sm:border-l sm:border-t-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Active now
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {data.activeTripCount}
            </p>
          </div>
          <div className="border-t border-slate-100 px-6 py-4 sm:border-l sm:border-t-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Unread Rentauto notices
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {data.unreadNotifications}
            </p>
          </div>
        </div>
      </section>

      {data.nextTrip ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Next Rentauto trip
                </p>
                <Badge tone={tripTone(data.nextTrip.status)}>
                  {sentenceStatus(data.nextTrip.status)}
                </Badge>
              </div>
              <h2 className="mt-2 text-xl font-semibold">
                {data.nextTrip.vehicleName}
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                  {dateRange(data.nextTrip.startAt, data.nextTrip.endAt)}
                </span>
                <span>{data.nextTrip.bookingReference}</span>
                {data.nextTrip.totalCents !== null ? (
                  <span>
                    {money(data.nextTrip.totalCents, data.nextTrip.currency)}
                  </span>
                ) : null}
              </div>
            </div>

            <Link
              href={`https://rentauto.ca/trips/${data.nextTrip.id}`}
              className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-white px-4 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
            >
              View trip
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      <Card>
        <CardHeader title="Account connection" subtitle={data.sourceLabel} />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <BadgeCheck
                  className="h-4 w-4 text-emerald-600"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-slate-900">
                  Master identity
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {data.linked ? "Linked" : "Not linked yet"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <MailCheck
                  className="h-4 w-4 text-slate-500"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-slate-900">
                  Email verification
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {data.emailVerified ? "Verified" : "Not verified"}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <PhoneCall
                  className="h-4 w-4 text-slate-500"
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-slate-900">
                  Phone verification
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {data.phoneVerified ? "Verified" : "Not verified"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              Account status: {data.accountStatus ?? "Not synchronized"}
            </span>
            <span aria-hidden="true">•</span>
            <span>Last sync: {when(data.lastSynchronizedAt)}</span>
          </div>
        </CardBody>
      </Card>

      {hostVisible ? (
        <Card>
          <CardHeader
            title="Host operations"
            subtitle="Rentauto host access stays separate from your other TAKATAK services."
            action={
              data.roles.includes("host") || data.roles.includes("admin") ? (
                <Link
                  href="https://rentauto.ca/host"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-slate-950"
                >
                  Open host dashboard
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              ) : undefined
            }
          />
          <CardBody>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Application
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {sentenceStatus(data.host.applicationStatus)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Identity review
                </p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {sentenceStatus(data.host.verificationStatus)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Vehicles
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {data.host.activeVehicleCount} active / {data.host.vehicleCount} total
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {data.host.upcomingTripCount} upcoming host trip
                  {data.host.upcomingTripCount === 1 ? "" : "s"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Payouts
                </p>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <WalletCards className="h-4 w-4 text-slate-500" aria-hidden="true" />
                  {data.host.payoutsReady ? "Ready" : "Setup required"}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Rentauto payments"
          subtitle="Customer-facing booking summaries synchronized from Rentauto. Processor IDs are never shown."
          action={
            data.unreadNotifications > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <Bell className="h-3.5 w-3.5" aria-hidden="true" />
                {data.unreadNotifications} unread
              </span>
            ) : undefined
          }
        />
        <CardBody>
          {data.paymentSummaries.length ? (
            <div className="divide-y divide-slate-100">
              {data.paymentSummaries.map((payment) => (
                <div
                  key={payment.bookingNumber}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <CircleDollarSign
                        className="h-4 w-4 text-slate-400"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-medium text-slate-900">
                        {payment.bookingNumber}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {when(payment.transactionDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      tone={
                        payment.status === "PAID"
                          ? "success"
                          : payment.status === "FAILED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {payment.status}
                    </Badge>
                    <span className="text-sm font-semibold text-slate-900">
                      {money(payment.amountMinor, payment.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No Rentauto payment summaries are linked to this TAKATAK account yet.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
