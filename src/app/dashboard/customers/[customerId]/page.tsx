import Link from "next/link";
import { notFound } from "next/navigation";

import { ModuleHeader } from "@/components/saas/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireCustomerDatabaseAccess } from "@/lib/customers/access";
import { getCustomerDetailData } from "@/lib/customers/customer-data";
import { isUuid } from "@/lib/validation/common";

export const dynamic = "force-dynamic";

function money(value: number | null, currency: string): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(value / 100);
}

function compactTimestamp(value: string | null): string {
  if (!value) return "—";
  return value.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function metadataList(
  metadata: unknown,
  key: string,
): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string").join(" | ");
  }
  return typeof value === "string" ? value : null;
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  if (!isUuid(customerId)) {
    notFound();
  }

  const access = await requireCustomerDatabaseAccess(
    `/dashboard/customers/${customerId}`,
  );
  const data = await getCustomerDetailData(access, customerId);

  if (data.source === "not_found") {
    notFound();
  }

  if (data.source === "unavailable") {
    return (
      <div className="space-y-5">
        <ModuleHeader
          title="Customer"
          description="Customer intelligence could not be loaded."
        />
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">{data.sourceLabel}</p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { customer } = data;
  const phoneHistory = metadataList(customer.metadata, "phones");
  const addressHistory = metadataList(customer.metadata, "addresses");
  const activities = metadataList(customer.metadata, "activities");

  return (
    <div className="space-y-5">
      <ModuleHeader
        title={customer.displayName || customer.email || "Customer"}
        description={data.sourceLabel}
        statuses={[customer.evidenceStatus]}
        actions={
          <Link
            href="/dashboard/customers"
            className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            All customers
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-2xl font-semibold text-slate-900">
              {customer.reservationCount.toLocaleString("en-CA")}
            </p>
            <p className="mt-1 text-xs text-slate-500">Reservations</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-2xl font-semibold text-slate-900">
              {customer.interactionCount.toLocaleString("en-CA")}
            </p>
            <p className="mt-1 text-xs text-slate-500">Matched interactions</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-2xl font-semibold text-slate-900">
              {customer.sourceCount.toLocaleString("en-CA")}
            </p>
            <p className="mt-1 text-xs text-slate-500">Traceable sources</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Contact details"
            subtitle={data.globalView ? `Workspace: ${customer.workspaceName}` : customer.brandName || customer.workspaceName}
          />
          <CardBody className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</p>
              <p className="mt-1 text-slate-800">{customer.email || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Phone</p>
              <p className="mt-1 text-slate-800">{customer.phone || "—"}</p>
              {phoneHistory && phoneHistory !== customer.phone ? (
                <p className="mt-1 text-xs text-slate-400">{phoneHistory}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Address</p>
              <p className="mt-1 text-slate-800">
                {[
                  customer.addressLine1,
                  customer.addressLine2,
                  customer.city,
                  customer.region,
                  customer.postalCode,
                  customer.country,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
              {addressHistory && addressHistory !== customer.addressLine1 ? (
                <p className="mt-1 text-xs text-slate-400">{addressHistory}</p>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Observed period</p>
              <p className="mt-1 text-slate-800">
                {customer.firstSeenAt || "—"} → {customer.lastSeenAt || "—"}
              </p>
            </div>
            {activities ? (
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Observed activities</p>
                <p className="mt-1 text-slate-800">{activities}</p>
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Evidence summary"
            subtitle="Imported facts remain traceable to their original source."
          />
          <CardBody className="space-y-3">
            <Badge tone={customer.reservationCount ? "success" : "neutral"}>
              {customer.evidenceStatus}
            </Badge>
            <p className="text-sm leading-relaxed text-slate-600">
              The customer record is a normalized view. Reservation rows, matched
              messages, and source links below remain separate evidence; the
              dashboard does not treat a historical export as proof of a current
              stay or current marketing consent.
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Reservation history"
          subtitle="Up to 250 most recent reservation records attached to this customer."
        />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Reservation</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Stay</th>
                <th className="px-4 py-3">Guests</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customer.reservations.map((reservation) => (
                <tr key={reservation.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {reservation.reservationNumber}
                    <p className="mt-1 text-xs font-normal text-slate-400">
                      {reservation.statusText || reservation.sourceSystem}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {reservation.accommodationCode || "—"}
                    {reservation.accommodationType ? (
                      <p className="mt-1 text-xs text-slate-400">{reservation.accommodationType}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {reservation.arrivalDate || "—"} → {reservation.departureDate || "—"}
                    {reservation.nights !== null ? (
                      <p className="mt-1 text-xs text-slate-400">{reservation.nights} night(s)</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {reservation.adults ?? "—"} adult(s)
                    {reservation.children !== null ? (
                      <p className="mt-1 text-xs text-slate-400">{reservation.children} child(ren)</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {money(reservation.totalMinor, reservation.currency)}
                    {reservation.balanceMinor !== null ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Balance {money(reservation.balanceMinor, reservation.currency)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {reservation.sourceUrl ? (
                      <a
                        href={reservation.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-700 hover:text-indigo-500"
                      >
                        Open source
                      </a>
                    ) : (
                      <span className="text-slate-400">{reservation.sourceSystem}</span>
                    )}
                  </td>
                </tr>
              ))}
              {!customer.reservations.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No reservation is linked to this customer.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Matched interactions"
            subtitle="Incoming messages matched to this customer's normalized email."
          />
          <CardBody className="space-y-3">
            {customer.interactions.map((interaction) => (
              <div key={interaction.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {interaction.subject || "(no subject)"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {compactTimestamp(interaction.occurredAt)} · {interaction.channel}
                      {interaction.direction ? ` · ${interaction.direction}` : ""}
                    </p>
                  </div>
                  {interaction.sourceUrl ? (
                    <a
                      href={interaction.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-indigo-700 hover:text-indigo-500"
                    >
                      Source
                    </a>
                  ) : null}
                </div>
                {interaction.snippet ? (
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    {interaction.snippet}
                  </p>
                ) : null}
              </div>
            ))}
            {!customer.interactions.length ? (
              <p className="text-sm text-slate-500">No message was matched to this customer.</p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Source evidence"
            subtitle="Traceability back to imported registry and reservation evidence."
          />
          <CardBody className="space-y-3">
            {customer.evidence.map((evidence) => (
              <div key={evidence.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {evidence.subject || evidence.sourceType}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {evidence.sourceSystem}
                      {evidence.sourceAccount ? ` · ${evidence.sourceAccount}` : ""}
                      {evidence.sourceDate ? ` · ${compactTimestamp(evidence.sourceDate)}` : ""}
                    </p>
                  </div>
                  {evidence.sourceUrl ? (
                    <a
                      href={evidence.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-indigo-700 hover:text-indigo-500"
                    >
                      Open source
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
            {!customer.evidence.length ? (
              <p className="text-sm text-slate-500">No source evidence is attached.</p>
            ) : null}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
