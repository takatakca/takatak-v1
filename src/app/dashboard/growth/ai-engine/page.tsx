import { randomUUID } from "node:crypto";
import Link from "next/link";
import { GrantCreditsForm } from "@/components/growth/grant-credits-form";
import { GrowthHeader, GrowthKpi, HonestyNote } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { AI_AGENTS, AI_CREDIT_ACTIONS, AI_CREDIT_PACKS, AI_GATEWAY_ENV, AI_PROVIDERS } from "@/lib/growth/ai-engine";
import { connectorByKey } from "@/lib/growth/connectors";
import { getAiEngineStatus } from "@/lib/growth/status";
import { getCreditSnapshot, listClientBalances, type CreditSnapshot } from "@/lib/ai-credits/ledger";

export const dynamic = "force-dynamic";

const cad = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default async function AiEnginePage() {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/ai-engine");
  let credits: CreditSnapshot | null = null;
  let adminClients: Array<{ id: string; name: string; balance: number }> | null = null;
  let ledgerUnavailable = false;
  try {
    if (access.mode === "client_scoped") credits = await getCreditSnapshot(access.activeClientId);
    if (access.mode === "platform_admin") adminClients = await listClientBalances();
  } catch {
    ledgerUnavailable = true;
    console.error("[ai-credits] snapshot unavailable");
  }
  const status = getAiEngineStatus();
  const configured = new Set(status.providers.filter((p) => p.configured).map((p) => p.key));

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="AI Engine & Credits"
        description="Every AI task (posts, replies, ads, audits, videos) runs through the TAKATAK AI Gateway, which picks the best of 13 engines and bills clients in credits."
        actions={
          <Link href="/dashboard/ai-studio" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300">
            AI Studio →
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <GrowthKpi label="AI Gateway" value={status.gateway.configured ? "Configured" : "Not configured"} hint="Your own backend" />
        <GrowthKpi label="Engines with keys" value={`${status.configuredCount} / ${AI_PROVIDERS.length}`} hint="On this server" />
        <GrowthKpi label="Autopilot agents" value={String(AI_AGENTS.length)} hint="Approval-gated" />
        <GrowthKpi label="Credit actions" value={String(AI_CREDIT_ACTIONS.length)} hint="Priced per task" />
      </section>

      {credits ? (
        <Card>
          <CardHeader title="Your AI credits" subtitle="Live balance. Every AI task the gateway runs is debited here with its own receipt." />
          <CardBody className="space-y-4">
            <p className="text-3xl font-bold text-slate-950">
              {credits.balance.toLocaleString("en-CA")} <span className="text-base font-medium text-slate-500">credits</span>
            </p>
            {credits.entries.length ? (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs">
                {credits.entries.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className={`w-16 font-semibold ${e.delta > 0 ? "text-emerald-700" : "text-slate-900"}`}>
                      {e.delta > 0 ? "+" : ""}
                      {e.delta}
                    </span>
                    <span className="text-slate-700">{e.actionKey ? AI_CREDIT_ACTIONS.find((a) => a.key === e.actionKey)?.label ?? e.actionKey : e.reason}</span>
                    {e.note ? <span className="text-slate-400">· {e.note}</span> : null}
                    <span className="ml-auto text-slate-400">
                      {e.createdAt.toLocaleString("en-CA")} · bal. {e.balanceAfter}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No credit activity yet.</p>
            )}
          </CardBody>
        </Card>
      ) : null}

      {adminClients ? (
        <Card>
          <CardHeader title="Grant AI credits" subtitle="Platform admin. Each submission is recorded in the client’s ledger and can never apply twice." />
          <CardBody>
            <GrantCreditsForm clients={adminClients} nonce={randomUUID()} />
          </CardBody>
        </Card>
      ) : null}

      {ledgerUnavailable ? <HonestyNote>The credit ledger is not reachable right now. Balances are hidden rather than guessed.</HonestyNote> : null}

      <Card>
        <CardHeader
          title="TAKATAK AI Gateway"
          subtitle="The dashboard sends tasks to the gateway. The gateway holds the provider keys, routes to a model, meters usage and debits credits."
          action={<Badge tone={status.gateway.configured ? "accent" : "warning"}>{status.gateway.configured ? "Configured — untested" : "Not configured"}</Badge>}
        />
        <CardBody className="space-y-3 text-xs leading-5 text-slate-600">
          <ol className="grid gap-2 md:grid-cols-4">
            {[
              ["Task", "A module asks for work (e.g. “write this week’s posts”)."],
              ["Route", "The gateway chooses the engine by task, language, cost and quality."],
              ["Approve", "Anything that publishes or spends waits for human approval."],
              ["Bill", "Credits are debited per action and shown on the client’s balance."],
            ].map(([title, detail], i) => (
              <li key={title} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <p className="font-semibold text-slate-800">
                  {i + 1}. {title}
                </p>
                <p className="mt-0.5">{detail}</p>
              </li>
            ))}
          </ol>
          {showSetupDetails && !status.gateway.configured ? (
            <p className="font-mono text-[10px] text-slate-400">Needs: {AI_GATEWAY_ENV.join(", ")}</p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="AI roster" subtitle="13 engines. Edit the roster in src/lib/growth/ai-engine.ts to match the gateway." />
        <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {AI_PROVIDERS.map((p) => (
            <div key={p.key} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                <Badge tone={configured.has(p.key) ? "accent" : "muted"}>{configured.has(p.key) ? "Key set" : "No key"}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{p.bestFor}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{p.capabilities.join(" · ")}</p>
              {showSetupDetails && !configured.has(p.key) ? <p className="mt-1 font-mono text-[10px] text-slate-400">{p.env}</p> : null}
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Autopilot agents" subtitle="Agents work for the client around the clock. Publishing and spending always need approval." />
        <CardBody className="grid gap-3 lg:grid-cols-2">
          {AI_AGENTS.map((agent) => (
            <div key={agent.key} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{agent.mission}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Triggers:</span> {agent.triggers.join(", ")}
              </p>
              <p className="text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">Uses:</span>{" "}
                {agent.connectorKeys.map((k) => connectorByKey(k)?.name ?? k).join(", ")}
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Credit cost per action" />
          <CardBody className="p-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Module</th>
                  <th className="px-4 py-2 text-right font-medium">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {AI_CREDIT_ACTIONS.map((a) => (
                  <tr key={a.key}>
                    <td className="px-4 py-2 text-slate-800">{a.label}</td>
                    <td className="px-4 py-2 text-slate-500">{a.module}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{a.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Credit packs" subtitle="Draft pricing in CAD. Checkout is not enabled yet." />
          <CardBody className="grid grid-cols-2 gap-3">
            {AI_CREDIT_PACKS.map((pack) => (
              <div key={pack.key} className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{pack.label}</p>
                <p className="mt-1 text-lg font-bold text-slate-950">{pack.credits.toLocaleString("en-CA")} credits</p>
                <p className="text-sm text-slate-700">{cad.format(pack.priceCad)}</p>
                <p className="text-[11px] text-slate-400">{cad.format(pack.priceCad / pack.credits)} / credit</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <HonestyNote>
        This page makes no AI calls. Provider status means a key exists on this server, not that the engine was tested. The gateway debits
        credits through POST /api/ai/credits/debit (bearer TAKATAK_AI_GATEWAY_TOKEN); the cost always comes from the table above.
      </HonestyNote>
    </div>
  );
}
