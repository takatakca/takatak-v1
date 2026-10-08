import Link from "next/link";

import { ModuleHeader } from "@/components/saas/module-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { requireCustomerDatabaseAccess } from "@/lib/customers/access";
import { getCustomerDatabasePage } from "@/lib/customers/customer-data";

export const dynamic = "force-dynamic";

function textParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function pageParam(value: string | string[] | undefined): number {
  const parsed = Number.parseInt(textParam(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number, query: string): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/dashboard/customers?${suffix}` : "/dashboard/customers";
}

export default async function CustomerDatabasePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const access = await requireCustomerDatabaseAccess("/dashboard/customers");
  const data = await getCustomerDatabasePage(
    access,
    textParam(params.q),
    pageParam(params.page),
  );

  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Customer Database"
        description="One customer record with contact details, reservation history, interactions, and traceable source evidence. Workspace users only see their own customer data; TAKATAK owner/admin can use the global view."
        statuses={[data.globalView ? "Global TAKATAK view" : "Private workspace"]}
      />

      <Card>
        <CardBody>
          <form method="get" className="flex flex-col gap-3 sm:flex-row">
            <input
              type="search"
              name="q"
              defaultValue={data.query}
              placeholder="Search name, email, phone, city, postal code, or reservation number"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Search
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-500">
            {data.sourceLabel}
          </p>
        </CardBody>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-2xl font-semibold text-slate-900">
              {data.total.toLocaleString("en-CA")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Matching customer records
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-2xl font-semibold text-slate-900">
              {data.page.toLocaleString("en-CA")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Current page
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-2xl font-semibold text-slate-900">
              {data.totalPages.toLocaleString("en-CA")}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Total pages
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Customer</th>
                {data.globalView ? <th className="px-4 py-3">Workspace</th> : null}
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Reservations</th>
                <th className="px-4 py-3">Interactions</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3">Evidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.customers.map((customer) => (
                <tr key={customer.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/customers/${customer.id}`}
                      className="font-medium text-indigo-700 hover:text-indigo-500"
                    >
                      {customer.displayName || customer.email || "Unnamed customer"}
                    </Link>
                    {customer.brandName ? (
                      <p className="mt-1 text-xs text-slate-400">{customer.brandName}</p>
                    ) : null}
                  </td>
                  {data.globalView ? (
                    <td className="px-4 py-3 text-slate-600">{customer.workspaceName}</td>
                  ) : null}
                  <td className="px-4 py-3 text-slate-600">
                    <div>{customer.email || "—"}</div>
                    <div className="mt-1 text-xs text-slate-400">{customer.phone || ""}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {[customer.city, customer.region].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {customer.reservationCount.toLocaleString("en-CA")}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {customer.interactionCount.toLocaleString("en-CA")}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {customer.lastSeenAt || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={customer.reservationCount ? "success" : "neutral"}>
                      {customer.evidenceStatus}
                    </Badge>
                    <p className="mt-1 text-xs text-slate-400">
                      {customer.sourceCount} source{customer.sourceCount === 1 ? "" : "s"}
                    </p>
                  </td>
                </tr>
              ))}
              {!data.customers.length ? (
                <tr>
                  <td
                    colSpan={data.globalView ? 8 : 7}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    {data.source === "unavailable"
                      ? data.sourceLabel
                      : "No customer records match this search."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Link
          href={pageHref(Math.max(1, data.page - 1), data.query)}
          aria-disabled={data.page <= 1}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            data.page <= 1
              ? "pointer-events-none border-slate-100 text-slate-300"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Previous
        </Link>
        <p className="text-xs text-slate-500">
          Page {data.page.toLocaleString("en-CA")} of {data.totalPages.toLocaleString("en-CA")}
        </p>
        <Link
          href={pageHref(Math.min(data.totalPages, data.page + 1), data.query)}
          aria-disabled={data.page >= data.totalPages}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            data.page >= data.totalPages
              ? "pointer-events-none border-slate-100 text-slate-300"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}
