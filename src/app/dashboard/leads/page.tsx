import { Activity, Inbox, Megaphone, Target, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { QuickLinks } from "@/components/dashboard/quick-links";
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
  { label: "Boîte de réception · Inbox", href: "/dashboard/leads/inbox" },
  { label: "Pipeline", href: "/dashboard/leads/pipeline" },
  { label: "Contacts", href: "/dashboard/leads/contacts" },
  { label: "Sources", href: "/dashboard/leads/sources" },
  { label: "Campagnes · Campaigns", href: "/dashboard/leads/campaigns" },
  { label: "Activités · Activities", href: "/dashboard/leads/activities" },
  { label: "Demander à l’équipe · Ask the team", href: "/dashboard/support" },
];

export default async function LeadsOverviewPage() {
  const data = await getLeadsOverviewData();
  const kpis = [
    { label: "Prospects · Leads", value: data.kpis.leads, icon: Users },
    { label: "Sources", value: data.kpis.sources, icon: Inbox },
    { label: "Campagnes · Campaigns", value: data.kpis.campaigns, icon: Megaphone },
    { label: "Suivis prévus · Follow-ups", value: data.kpis.followUpsPlanned, icon: Activity },
    { label: "Qualifiés · Qualified", value: data.kpis.qualifiedLeads, icon: Target },
  ];
  return (
    <div className="space-y-6">
      <LeadsHeader
        title="Prospects · Leads"
        subtitle="Toutes les demandes de votre site et de vos campagnes au même endroit : réception, pipeline et suivis · Every request from your website and campaigns in one place."
      />

      <section aria-label="Leads KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => <LeadsKpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} />)}
        </div>
        <div className="mt-2"><LeadsSourceBanner source={data.source} label={data.sourceLabel} /></div>
      </section>

      <Card>
        <CardHeader title="Pipeline" subtitle="Combien de prospects à chaque étape · How many leads at each stage." />
        <CardBody className="flex flex-wrap gap-2">
          {data.pipelineCounts.map((p) => (
            <span key={p.status} className="flex items-center gap-1.5 text-xs text-slate-600">
              <Badge tone={leadToneForStatus(p.status)}>{LEAD_STATUS_LABELS[p.status] ?? p.status}</Badge> ×{p.count}
            </span>
          ))}
        </CardBody>
      </Card>

      <section className="space-y-3" aria-label="Recent leads">
        <h2 className="text-sm font-semibold text-slate-900">Boîte de réception · Inbox</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.leads.slice(0, 4).map((l) => <LeadCard key={l.id} lead={l} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Campaigns">
        <h2 className="text-sm font-semibold text-slate-900">Campagnes · Campaigns</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.campaigns.map((c) => <LeadCampaignCard key={c.id} campaign={c} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Activities">
        <h2 className="text-sm font-semibold text-slate-900">Activités récentes · Recent activities</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.activities.slice(0, 4).map((a) => <LeadActivityCard key={a.id} activity={a} />)}
        </div>
      </section>

      <QuickLinks links={QUICK_ACTIONS} />
    </div>
  );
}
