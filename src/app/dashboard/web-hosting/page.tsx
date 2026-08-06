import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Globe, Lock, Server, ShieldCheck, Workflow } from "lucide-react";
import { DomainCard } from "@/components/web-hosting/domain-card";
import { HostingServiceCard } from "@/components/web-hosting/hosting-service-card";
import { ProvisioningTimeline } from "@/components/web-hosting/provisioning-timeline";
import { UpmindPrepPanel } from "@/components/web-hosting/upmind-prep-panel";
import { WebHostingHeader } from "@/components/web-hosting/web-hosting-header";
import { WebHostingKpiCard } from "@/components/web-hosting/web-hosting-kpi-card";
import { WebSourceBanner } from "@/components/web-hosting/source-banner";
import { DNS_STATUS_LABELS, SSL_STATUS_LABELS, webToneForStatus } from "@/lib/web-hosting/status";
import { getProviderStatus as getUpmindStatus } from "@/lib/integrations/upmind/adapter";
import { getWebHostingOverviewData } from "@/lib/web-hosting/web-hosting-data";

export const dynamic = "force-dynamic";

const QUICK_ACTIONS = [
  { label: "Search Domain", note: "Coming in Upmind phase" },
  { label: "Add Domain", note: "Coming soon" },
  { label: "Add Hosting Service", note: "Coming soon" },
  { label: "Check DNS", note: "Coming soon" },
  { label: "Request SSL", note: "Coming soon" },
  { label: "Open Upmind Setup", note: "Coming soon" },
];

export default async function WebHostingOverviewPage() {
  const data = await getWebHostingOverviewData();
  const upmind = getUpmindStatus();
  const kpis = [
    { label: "Domains", value: data.kpis.domains, icon: Globe },
    { label: "Hosting Services", value: data.kpis.hostingServices, icon: Server },
    { label: "DNS Warnings", value: data.kpis.dnsWarnings, icon: Workflow },
    { label: "SSL Pending", value: data.kpis.sslPending, icon: Lock },
    { label: "Provisioning Steps", value: data.kpis.provisioningSteps, icon: ShieldCheck },
  ];
  return (
    <div className="space-y-6">
      <WebHostingHeader
        title="Web / Domain / Hosting"
        subtitle="Track domains, hosting, DNS, SSL, and provisioning before Upmind connects."
        badges={[{ label: "Foundation" }, { label: "Upmind not connected", status: "not_configured" }]}
      />

      <section aria-label="KPIs">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {kpis.map((k) => <WebHostingKpiCard key={k.label} label={k.label} value={k.value} icon={k.icon} />)}
        </div>
        <div className="mt-2"><WebSourceBanner source={data.source} label={data.sourceLabel} /></div>
      </section>

      <section className="space-y-3" aria-label="Domain portfolio">
        <h2 className="text-sm font-semibold text-slate-900">Domain Portfolio</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.domains.map((d) => <DomainCard key={d.id} domain={d} />)}
        </div>
      </section>

      <section className="space-y-3" aria-label="Hosting services">
        <h2 className="text-sm font-semibold text-slate-900">Hosting Services</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {data.hostingServices.map((h) => <HostingServiceCard key={h.id} service={h} />)}
        </div>
      </section>

      <Card>
        <CardHeader
          title="DNS / SSL Health"
          subtitle="DNS and SSL are internal foundation tracking only until Upmind/provider sync is connected."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">DNS status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.dnsCounts).map(([s, n]) => (
                <span key={s} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Badge tone={webToneForStatus(s)}>{DNS_STATUS_LABELS[s] ?? s}</Badge> ×{n}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">SSL status</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.sslCounts).map(([s, n]) => (
                <span key={s} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Badge tone={webToneForStatus(s)}>{SSL_STATUS_LABELS[s] ?? s}</Badge> ×{n}
                </span>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <section className="space-y-3" aria-label="Provisioning">
        <h2 className="text-sm font-semibold text-slate-900">Provisioning Timeline</h2>
        <ProvisioningTimeline steps={data.provisioningSteps} />
      </section>

      <UpmindPrepPanel state={upmind.state} />

      <Card>
        <CardHeader title="Quick Actions" subtitle="Actions activate with the database CRUD and Upmind phases." />
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
