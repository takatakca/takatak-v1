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
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

// Admin provider registry: Metricool and Upmind adapters, then every connector
// with its real state on this server (the same source as Growth › Connectors).
export default async function AdminIntegrationsPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const metricool = getMetricoolStatus();
  const upmind = getUpmindStatus();
  const connectors = getConnectorStatuses();
  return (
    <div className="space-y-5">
      <ModuleHeader
        title={fr ? "Intégrations (Admin)" : "Integrations (Admin)"}
        description={
          fr
            ? "Chaque fournisseur que TAKATAK peut brancher, avec son état réel sur ce serveur ; les tests en direct se font sur la page de chaque fournisseur."
            : "Every provider TAKATAK can connect, with its real state on this server; live tests run on each provider’s page."
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Metricool */}
        <Card className="sm:col-span-2">
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Metricool</h3>
                <p className="text-xs text-slate-500">
                  {fr
                    ? "Moteur des réseaux sociaux : planification, publication, statistiques, rapports en marque blanche"
                    : "Social media engine — scheduling, publishing, analytics, white-label reports"}
                </p>
              </div>
              <Badge tone={metricoolToneForState(metricool.state)}>{adminFr(METRICOOL_STATE_LABELS[metricool.state], fr)}</Badge>
            </div>
            <p className="text-xs text-slate-500">{adminFr(metricool.message, fr)}</p>
            <Link
              href="/dashboard/admin/integrations/metricool"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              {fr ? "Ouvrir l’intégration Metricool" : "Open Metricool integration"} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
        {/* Upmind */}
        <Card className="sm:col-span-2">
          <CardBody className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Upmind</h3>
                <p className="text-xs text-slate-500">
                  {fr
                    ? "Moteur web, domaines et hébergement : domaines, forfaits, activation, factures, soutien"
                    : "Web / domain / hosting engine — domains, plans, provisioning, invoices, support desk"}
                </p>
              </div>
              <Badge tone={upmindToneForState(upmind.state)}>{adminFr(UPMIND_STATE_LABELS[upmind.state], fr)}</Badge>
            </div>
            <p className="text-xs text-slate-500">{adminFr(upmind.message, fr)}</p>
            <Link
              href="/dashboard/admin/integrations/upmind"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500"
            >
              {fr ? "Ouvrir l’intégration Upmind" : "Open Upmind integration"} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
        <Card className="sm:col-span-2">
          <CardBody className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{fr ? "Moteurs IA TAK-TAK" : "TAK-TAK AI engines"}</h3>
              <p className="text-xs text-slate-500">
                {fr ? "Clés, moteurs branchés, agents, crédits et coûts sur un seul écran." : "Keys, engines, agents, credits and costs on one screen."}
              </p>
            </div>
            <Link href="/dashboard/admin/ai" className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500">
              {fr ? "Centre de contrôle IA" : "AI Control Center"} <ArrowRight className="h-3 w-3" />
            </Link>
          </CardBody>
        </Card>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {fr ? "Tous les connecteurs" : "All connectors"} ({connectors.length})
        </h2>
        <ConnectorGrid connectors={connectors} showSetupDetails />
      </section>
    </div>
  );
}
