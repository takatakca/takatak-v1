import { ArrowUpRight, FileText, Receipt, ShieldAlert } from "lucide-react";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { DataTable } from "@/components/saas/data-table";
import { EmptyState } from "@/components/saas/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MODULE_PLACEHOLDERS } from "@/lib/dashboard/dashboard-config";
import type { FacturationsDraftRow } from "@/lib/integrations/facturations/client";
import { loadFacturationsOverview } from "@/lib/integrations/facturations/overview";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invoices",
  robots: { index: false, follow: false },
};

function money(cents: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(cents / 100);
}

function day(value: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

const DENIED_COPY = {
  workspace_required: {
    title: "Select a workspace",
    description: "Choose a client workspace to see its billing drafts.",
  },
  role_not_allowed: {
    title: "Billing is restricted",
    description:
      "Only workspace owners and admins can view billing drafts. Ask a workspace owner for access.",
  },
  workspace_not_linked: {
    title: "Billing is not set up for this workspace",
    description:
      "This workspace is not linked to a Facturations business yet. TAKATAK will link it once billing is activated.",
  },
} as const;

const ERROR_COPY = {
  rejected:
    "Facturations refused the connection. A TAKATAK administrator needs to check the integration settings.",
  integration_disabled:
    "Facturations has not enabled the TAKATAK connection yet.",
  invalid_request: "The billing request could not be completed.",
  unavailable: "Facturations is temporarily unavailable. Try again shortly.",
  invalid_response:
    "Facturations returned data that could not be verified, so nothing is shown.",
} as const;

const DRAFT_COLUMNS = [
  {
    key: "customer",
    header: "Customer",
    render: (row: FacturationsDraftRow) => (
      <span className="text-sm font-medium text-slate-800">{row.customerName}</span>
    ),
  },
  {
    key: "invoiceDate",
    header: "Invoice date",
    render: (row: FacturationsDraftRow) => (
      <span className="text-sm text-slate-600">{day(row.invoiceDate)}</span>
    ),
  },
  {
    key: "dueDate",
    header: "Due date",
    render: (row: FacturationsDraftRow) => (
      <span className="text-sm text-slate-600">{day(row.dueDate)}</span>
    ),
  },
  {
    key: "total",
    header: "Draft total",
    render: (row: FacturationsDraftRow) => (
      <span className="text-sm tabular-nums text-slate-800">{money(row.totalCents)}</span>
    ),
  },
  {
    key: "status",
    header: "Status",
    render: () => <Badge tone="warning">Draft — not issued</Badge>,
  },
];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      </CardBody>
    </Card>
  );
}

export default async function InvoicesPage() {
  const { access } = await getServerAccessContext();
  const overview = await loadFacturationsOverview(access);

  // Until the integration is switched on, the page stays exactly as before.
  if (overview.state === "disabled") {
    return <ModulePlaceholder def={MODULE_PLACEHOLDERS["invoices"]} />;
  }

  if (overview.state === "not_configured") {
    return (
      <div className="space-y-5">
        <ModulePlaceholder def={MODULE_PLACEHOLDERS["invoices"]} />
        <p className="text-xs text-amber-700">
          The Facturations connection is switched on but its server settings are incomplete, so no billing data is loaded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Invoices</h1>
        <Badge tone="accent">Facturations</Badge>
        <Badge tone="warning">Drafts only</Badge>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
        Billing drafts prepared in Facturations, the GROUPE TAKATAK invoicing system. A draft is not an issued invoice: nothing here has been sent to a customer, posted to Wave or paid.
      </p>

      {overview.state === "denied" ? (
        <EmptyState
          icon={ShieldAlert}
          title={DENIED_COPY[overview.reason].title}
          description={DENIED_COPY[overview.reason].description}
        />
      ) : null}

      {overview.state === "error" ? (
        <EmptyState
          icon={ShieldAlert}
          title="Billing data is not available"
          description={ERROR_COPY[overview.code]}
        />
      ) : null}

      {overview.state === "ready" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Open drafts" value={String(overview.summary.draftCount)} />
            <StatCard
              label="Draft value (not revenue)"
              value={money(overview.summary.draftTotalCents)}
            />
            <StatCard label="Customers" value={String(overview.summary.customerCount)} />
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Latest drafts</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Read-only. Approving, issuing and sending happen in Facturations, each with an explicit owner confirmation.
                </p>
              </div>
              {overview.role === "OWNER" ? (
                <a
                  href={overview.standaloneUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Open Facturations
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
            {overview.drafts.drafts.length ? (
              <DataTable
                caption="Facturations billing drafts"
                columns={DRAFT_COLUMNS}
                rows={overview.drafts.drafts}
                rowKey={(row) => row.id}
              />
            ) : (
              <EmptyState
                icon={FileText}
                title="No drafts yet"
                description="Billing drafts created in Facturations for this workspace will appear here."
              />
            )}
          </section>

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Receipt className="h-3.5 w-3.5" />
            Amounts are CAD drafts and may change before issuance. Issued invoices, payments and PDFs are not connected yet.
          </p>
        </>
      ) : null}
    </div>
  );
}
