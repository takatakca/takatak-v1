import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Paperclip } from "lucide-react";

import { EmptyState } from "@/components/saas/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getLeadDetail } from "@/lib/leads/lead-detail";
import { LEAD_PRIORITY_LABELS, LEAD_STATUS_LABELS, leadToneForStatus } from "@/lib/leads/status";

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
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Request" />
          <CardBody>
            {lead.message ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{lead.message}</p>
            ) : (
              <p className="text-sm text-slate-500">No message.</p>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
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
