import { AdminAccessBanner } from "@/components/admin/admin-access-banner";
import { AdminHeader } from "@/components/admin/admin-header";
import { InvoiceRequestActions } from "@/components/billing/invoice-request-actions";
import { ManualInvoiceRequestForm } from "@/components/billing/manual-invoice-request-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  getFacturationsOverview,
  type FacturationsOverview,
} from "@/lib/billing/invoices/facturations-overview";
import { getFacturationsEnvStatus } from "@/lib/integrations/facturations/env";
import {
  countInvoiceRequestsByStatus,
  listInvoiceRequests,
  type InvoiceRequestView,
} from "@/lib/billing/invoices/invoice-request-service";
import { formatCad } from "@/lib/billing/invoices/preview";
import {
  INVOICE_REQUEST_STATUSES,
  INVOICE_REQUEST_STATUS_LABELS,
  canCancelInvoiceRequest,
  canReconcileInvoiceRequest,
  canSubmitInvoiceRequest,
  type InvoiceRequestStatus,
} from "@/lib/billing/invoices/request-policy";
import {
  BILLING_SOURCE_APP_LABELS,
  isBillingSourceApp,
} from "@/lib/billing/invoices/source-apps";
import type { FacturationsFailureKind } from "@/lib/integrations/facturations/contract";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

const STATE_LABELS: Record<FacturationsOverview["env"]["state"], string> = {
  disabled: "Disabled",
  not_configured: "Not configured",
  configured_untested: "Configured",
};

const FAILURE_LABELS: Record<FacturationsFailureKind, string> = {
  disabled: "Integration disabled (FACTURATIONS_INTEGRATION_ENABLED is not 1).",
  not_configured: "Server configuration incomplete.",
  identity_unavailable: "Your TAKATAK identity has no Facturations role.",
  auth_rejected: "Facturations rejected the signed service identity.",
  token_replay: "Facturations rejected a replayed token. Retry.",
  owner_required: "Facturations requires the OWNER role for this view.",
  not_found: "Facturations integration endpoint is not enabled.",
  invalid_request: "Facturations rejected the request.",
  idempotency_conflict: "Idempotency conflict in Facturations.",
  unavailable: "Facturations is unavailable.",
  invalid_response: "Facturations returned an unexpected response.",
  network_error: "Facturations could not be reached.",
};

function statusTone(status: InvoiceRequestStatus) {
  switch (status) {
    case "submitted":
      return "success" as const;
    case "failed":
    case "submitting":
      return "warning" as const;
    case "rejected":
    case "needs_reconciliation":
      return "danger" as const;
    case "cancelled":
      return "muted" as const;
    default:
      return "accent" as const;
  }
}

function sourceLabel(sourceApp: string): string {
  return isBillingSourceApp(sourceApp) ? BILLING_SOURCE_APP_LABELS[sourceApp] : sourceApp;
}

async function loadQueue(): Promise<
  | { available: true; requests: InvoiceRequestView[]; counts: Record<InvoiceRequestStatus, number> }
  | { available: false }
> {
  try {
    const [requests, counts] = await Promise.all([
      listInvoiceRequests({ take: 50 }),
      countInvoiceRequestsByStatus(),
    ]);

    return { available: true, requests, counts };
  } catch {
    return { available: false };
  }
}

async function loadOverview(access: {
  profileId: string | null;
  role: "owner" | "admin" | null;
}): Promise<FacturationsOverview> {
  try {
    return await getFacturationsOverview(access);
  } catch {
    // A Facturations or database failure must never take down the queue view.
    const unavailable = { available: false as const, reason: "unavailable" as const };

    return {
      env: getFacturationsEnvStatus(),
      actorRole: null,
      capabilities: unavailable,
      dashboard: unavailable,
      drafts: unavailable,
    };
  }
}

