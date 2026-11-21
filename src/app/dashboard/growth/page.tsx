import Link from "next/link";
import { GrowthHeader, GrowthKpi } from "@/components/growth/growth-header";
import { ConnectorStateBadge } from "@/components/growth/connector-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { GROWTH_MODULES } from "@/lib/growth/modules";
import { GROWTH_STAGES } from "@/lib/growth/plans";
import { getConnectorStatusMap, getConnectorStatuses } from "@/lib/growth/status";
import { getGrowthReport, monthRange } from "@/lib/growth/report";
import { TAKBOT_ENGINES } from "@/lib/takbot/catalog";
import { connectedEngines } from "@/lib/takbot/server";

export const dynamic = "force-dynamic";

export default async function GrowthHubPage() {
  const { access } = await requireGrowthAccess("/dashboard/growth");
  const connectors = getConnectorStatuses();
  const byKey = getConnectorStatusMap();
  // A client sees its own numbers for this month; staff without a workspace see the catalog.
  const month = monthRange(null);
  const report = access.mode === "client_scoped" ? await getGrowthReport(access.activeClientId, month.key).catch(() => null) : null;
  const engines = await connectedEngines().catch(() => new Set<string>());
  const enginesConnected = TAKBOT_ENGINES.filter((engine) => engines.has(engine.key)).length;
  const external = connectors.filter((c) => c.state !== "built_in" && c.state !== "planned");
  const credentialed = external.filter((c) => c.state === "configured_untested").length;
  const builtIn = connectors.filter((c) => c.state === "built_in").length;

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Centre de croissance · Growth Hub"
        description="Votre croissance au même endroit, du domaine au marketing par l’IA · Your growth in one place, from your domain to AI-run marketing."
      />

      {report ? (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Ce mois-ci · This month">
          <GrowthKpi label="Visites du site · Website visits" value={report.current.visits.toLocaleString("fr-CA")} hint={month.label} />
          <GrowthKpi label="Actions de contact · Contact actions" value={report.current.conversions.toLocaleString("fr-CA")} hint="Appels, formulaires, WhatsApp · Calls, forms" />
          <GrowthKpi label="Nouveaux prospects · New leads" value={report.current.leads.toLocaleString("fr-CA")} hint={month.label} />
          <GrowthKpi
            label="Nouveaux avis · New reviews"
            value={report.current.ratings.toLocaleString("fr-CA")}
            hint={report.current.averageRating !== null ? `Note moyenne ${report.current.averageRating.toFixed(1)} / 5` : month.label}
          />
        </section>
      ) : (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Catalogue · Catalog">
          <GrowthKpi label="Connecteurs · Connectors" value={String(connectors.length)} hint="Du domaine aux paiements · Domains to payments" />
          <GrowthKpi label="Clés posées · Keys set" value={`${credentialed} / ${external.length}`} hint="Présence seulement · Presence only" />
          <GrowthKpi label="Moteurs intégrés · Built-in engines" value={String(builtIn)} hint="Sans clé externe · No third-party key" />
          <GrowthKpi label="Moteurs IA branchés · AI engines" value={`${enginesConnected} / ${TAKBOT_ENGINES.length}`} hint="TAK-TAK" />
        </section>
      )}

      <Card>
        <CardHeader title="Le parcours TAKATAK · The TAKATAK journey" subtitle="Domaine → Hébergement → Réseaux sociaux → Marketing → IA · Domain → Hosting → Social → Marketing → AI." />
        <CardBody>
          <ol className="grid gap-3 md:grid-cols-5">
            {GROWTH_STAGES.map((stage) => {
              const stageConnectors = stage.connectorKeys.flatMap((k) => byKey.get(k) ?? []);
              const ready = stageConnectors.filter((c) => c.state === "built_in" || c.state === "configured_untested").length;
              return (
                <li key={stage.key}>
                  <Link href={stage.href} className="flex h-full flex-col rounded-xl border border-slate-200 bg-slate-50/50 p-3 hover:border-indigo-300 hover:bg-white">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{stage.step}</span>
                    <span className="mt-2 text-sm font-semibold text-slate-900">{stage.title}</span>
                    <span className="mt-1 flex-1 text-xs leading-5 text-slate-600">{stage.summary}</span>
                    <span className="mt-2 text-[11px] text-slate-400">
                      {ready}/{stageConnectors.length} connecteurs prêts · ready
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {GROWTH_MODULES.map((m) => (
          <Link key={m.href} href={m.href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-300">
            <p className="text-sm font-semibold text-slate-900">{m.title} →</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{m.summary}</p>
          </Link>
        ))}
      </section>

      <Card>
        <CardHeader title="Moteurs intégrés · Built-in engines" subtitle="En marche aujourd’hui, sans clé externe · Working today without third-party keys." />
        <CardBody className="flex flex-wrap gap-3">
          {connectors
            .filter((c) => c.state === "built_in")
            .map((c) => (
              <Link key={c.key} href={c.managedIn ?? "/dashboard/growth/connectors"} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 hover:border-indigo-300">
                {c.name} <ConnectorStateBadge state={c.state} />
              </Link>
            ))}
        </CardBody>
      </Card>
    </div>
  );
}
