import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/saas/status-badge";
import { Card, CardBody } from "@/components/ui/card";
import { ModuleHeader } from "@/components/saas/module-header";
import { INTEGRATIONS } from "@/lib/data/mock-data";
import { getProviderStatus as getMetricoolStatus } from "@/lib/integrations/metricool/adapter";
import { METRICOOL_STATE_LABELS, metricoolToneForState } from "@/lib/integrations/metricool/status";
import { getProviderStatus as getUpmindStatus } from "@/lib/integrations/upmind/adapter";
import { getAiProviderStatuses } from "@/lib/ai/providers";
import { AI_PROVIDER_STATE_LABELS, aiToneForStatus } from "@/lib/ai/status";
import { UPMIND_STATE_LABELS, upmindToneForState } from "@/lib/integrations/upmind/status";

export const dynamic = "force-dynamic";

// Admin provider registry. Only Metricool has Phase 6 foundation detail.
export default async function AdminIntegrationsPage() {
  const metricool = getMetricoolStatus();
  const upmind = getUpmindStatus();
  const aiProviders = getAiProviderStatuses();
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Integrations (Admin)"
        description="Provider registry with honest connection states. Metricool (Phase 6) and Upmind (Phase 8) have integration foundations; OpenAI/TryHolo show AI-layer readiness (Phase 9); all others remain planned."
        statuses={["foundation"]}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Metricool — expanded Phase 6 card */}
        <Card className="sm:col-span-2">
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Metricool</h3>
                <p className="text-xs text-slate-500">Social media engine — scheduling, publishing, analytics, white-label reports</p>
              </div>
              <Badge tone={metricoolToneForState(metricool.state)}>{METRICOOL_STATE_LABELS[metricool.state]}</Badge>
            </div>
            <p className="text-xs text-slate-500">{metricool.message}</p>
            <Link
              href="/dashboard/admin/integrations/metricool"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              Open Metricool integration <ArrowRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
        {/* Upmind — expanded Phase 8 card */}
        <Card className="sm:col-span-2">
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Upmind</h3>
                <p className="text-xs text-slate-500">Web / domain / hosting engine — domains, plans, provisioning, invoices, support desk</p>
              </div>
              <Badge tone={upmindToneForState(upmind.state)}>{UPMIND_STATE_LABELS[upmind.state]}</Badge>
            </div>
            <p className="text-xs text-slate-500">{upmind.message}</p>
            <Link
              href="/dashboard/admin/integrations/upmind"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              Open Upmind integration <ArrowRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
        {/* Other providers — planned/not connected */}
        {aiProviders.map((p) => (
          <Card key={p.provider}>
            <CardBody className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{p.provider === "openai" ? "OpenAI" : "TryHolo"}</h3>
                <Badge tone={aiToneForStatus(p.state)}>{AI_PROVIDER_STATE_LABELS[p.state]}</Badge>
              </div>
              <p className="text-xs text-slate-500">{p.message}</p>
              <p className="text-[11px] text-slate-400">AI layer provider — readiness only, no calls (Phase 9)</p>
            </CardBody>
          </Card>
        ))}
        {INTEGRATIONS.filter((i) => !["metricool", "upmind", "tryholo"].includes(i.provider)).map((i) => (
          <Card key={i.id}>
            <CardBody className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{i.displayName}</h3>
                <StatusBadge status={i.status} />
              </div>
              <p className="text-xs text-slate-500">{i.purpose}</p>
              <p className="text-[11px] text-slate-400">Unlocks in {i.activationPhase}</p>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
