import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ModuleHeader } from "@/components/saas/module-header";
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";
import { MetricoolTestPanel } from "@/components/integrations/metricool-test-panel";
import { getMetricoolEnvStatus } from "@/lib/integrations/metricool/env";
import { getMetricoolReadiness } from "@/lib/integrations/metricool/metricool-service";
import { METRICOOL_STATE_LABELS, metricoolToneForState } from "@/lib/integrations/metricool/status";

export const dynamic = "force-dynamic";

const CREDENTIALS: { name: string; required: boolean }[] = [
  { name: "METRICOOL_API_KEY", required: true },
  { name: "METRICOOL_ACCOUNT_ID", required: true },
  { name: "METRICOOL_API_BASE_URL", required: false },
  { name: "METRICOOL_TEST_ENDPOINT", required: false },
  { name: "METRICOOL_WHITE_LABEL_BASE_URL", required: false },
];

const CAPABILITIES = [
  { name: "Account mapping", nameFr: "Association des comptes", phase: "Phase 6/7", phaseFr: "Phase 6/7" },
  { name: "Send approved posts", nameFr: "Envoyer les publications approuvées", phase: "Post-verification", phaseFr: "Après vérification" },
  { name: "Sync analytics", nameFr: "Synchroniser les statistiques", phase: "Post-verification", phaseFr: "Après vérification" },
  { name: "Reports", nameFr: "Rapports", phase: "Phase 12", phaseFr: "Phase 12" },
  { name: "Calendar", nameFr: "Calendrier", phase: "Post-verification", phaseFr: "Après vérification" },
  { name: "White-label view", nameFr: "Vue en marque blanche", phase: "Later", phaseFr: "Plus tard" },
];

export default async function AdminMetricoolPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const env = getMetricoolEnvStatus();
  const readiness = await getMetricoolReadiness();
  const present = (name: string) => {
    switch (name) {
      case "METRICOOL_API_KEY": return env.configured || !env.missing.includes(name);
      case "METRICOOL_ACCOUNT_ID": return env.configured || !env.missing.includes(name);
      case "METRICOOL_API_BASE_URL": return env.hasApiBaseUrl;
      case "METRICOOL_TEST_ENDPOINT": return env.hasTestEndpoint;
      case "METRICOOL_WHITE_LABEL_BASE_URL": return env.hasWhiteLabelUrl;
      default: return false;
    }
  };
  return (
    <div className="space-y-5">
      <ModuleHeader
        title={fr ? "Intégration Metricool" : "Metricool Integration"}
        description={adminFr(readiness.message, fr)}
        statuses={[]}
        actions={<Badge tone={metricoolToneForState(readiness.state)}>{adminFr(METRICOOL_STATE_LABELS[readiness.state], fr)}</Badge>}
      />

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs leading-relaxed text-amber-800">
          {fr
            ? "Aucune publication ni synchronisation des statistiques n’est active. Les points d’accès ne sont jamais devinés : l’URL de base de l’API et le point de test restent vides tant qu’ils ne sont pas confirmés par la documentation officielle de Metricool."
            : "No publishing or analytics sync is active in Phase 6. Endpoints are never guessed — the API base URL and test endpoint stay empty until confirmed from official Metricool documentation."}
        </p>
      </div>

      <Card>
        <CardHeader
          title={fr ? "Liste des identifiants" : "Credential checklist"}
          subtitle={fr ? "Présence seulement : les valeurs ne sont jamais affichées ni inscrites aux journaux." : "Presence only — values are never displayed or logged."}
        />
        <CardBody className="divide-y divide-slate-100 p-0">
          {CREDENTIALS.map((c) => (
            <div key={c.name} className="flex items-center gap-3 px-5 py-2.5">
              <code className="flex-1 text-xs text-slate-700">{c.name}</code>
              <span className="text-[10px] uppercase tracking-wide text-slate-400">{c.required ? (fr ? "Requis" : "Required") : fr ? "Facultatif" : "Optional"}</span>
              <Badge tone={present(c.name) ? "success" : "warning"}>{present(c.name) ? (fr ? "Présent" : "Present") : fr ? "Manquant" : "Missing"}</Badge>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={fr ? "Tester la connexion" : "Test connection"} subtitle={fr ? "Fait une vraie requête seulement quand tout l’environnement de test en direct est configuré." : "Runs a real request only when the full live-test environment is configured."} />
        <CardBody>
          <MetricoolTestPanel />
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={fr ? "Fonctions à venir" : "Capability roadmap"}
            subtitle={fr ? "Tout ce qui suit s’active seulement après une connexion vérifiée." : "Everything below activates only after a verified connection."}
          />
          <CardBody className="grid gap-2 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <div key={c.name} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700">
                {fr ? c.nameFr : c.name}{" "}
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">· {fr ? c.phaseFr : c.phase}</span>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={fr ? "Tâches prévues" : "Planned jobs"}
            subtitle={fr ? "Prévues seulement : aucun exécuteur ne tourne encore." : "Planned only — no workers run in Phase 6."}
          />
          <CardBody className="space-y-2">
            {["send_to_metricool", "sync_analytics"].map((j) => (
              <div key={j} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <code className="text-xs text-slate-700">{j}</code>
                <Badge tone="accent">{fr ? "Prévue" : "Planned"}</Badge>
              </div>
            ))}
            {readiness.dbSource === "database" && readiness.dbAccounts.length ? (
              <p className="text-[11px] text-slate-400">
                {fr ? "Comptes d’intégration en base :" : "DB integration accounts:"} {readiness.dbAccounts.map((a) => `${a.clientName} (${a.status.replaceAll("_", " ")})`).join(", ")}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400">
                {fr
                  ? "Les fiches d’intégration de la base de données apparaissent ici quand la base est configurée."
                  : "Database integration records appear here when the DB is configured."}
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
