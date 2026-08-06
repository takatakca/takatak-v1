import { Activity, Inbox, Megaphone, Target, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FlexsPrepPanel } from "@/components/leads/flexs-prep-panel";
import { LeadActivityCard } from "@/components/leads/lead-activity-card";
import { LeadCampaignCard } from "@/components/leads/lead-campaign-card";
import { LeadCard } from "@/components/leads/lead-card";
import { LeadsHeader } from "@/components/leads/leads-header";
import { LeadsKpiCard } from "@/components/leads/leads-kpi-card";
import { LeadsSourceBanner } from "@/components/leads/source-banner";
import { LEAD_STATUS_LABELS, leadToneForStatus } from "@/lib/leads/status";
import { getLeadsOverviewData } from "@/lib/leads/leads-data";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { label: "Add Lead", note: "Coming soon" },
  { label: "Add Source", note: "Coming soon" },
  { label: "Plan Campaign", note: "Coming soon" },
  { label: "Log Activity", note: "Coming soon" },
  { label: "Connect FLEXS", note: "Future phase" },
];

export default async function LeadsOverviewPage() {
  const data = await getLeadsOverviewData();
  const kpis = [
    { label: "Leads", value: data.kpis.leads, icon: Users },
    { label: "Sources", value: data.kpis.sources, icon: Inbox },
    { label: "Campaigns", value: data.kpis.campaigns, icon: Megaphone },
    { label: "Follow-ups Planned", value: data.kpis.followUpsPlanned, icon: Activity },
    { label: "Qualified (internal)", value: data.kpis.qualifiedLeads, icon: Target },
  ];
  return (
    <div className="space-y-6">
      <LeadsHeader
        title="Leads"
        subtitle="Internal lead inbox, pipeline, and follow-up tracking before FLEXS connects. No outreach automation exists."
        badges={[{ label: "Foundation" }, { label: "FLEXS not connected" }, { label: "No automation" }]}
      />

      <section aria-label="Leads KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => <LeadsKpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} />)}
        </div>
        <div className="mt-2"><LeadsSourceBanner source={data.source} label={data.sourceLabel} /></div>
      </section>

      <Card>
        <CardHeader title="Pipeline Snapshot" subtitle="Lead counts per internal stage. All stage results are internal tracking only." />
        <CardBody className="flex flex-wrap gap-2">
          {data.pipelineCounts.map((p) => (
            <span key={p.status} className="flex items-center gap-1.5 text-xs text-slate-600">
              <Badge tone={leadToneForStatus(p.status)}>{LEAD_STATUS_LABELS[p.status] ?? p.status}</Badge> ×{p.count}
            </span>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3" aria-label="Recent leads">
        <h2 className="text-sm font-semibold text-slate-900">Lead Inbox</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.leads.slice(0, 4).map((l) => <LeadCard key={l.id} lead={l} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Campaigns">
        <h2 className="text-sm font-semibold text-slate-900">Lead Campaigns</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.campaigns.map((c) => <LeadCampaignCard key={c.id} campaign={c} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Activities">
        <h2 className="text-sm font-semibold text-slate-900">Recent Activities</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.activities.slice(0, 4).map((a) => <LeadActivityCard key={a.id} activity={a} />)}
        </div>
      </section>

      <FlexsPrepPanel />

      <Card>
        <CardHeader title="Quick Actions" subtitle="Actions activate with CRUD and provider phases." />
        <CardBody className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <span key={a.label} className="inline-flex items-center gap-2 rounded-lg bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-400 ring-1 ring-inset ring-slate-200">
              {a.label}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{a.note}</span>
            </span>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
