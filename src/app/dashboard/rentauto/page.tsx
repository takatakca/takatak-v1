import Link from "next/link";
import {
  BadgeCheck,
  CarFront,
  CircleDollarSign,
  MailCheck,
  PhoneCall,
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

export default async function RentautoDashboardPage() {
  const data = await getRentautoClientData();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
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
                Your Rentauto identity and account summaries are connected to
                your TAKATAK account while rental operations remain isolated
                inside Rentauto.
              </p>
            </div>
          </div>

          <Link
            href="https://rentauto.ca"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Open Rentauto
          </Link>
        </div>
      </section>

      <Card>
        <CardHeader title="Account connection" subtitle={data.sourceLabel} />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
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
                <MailCheck className="h-4 w-4 text-slate-500" aria-hidden="true" />
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
                <PhoneCall className="h-4 w-4 text-slate-500" aria-hidden="true" />
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
            <span>Account status: {data.accountStatus ?? "Not synchronized"}</span>
            <span aria-hidden="true">•</span>
            <span>Last sync: {when(data.lastSynchronizedAt)}</span>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Rentauto payments"
          subtitle="Customer-facing booking summaries synchronized from Rentauto. Processor IDs are never shown."
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
                      <CircleDollarSign className="h-4 w-4 text-slate-400" aria-hidden="true" />
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
