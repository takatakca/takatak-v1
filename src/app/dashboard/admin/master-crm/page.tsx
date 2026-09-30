import { Building2, Link2, ShoppingBag, Users, Workflow } from "lucide-react";
import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminHeader } from "@/components/admin/admin-header";
import { AdminKpiCard } from "@/components/admin/admin-kpi-card";
import { AdminTable, type AdminColumn } from "@/components/admin/admin-table";
import { AdminSourceBanner } from "@/components/admin/source-banner";
import { Badge, toneForStatus } from "@/components/ui/badge";
import {
  getMasterCrmData,
  type MasterCrmCompanySummary,
  type MasterCrmIdentitySummary,
  type MasterCrmOrderSummary,
  type MasterCrmRelationshipSummary,
} from "@/lib/admin/master-crm-data";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const identityColumns: AdminColumn<MasterCrmIdentitySummary>[] = [
  {
    key: "customer",
    header: "Master person",
    render: (row) => (
      <div className="min-w-52">
        <p className="text-sm font-semibold text-slate-900">{row.name}</p>
        <p className="mt-0.5 text-xs text-slate-500">{row.email ?? "No primary email"}</p>
        <p className="text-[11px] text-slate-400">{row.phone ?? "No primary phone"}</p>
      </div>
    ),
  },
  {
    key: "verification",
    header: "Verification",
    render: (row) => (
      <div className="flex flex-wrap gap-1">
        <Badge tone={row.emailVerified ? "success" : "muted"}>
          Email {row.emailVerified ? "verified" : "unverified"}
        </Badge>
        <Badge tone={row.phoneVerified ? "success" : "muted"}>
          Phone {row.phoneVerified ? "verified" : "unverified"}
        </Badge>
      </div>
    ),
  },
  {
    key: "sources",
    header: "Sources",
    render: (row) => (
      <div className="flex flex-wrap gap-1">
        {row.sources.map((source) => <Badge key={source} tone="accent">{source.toUpperCase()}</Badge>)}
      </div>
    ),
  },
  {
    key: "relationships",
    header: "Merchant relations",
    render: (row) => <span>{row.relationshipCount}</span>,
  },
  {
    key: "orders",
    header: "Source orders",
    render: (row) => <span>{row.orderCount}</span>,
  },
  {
    key: "updated",
    header: "Updated",
    render: (row) => <span className="text-xs text-slate-500">{new Date(row.updatedAt).toLocaleString("en-CA")}</span>,
  },
];

const companyColumns: AdminColumn<MasterCrmCompanySummary>[] = [
  {
    key: "company",
    header: "Company / merchant",
    render: (row) => (
      <div className="min-w-52">
        <p className="font-semibold text-slate-900">{row.displayName}</p>
        <p className="text-xs text-slate-500">{row.legalName ?? row.email ?? "No legal name supplied"}</p>
      </div>
    ),
  },
  { key: "province", header: "Province", render: (row) => <span>{row.province ?? "—"}</span> },
  {
    key: "status",
    header: "Status",
    render: (row) => <Badge tone={toneForStatus(row.status ?? "unknown")}>{row.status ?? "unknown"}</Badge>,
  },
  { key: "sources", header: "Source merchants", render: (row) => <span>{row.merchantCount}</span> },
  { key: "relations", header: "Customer relations", render: (row) => <span>{row.relationshipCount}</span> },
  { key: "orders", header: "Orders", render: (row) => <span>{row.orderCount}</span> },
];

const relationshipColumns: AdminColumn<MasterCrmRelationshipSummary>[] = [
  { key: "customer", header: "Customer", render: (row) => <span className="font-medium">{row.customer}</span> },
  { key: "merchant", header: "Merchant", render: (row) => <span>{row.merchant}</span> },
  { key: "orders", header: "Orders", render: (row) => <span>{row.orderCount ?? "—"}</span> },
  {
    key: "ltv",
    header: "Merchant-scoped LTV",
    render: (row) => <span>{row.lifetimeValue ? `$${row.lifetimeValue} ${row.currency}` : "—"}</span>,
  },
  {
    key: "last",
    header: "Last seen",
    render: (row) => <span className="text-xs text-slate-500">{row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString("en-CA") : "—"}</span>,
  },
];

