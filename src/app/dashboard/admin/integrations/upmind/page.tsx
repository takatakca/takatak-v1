import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ModuleHeader } from "@/components/saas/module-header";
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";
import { UpmindTestPanel } from "@/components/integrations/upmind-test-panel";
import { getUpmindEnvStatus } from "@/lib/integrations/upmind/env";
import { getUpmindReadiness } from "@/lib/integrations/upmind/upmind-service";
import { UPMIND_STATE_LABELS, upmindToneForState } from "@/lib/integrations/upmind/status";

export const dynamic = "force-dynamic";

const CREDENTIALS: { name: string; required: boolean }[] = [
  { name: "UPMIND_API_KEY", required: true },
  { name: "UPMIND_KEY", required: false },
  { name: "UPMIND_API_BASE_URL", required: true },
  { name: "NEXT_PUBLIC_UPMIND_BRAND_ID", required: false },
  { name: "UPMIND_TEST_ENDPOINT", required: false },
  { name: "UPMIND_WEBHOOK_SECRET", required: false },
  { name: "UPMIND_WEBHOOK_ENABLED", required: false },
];

const CAPABILITIES = [
  "Domain search", "Hosting plan cards", "Product catalogue", "Client services",
  "Invoices", "Provisioning automation", "Service desk", "Webhooks", "Headless client portal (later)",
];

const CAPABILITIES_FR: Record<string, string> = {
  "Domain search": "Recherche de domaines",
  "Hosting plan cards": "Cartes des forfaits d’hébergement",
  "Product catalogue": "Catalogue de produits",
  "Client services": "Services des clients",
  Invoices: "Factures",
  "Provisioning automation": "Activation automatique",
  "Service desk": "Centre de soutien",
  Webhooks: "Webhooks",
  "Headless client portal (later)": "Portail client sans interface (plus tard)",
};

const PLANNED_JOBS = ["product sync", "client service sync", "invoice sync", "provisioning sync", "domain status sync"];

export default async function AdminUpmindPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const env = getUpmindEnvStatus();
  const readiness = await getUpmindReadiness();
  const present = (name: string) => {
    switch (name) {
      case "UPMIND_API_KEY":
        return Boolean(process.env.UPMIND_API_KEY || process.env.UPMIND_KEY);
      case "UPMIND_KEY":
        return Boolean(process.env.UPMIND_KEY);
      case "UPMIND_API_BASE_URL":
        return !env.missing.includes(name);
      case "NEXT_PUBLIC_UPMIND_BRAND_ID":
        return Boolean(process.env.NEXT_PUBLIC_UPMIND_BRAND_ID);
      case "UPMIND_TEST_ENDPOINT": return env.hasTestEndpoint;
      case "UPMIND_WEBHOOK_SECRET": return env.hasWebhookSecret;
      case "UPMIND_WEBHOOK_ENABLED": return env.webhookEnabled;
      default: return false;
    }
  };
  return (
    <div className="space-y-5">
      <ModuleHeader
        title={fr ? "Intégration Upmind" : "Upmind Integration"}
        description={adminFr(readiness.message, fr)}
        statuses={[]}
        actions={<Badge tone={upmindToneForState(readiness.state)}>{adminFr(UPMIND_STATE_LABELS[readiness.state], fr)}</Badge>}
      />

      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <p className="text-xs leading-relaxed text-amber-800">
          {fr
            ? "Le paiement des domaines passe par le module Upmind. Les webhooks peuvent inscrire les domaines payés dans l’espace TAKATAK correspondant. La modification DNS, l’installation SSL et l’activation de l’hébergement ne sont pas encore actives."
            : "Domain checkout uses the Upmind widget. Webhooks can record paid domains on the matching TAKATAK workspace. DNS editing, SSL installation, and hosting provisioning are not active yet."}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={fr ? "Tester la connexion" : "Test connection"} subtitle={fr ? "Fait une vraie requête seulement quand tout l’environnement de test en direct est configuré." : "Runs a real request only when the full live-test environment is configured."} />
          <CardBody><UpmindTestPanel /></CardBody>
        </Card>
        <Card>
          <CardHeader
            title={fr ? "Préparation des webhooks" : "Webhook readiness"}
            subtitle={fr ? "Les événements vérifiés peuvent créer ou mettre à jour des lignes DomainAsset." : "Verified events can create or update DomainAsset rows."}
          />
          <CardBody className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              Webhooks :{" "}
              <Badge tone={env.webhookEnabled ? "accent" : "muted"}>{env.webhookEnabled ? (fr ? "Activés" : "Enabled") : fr ? "Désactivés" : "Disabled"}</Badge>
              {fr ? "Secret :" : "Secret:"}{" "}
              <Badge tone={env.hasWebhookSecret ? "success" : "warning"}>{env.hasWebhookSecret ? (fr ? "Présent" : "Present") : fr ? "Manquant" : "Missing"}</Badge>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">
              {fr
                ? "Les POST reçus doivent contenir X-Webhook-Signature (HMAC-SHA256 du contenu brut). Les événements de domaine payé et activé ajoutent ou mettent à jour un domaine dans l’espace TAKATAK correspondant. Le contenu brut n’est jamais inscrit aux journaux."
                : "Incoming POSTs must include X-Webhook-Signature (HMAC-SHA256 of the raw body). Paid and provisioned domain events upsert a domain on the matching TAKATAK workspace. The raw body is never logged."}
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={fr ? "Fonctions à venir" : "Capability roadmap"}
            subtitle={fr ? "Tout ce qui suit s’active seulement après une connexion vérifiée." : "Everything below activates only after a verified connection."}
          />
          <CardBody className="grid gap-2 sm:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <div key={c} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs font-medium text-slate-700">
                {fr ? (CAPABILITIES_FR[c] ?? c) : c}
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={fr ? "Tâches prévues" : "Planned jobs"}
            subtitle={fr ? "Prévues seulement : aucun exécuteur ne tourne encore." : "Planned only — no workers run in Phase 8."}
          />
          <CardBody className="space-y-2">
            {PLANNED_JOBS.map((j) => (
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
