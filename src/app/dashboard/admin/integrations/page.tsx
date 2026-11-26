import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ModuleHeader } from "@/components/saas/module-header";
import { ConnectorGrid } from "@/components/growth/connector-card";
import { getConnectorStatuses } from "@/lib/growth/status";
import { getProviderStatus as getMetricoolStatus } from "@/lib/integrations/metricool/adapter";
import { METRICOOL_STATE_LABELS, metricoolToneForState } from "@/lib/integrations/metricool/status";
import { getProviderStatus as getUpmindStatus } from "@/lib/integrations/upmind/adapter";
import { UPMIND_STATE_LABELS, upmindToneForState } from "@/lib/integrations/upmind/status";

export const dynamic = "force-dynamic";

// Admin provider registry: Metricool and Upmind adapters, then every connector
// with its real state on this server (the same source as Growth › Connectors).
export default async function AdminIntegrationsPage() {
  const metricool = getMetricoolStatus();
  const upmind = getUpmindStatus();
  const connectors = getConnectorStatuses();
  return (
    <div className="space-y-5">
      <ModuleHeader
        title="Intégrations · Integrations (Admin)"
        description="Chaque fournisseur que TAKATAK peut brancher, avec son état réel sur ce serveur ; les tests en direct se font sur la page de chaque fournisseur · Every provider TAKATAK can connect, with its real state on this server."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Metricool */}
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
        {/* Upmind */}
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
        <Card className="sm:col-span-2">
          <CardBody className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Moteurs IA TAK-TAK · TAK-TAK AI engines</h3>
              <p className="text-xs text-slate-500">Clés, moteurs branchés, agents, crédits et coûts sur un seul écran · Keys, engines, agents, credits and costs on one screen.</p>
            </div>
            <Link href="/dashboard/admin/ai" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
              Centre de contrôle IA · AI Control Center <ArrowRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          Tous les connecteurs · All connectors ({connectors.length})
        </h2>
        <ConnectorGrid connectors={connectors} showSetupDetails />
      </section>
    </div>
  );
}