const orderColumns: AdminColumn<MasterCrmOrderSummary>[] = [
  { key: "order", header: "Source order", render: (row) => <span className="font-mono text-xs font-semibold">{row.orderNumber}</span> },
  { key: "customer", header: "Customer", render: (row) => <span>{row.customer}</span> },
  { key: "total", header: "Total", render: (row) => <span className="font-semibold">${row.total} {row.currency}</span> },
  { key: "payment", header: "Payment", render: (row) => <Badge tone={toneForStatus(row.paymentStatus ?? "unknown")}>{row.paymentStatus ?? "unknown"}</Badge> },
  { key: "fulfillment", header: "Fulfillment", render: (row) => <Badge tone={toneForStatus(row.fulfillmentStatus ?? "unknown")}>{row.fulfillmentStatus ?? "unknown"}</Badge> },
  { key: "date", header: "Occurred", render: (row) => <span className="text-xs text-slate-500">{new Date(row.occurredAt).toLocaleString("en-CA")}</span> },
];

export default async function MasterCrmPage() {
  const access = await requireAdminAccess();
  const data = await getMasterCrmData();

  return (
    <div className="space-y-7">
      <AdminHeader
        title="Master CRM"
        subtitle="Global TAKATAK identity and company graph with source-scoped 1LV marketplace relationships. Master identity never grants a merchant access to another merchant's customer data."
        badges={["Platform admin", "1LV.CA", "Live database"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />
      <AdminSourceBanner source={data.source} label={data.sourceLabel} />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Master CRM KPIs">
        <AdminKpiCard label="1LV people" value={data.kpis.identities} icon={Users} />
        <AdminKpiCard label="Companies" value={data.kpis.companies} icon={Building2} />
        <AdminKpiCard label="Source merchants" value={data.kpis.merchants} icon={Building2} />
        <AdminKpiCard label="Relationships" value={data.kpis.relationships} icon={Link2} />
        <AdminKpiCard label="Source orders" value={data.kpis.orders} icon={ShoppingBag} />
        <AdminKpiCard label="Processed events" value={data.kpis.processedEvents} icon={Workflow} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Master people</h2>
          <p className="text-xs text-slate-500">Recent master identities linked to a 1LV source profile. Verification is shown explicitly; unverified source contacts are not silently merged.</p>
        </div>
        {data.identities.length ? (
          <AdminTable columns={identityColumns} rows={data.identities} rowKey={(row) => row.id} caption="TAKATAK master people sourced from 1LV" />
        ) : (
          <AdminEmptyState title="No 1LV identities received yet" description="Master people will appear after 1LV customer lifecycle events are delivered successfully." />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Companies & marketplace merchants</h2>
          <p className="text-xs text-slate-500">Global company records linked to source-specific 1LV merchant identities.</p>
        </div>
        {data.companies.length ? (
          <AdminTable columns={companyColumns} rows={data.companies} rowKey={(row) => row.id} caption="TAKATAK master companies linked to 1LV" />
        ) : (
          <AdminEmptyState title="No 1LV merchants received yet" description="Approved or synchronized 1LV merchants will appear here after event ingestion." />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Customer ↔ merchant relationships</h2>
          <p className="text-xs text-slate-500">Order count and lifetime value are scoped to the individual merchant relationship, never aggregated for merchant-facing access.</p>
        </div>
        {data.relationships.length ? (
          <AdminTable columns={relationshipColumns} rows={data.relationships} rowKey={(row) => row.id} caption="1LV customer-to-merchant relationships" />
        ) : (
          <AdminEmptyState title="No marketplace relationships yet" description="Relationships are created from vendor-specific 1LV order lifecycle events." />
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Recent source orders</h2>
          <p className="text-xs text-slate-500">Operational summaries only. Payment-card data, OTPs, session tokens and marketplace secrets are never stored here.</p>
        </div>
        {data.orders.length ? (
          <AdminTable columns={orderColumns} rows={data.orders} rowKey={(row) => row.id} caption="Recent 1LV source orders in TAKATAK" />
        ) : (
          <AdminEmptyState title="No 1LV source orders yet" description="Orders will appear after the 1LV outbox delivers order lifecycle events to TAKATAK." />
        )}
      </section>
    </div>
  );
}
