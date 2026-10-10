import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Paperclip } from "lucide-react";

import { LeadOrderBillingForm } from "@/components/billing/lead-order-billing-form";
import { LeadActionsForm } from "@/components/leads/lead-actions-form";
import { EmptyState } from "@/components/saas/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getLeadOrderBilling, type LeadOrderBillingState } from "@/lib/billing/invoices/lead-order-service";
import { getLeadDetail } from "@/lib/leads/lead-detail";
import { LEAD_PRIORITY_LABELS, LEAD_STATUS_LABELS, leadToneForStatus } from "@/lib/leads/status";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { getPlatformAdminAccess } from "@/lib/security/platform-admin-access";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lead",
  robots: { index: false, follow: false },
};

const KIND_LABELS: Record<string, string> = {
  domain_request: "Domain request",
  hosting_request: "Hosting request",
  project_request: "Project request",
  package_order: "Marketplace order",
};

function when(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Toronto",
  }).format(date);
}

function money(cents: number, currency: string | null): string {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: currency || "CAD" }).format(cents / 100);
}

const BILLING_STATUS_LABELS: Record<string, string> = {
  pending: "queued — review it in Admin › Billing",
  submitting: "sending",
  submitted: "draft created in Facturations",
  failed: "failed — retry from Admin › Billing",
  rejected: "rejected",
  needs_reconciliation: "needs reconciliation",
  cancelled: "cancelled",
};

const BLOCKER_COPY: Record<string, string> = {
  not_an_order: "This lead is not a takatak.ca package order.",
  not_won: "Mark the lead as Won to bill this order.",
  no_email: "Add the customer's email to bill this order.",
  no_name: "Add the customer's name or company to bill this order.",
};

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (lead === null) notFound();

  if (lead === "unavailable") {
    return (
      <EmptyState title="Lead unavailable" description="Sign in to a workspace with access to leads, or try again shortly." />
    );
  }

  const { access } = await getServerAccessContext();
  const canEdit = access.mode === "client_scoped" && hasEffectivePermission(access, "edit_content");
  // Billing a won order is a platform owner/admin action, like the billing queue.
  const platform = await getPlatformAdminAccess();
  let billing: LeadOrderBillingState | null = null;
  if (platform.mode === "authorized") {
    try {
      billing = await getLeadOrderBilling(lead.id);
    } catch {
      billing = null;
    }
  }

  const contact = [
    lead.email ? { label: "Email", value: lead.email, href: `mailto:${lead.email}` } : null,
    lead.phone ? { label: "Phone", value: lead.phone, href: `tel:${lead.phone.replace(/[^+\d]/g, "")}` } : null,
    lead.company ? { label: "Company", value: lead.company, href: null } : null,
  ].filter((item): item is { label: string; value: string; href: string | null } => item !== null);

  return (
    <div className="space-y-5">
      <Link href="/dashboard/leads/inbox" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft size={14} /> Lead inbox
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{lead.name ?? "Unnamed lead"}</h1>
          <p className="text-sm text-slate-500">
            {lead.website?.kind ? `${KIND_LABELS[lead.website.kind] ?? lead.website.kind} · ` : ""}
            {lead.sourceName ?? "No source"} · {when(lead.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={leadToneForStatus(lead.status)}>{LEAD_STATUS_LABELS[lead.status] ?? lead.status}</Badge>
          <Badge tone={leadToneForStatus(lead.priority)}>{LEAD_PRIORITY_LABELS[lead.priority] ?? lead.priority}</Badge>
          {lead.valueCents !== null ? <Badge tone="neutral">{money(lead.valueCents, lead.currency)}</Badge> : null}
          {lead.followUpOn ? <Badge tone="neutral">Follow up {lead.followUpOn}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Request" />
            <CardBody>
              {lead.message ? (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{lead.message}</p>
              ) : (
                <p className="text-sm text-slate-500">No message.</p>
              )}
            </CardBody>
          </Card>

          {canEdit ? (
            <Card>
              <CardHeader title="Update" subtitle="Changes are recorded in the history below." />
              <CardBody>
                <LeadActionsForm
                  leadId={lead.id}
                  status={lead.status}
                  priority={lead.priority}
                  followUpOn={lead.followUpOn}
                />
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="History" />
            <CardBody>
              {lead.activities.length ? (
                <ol className="space-y-3">
                  {lead.activities.map((item) => (
                    <li key={item.id} className="border-l-2 border-slate-200 pl-3">
                      <p className="text-sm font-medium text-slate-800">{item.title}</p>
                      {item.note ? <p className="whitespace-pre-wrap break-words text-sm text-slate-600">{item.note}</p> : null}
                      <p className="text-xs text-slate-400">{when(item.createdAt)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-500">No activity yet.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          {billing ? (
            <Card>
              <CardHeader title="Invoice" subtitle="Facturations, through the billing queue." />
              <CardBody className="space-y-2 text-sm">
                {billing.request ? (
                  <>
                    <p>
                      Invoice request <Badge tone="neutral">{BILLING_STATUS_LABELS[billing.request.status] ?? billing.request.status}</Badge>
                    </p>
                    <p className="text-xs text-slate-500">
                      Estimate {money(Number(billing.request.estimatedTotalCents), "CAD")} · due {billing.request.dueDate}
                    </p>
                    <Link href="/dashboard/admin/billing" className="text-xs font-medium text-emerald-700 hover:underline">
                      Open Admin › Billing
                    </Link>
                  </>
                ) : billing.blockers.length ? (
                  <ul className="list-disc space-y-1 pl-4 text-slate-600">
                    {billing.blockers.map((blocker) => (
                      <li key={blocker}>{BLOCKER_COPY[blocker]}</li>
                    ))}
                  </ul>
                ) : (
                  <LeadOrderBillingForm leadId={lead.id} totalCents={billing.order.totalCents} />
                )}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Contact" />
            <CardBody className="space-y-2 text-sm">
              {contact.length ? (
                contact.map((item) => (
                  <div key={item.label}>
                    <p className="text-xs text-slate-400">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="break-all font-medium text-emerald-700 hover:underline">{item.value}</a>
                    ) : (
                      <p className="font-medium text-slate-800">{item.value}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-slate-500">No contact details.</p>
              )}
              {lead.website?.sourcePage ? (
                <p className="pt-1 text-xs text-slate-400">
                  Sent from {lead.website.sourcePage}
                  {lead.website.language ? ` · ${lead.website.language.toUpperCase()}` : ""}
                </p>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`Attachments (${lead.attachments.length})`} />
            <CardBody className="space-y-2">
              {lead.attachments.length ? (
                lead.attachments.map((file) => (
                  <a
                    key={file.id}
                    href={`/api/leads/attachments/${file.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 text-slate-700">
                      <Paperclip size={13} className="shrink-0" />
                      <span className="truncate">{file.originalName}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-slate-400">
                      {size(file.sizeBytes)} <Download size={13} />
                    </span>
                  </a>
                ))
              ) : (
                <p className="text-sm text-slate-500">No files.</p>
              )}
              {lead.attachments.length ? (
                <p className="text-[11px] text-slate-400">
                  Files come from the public website. Open them with care; links expire after one minute.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