export default async function AdminBillingPage() {
  const access = await requireAdminAccess();
  const [overview, queue] = await Promise.all([
    loadOverview({ profileId: access.profileId, role: access.role }),
    loadQueue(),
  ]);
  const isOwner = overview.actorRole === "OWNER";
  const now = new Date();

  return (
    <div className="space-y-6">
      <AdminHeader
        title="GROUPE TAKATAK Billing"
        subtitle="Central invoice queue for the whole ecosystem. Every TAKATAK app feeds invoice requests here; the platform owner sends them to Facturations, which creates DRAFTS only. Issuance, sending and payment stay in the standalone Facturations workspace with its own owner approvals."
        badges={["Foundation", "Drafts only", "No issuance"]}
      />
      <AdminAccessBanner enforced={access.enforced} role={access.role} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Facturations connection" subtitle="Server-to-server, signed 60-second identity." />
          <CardBody className="space-y-2 text-sm text-slate-600">
            <div className="flex items-center gap-2">
              <Badge tone={overview.env.state === "configured_untested" ? "success" : "warning"}>
                {STATE_LABELS[overview.env.state]}
              </Badge>
              {overview.actorRole ? <Badge tone="accent">You act as {overview.actorRole}</Badge> : null}
            </div>
            {overview.env.missing.length && overview.env.enabled ? (
              <p className="text-xs">
                Missing: <span className="font-mono">{overview.env.missing.join(", ")}</span>
              </p>
            ) : null}
            {overview.capabilities.available ? (
              <p className="text-xs">
                Draft creation{" "}
                {overview.capabilities.data.capabilities.draftWrite ? "enabled" : "disabled on the Facturations server"}.
              </p>
            ) : (
              <p className="text-xs">{FAILURE_LABELS[overview.capabilities.reason]}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Facturations drafts" subtitle="DRAFTS ONLY — not revenue, receivables or payments." />
          <CardBody className="text-sm text-slate-600">
            {overview.dashboard.available ? (
              <dl className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <dt className="text-xs text-slate-400">Drafts</dt>
                  <dd className="text-lg font-semibold text-slate-900">{overview.dashboard.data.draftCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Draft total</dt>
                  <dd className="text-lg font-semibold text-slate-900">{formatCad(overview.dashboard.data.draftTotalCents)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Customers</dt>
                  <dd className="text-lg font-semibold text-slate-900">{overview.dashboard.data.customerCount}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs">{FAILURE_LABELS[overview.dashboard.reason]}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Queue" subtitle="Requests fed by ecosystem apps." />
          <CardBody>
            {queue.available ? (
              <div className="flex flex-wrap gap-2">
                {INVOICE_REQUEST_STATUSES.map((status) => (
                  <Badge key={status} tone={statusTone(status)}>
                    {INVOICE_REQUEST_STATUS_LABELS[status]} ×{queue.counts[status]}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Billing storage is unavailable.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Invoice requests"
          subtitle="“Create draft” sends the request to Facturations with a deterministic idempotency key — retries never duplicate a draft."
        />
        <CardBody className="overflow-x-auto p-0">
          {queue.available && queue.requests.length ? (
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-2">Source</th>
                  <th className="px-5 py-2">Customer</th>
                  <th className="px-5 py-2">Dates</th>
                  <th className="px-5 py-2 text-right">Estimate</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.requests.map((request) => (
                  <tr key={request.id} className="align-top">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{sourceLabel(request.sourceApp)}</div>
                      <div className="max-w-[14rem] truncate font-mono text-xs text-slate-400">{request.sourceReference}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{request.customerName}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500">
                      {request.invoiceDate} → {request.dueDate}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right">
                      <div className="font-medium text-slate-900">{formatCad(request.estimatedTotalCents)}</div>
                      {request.facturationsTotalCents !== null &&
                      request.facturationsTotalCents !== request.estimatedTotalCents ? (
                        <div className="text-xs text-amber-600">
                          Facturations: {formatCad(request.facturationsTotalCents)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={statusTone(request.status)}>{INVOICE_REQUEST_STATUS_LABELS[request.status]}</Badge>
                      {request.lastErrorCode ? (
                        <div className="mt-1 font-mono text-xs text-slate-400">{request.lastErrorCode}</div>
                      ) : null}
                      {request.facturationsDraftId ? (
                        <div className="mt-1 max-w-[12rem] truncate font-mono text-xs text-slate-400">
                          {request.facturationsDraftId}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <InvoiceRequestActions
                        requestId={request.id}
                        isOwner={isOwner}
                        canSubmit={canSubmitInvoiceRequest(
                          request.status,
                          new Date(request.updatedAt),
                          now,
                        )}
                        canCancel={canCancelInvoiceRequest(request.status, request.submitAttempts)}
                        canReconcile={canReconcileInvoiceRequest(request.status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-5 py-4 text-sm text-slate-500">
              {queue.available ? "No invoice requests yet." : "Billing storage is unavailable."}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Manual invoice request"
          subtitle="For invoices that no ecosystem app feeds automatically. Queues a request only; nothing is sent until the owner creates the draft."
        />
        <CardBody>
          <ManualInvoiceRequestForm />
        </CardBody>
      </Card>
    </div>
  );
}
