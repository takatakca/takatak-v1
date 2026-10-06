import Link from "next/link";
import { GrowthHeader, GrowthKpi } from "@/components/growth/growth-header";
import { ConnectorStateBadge } from "@/components/growth/connector-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { GROWTH_MODULES } from "@/lib/growth/modules";
import { GROWTH_STAGES } from "@/lib/growth/plans";
import { getAiEngineStatus, getConnectorStatusMap, getConnectorStatuses } from "@/lib/growth/status";

export const dynamic = "force-dynamic";

export default async function GrowthHubPage() {
  await requireGrowthAccess("/dashboard/growth");
  const connectors = getConnectorStatuses();
  const byKey = getConnectorStatusMap();
  const ai = getAiEngineStatus();
  const external = connectors.filter((c) => c.state !== "built_in" && c.state !== "planned");
  const credentialed = external.filter((c) => c.state === "configured_untested").length;
  const builtIn = connectors.filter((c) => c.state === "built_in").length;

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Growth Hub"
        description="One place to take a business from its first domain to marketing run by AI. Each step lights up as its connectors are wired."
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <GrowthKpi label="Connectors in catalog" value={String(connectors.length)} hint="Domains to payments" />
        <GrowthKpi label="Credentials set" value={`${credentialed} / ${external.length}`} hint="Presence only — untested" />
        <GrowthKpi label="Built-in engines" value={String(builtIn)} hint="Run without third-party keys" />
        <GrowthKpi label="AI engines wired" value={`${ai.configuredCount} / ${ai.providers.length}`} hint={ai.gateway.configured ? "Gateway configured" : "Gateway not configured"} />
      </section>

      <Card>
        <CardHeader title="The TAKATAK journey" subtitle="Domain → Hosting → Social → Marketing → AI. Each client moves left to right." />
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
                      {ready}/{stageConnectors.length} connectors ready
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
        <CardHeader title="Built-in engines" subtitle="Working today without any third-party credentials." />
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
