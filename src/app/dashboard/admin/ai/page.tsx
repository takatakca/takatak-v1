import Link from "next/link";
import { ArrowRight, Bot, CircleDollarSign, Cpu, KeyRound, Sparkles, Workflow } from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getAiControlSnapshot, type AiControlEngine } from "@/lib/admin/ai-control";
import { CATEGORY_LABELS, type AiProviderCategory } from "@/lib/ai-providers/catalog";
import type { ProviderKeyState } from "@/lib/ai-providers/store";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

// Owner's request (Nov 2026): every AI in TAKATAK on one screen, for the
// platform owner and admins, with real production state only.

const KEY_STATE: Record<ProviderKeyState, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "muted" }> = {
  verified: { label: "Key works (tested)", tone: "success" },
  saved_untested: { label: "Saved, not tested", tone: "warning" },
  check_failed: { label: "Test failed", tone: "danger" },
  no_automatic_check: { label: "Saved, no automatic test", tone: "neutral" },
  env_only: { label: "Server variable", tone: "neutral" },
  not_configured: { label: "No key", tone: "muted" },
};

const RUN_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "muted"> = {
  completed: "success",
  approved: "success",
  awaiting_approval: "warning",
  queued: "neutral",
  running: "neutral",
  executing: "neutral",
  failed: "danger",
  rejected: "muted",
  canceled: "muted",
};

const CATEGORY_ORDER: AiProviderCategory[] = ["text", "voice", "video", "image", "music", "builder"];

const AI_SCREENS = [
  { href: "/dashboard/admin/ai-providers", label: "Clés des fournisseurs · Provider keys", note: "Enter, test and remove each provider key." },
  { href: "/dashboard/growth/ai-engine", label: "Moteur IA et crédits · AI Engine & credits", note: "Gateway, credit packs, grant credits to a workspace." },
  { href: "/dashboard/ai-studio", label: "AI Studio", note: "Brand voices, saved drafts, content generator." },
  { href: "/dashboard/ai-studio/usage", label: "Utilisation et coût · Usage & cost", note: "Credit balance and estimated cost." },
  { href: "/dashboard/studio", label: "TAKATAKSTUDIO", note: "Scripts, outlines and lyrics with TAK-TAK." },
  { href: "/dashboard/admin/integration-events", label: "Événements · Provider events", note: "Webhooks and provider tests." },
  { href: "/dashboard/admin/system-health", label: "Santé du système · System health", note: "Server settings and capability status." },
];

const dateTime = new Intl.DateTimeFormat("fr-CA", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto" });
const number = new Intl.NumberFormat("fr-CA");

function when(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : "—";
}

function Kpi({ label, value, hint, icon: Icon }: { label: string; value: string; hint?: string; icon: typeof Bot }) {
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
          {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
        </div>
      </CardBody>
    </Card>
  );
}

function EngineRow({ engine }: { engine: AiControlEngine }) {
  const state = KEY_STATE[engine.keyState];
  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 pr-3 text-sm font-medium text-slate-900">{engine.name}</td>
      <td className="py-2 pr-3">
        <Badge tone={engine.connected ? "success" : "muted"}>{engine.connected ? "Connected" : "Not connected"}</Badge>
      </td>
      <td className="py-2 pr-3">
        <Badge tone={state.tone}>{state.label}</Badge>
        {engine.keyHint ? <span className="ml-2 font-mono text-[11px] text-slate-500">••••{engine.keyHint}</span> : null}
      </td>
      <td className="py-2 pr-3 text-xs text-slate-600">{engine.inTakbot ? "TAK-TAK" : "—"}</td>
      <td className="py-2 pr-3 text-xs text-slate-600">{engine.billableToClients ? "Credits" : "Internal"}</td>
      <td className="py-2 text-xs text-slate-500">{when(engine.lastCheckedAt)}</td>
    </tr>
  );
}

export default async function AiControlCenterPage() {
  await requireAdminAccess();
  const snapshot = await getAiControlSnapshot();
  const { engines, switches, credits, agents, recentRuns } = snapshot;

  const connected = engines.filter((engine) => engine.connected).length;
  const verified = engines.filter((engine) => engine.keyState === "verified").length;
  const takbot = engines.filter((engine) => engine.inTakbot);
  const takbotConnected = takbot.filter((engine) => engine.connected).length;
  const runs30d = agents.reduce((total, agent) => total + agent.runs30d, 0);
  const waiting = agents.reduce((total, agent) => total + agent.awaitingApproval, 0);
  const switchesOn = switches.filter((item) => item.on).length;

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Centre de contrôle IA · AI Control Center"
        subtitle="Every AI in TAKATAK on one screen: engines and their keys, what is switched on, credits, agents and their latest runs. Live production data; keys are never shown."
        badges={["Platform owners and admins"]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/admin/ai-providers" className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">
              <KeyRound className="h-3.5 w-3.5" aria-hidden /> Manage keys
            </Link>
            <Link href="/dashboard/growth/ai-engine" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-300">
              Credits & gateway →
            </Link>
          </div>
        }
      />

      {!snapshot.databaseAvailable ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The database is not available: credits, agents and runs cannot be shown. Engine and switch states below come from the server settings.
        </p>
      ) : null}

      <section aria-label="AI at a glance" className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Cpu} label="Engines connected" value={`${connected} / ${engines.length}`} hint={`${verified} with a tested key`} />
        <Kpi icon={Bot} label="TAK-TAK engines" value={`${takbotConnected} / ${takbot.length}`} hint="Usable on the site and in the studio" />
        <Kpi icon={Sparkles} label="Switches on" value={`${switchesOn} / ${switches.length}`} hint="Studio, trial, sales, gateway, key storage" />
        <Kpi icon={Workflow} label="Agent runs (30 days)" value={number.format(runs30d)} hint={waiting ? `${waiting} waiting for approval` : "None waiting for approval"} />
        <Kpi icon={CircleDollarSign} label="Credits in circulation" value={credits ? number.format(credits.totalBalance) : "—"} hint={credits ? `${credits.accounts} workspace accounts` : "Unavailable"} />
        <Kpi icon={CircleDollarSign} label="Credits spent (30 days)" value={credits ? number.format(credits.spent30d) : "—"} hint={credits ? `${credits.debits30d} AI tasks billed` : "Unavailable"} />
      </section>

      <section aria-label="Switches" className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Ce qui est allumé · What is switched on</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {switches.map((item) => (
            <Card key={item.key}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <Badge tone={item.on ? "success" : "warning"}>{item.on ? "On" : "Off"}</Badge>
                </div>
                <p className="text-sm text-slate-600">{item.detail}</p>
                <p className="text-[11px] text-slate-500">
                  Server settings: <span className="font-mono">{item.settings.join(" · ")}</span>
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader
          title="Moteurs · Engines"
          subtitle="Each AI provider, whether the server has its key, and the result of its last real test. Test or replace a key on the provider keys screen."
          action={
            <Link href="/dashboard/admin/ai-providers" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
              Test keys <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />
        <CardBody className="space-y-5 overflow-x-auto">
          {CATEGORY_ORDER.map((category) => {
            const group = engines.filter((engine) => engine.category === category);
            if (!group.length) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{CATEGORY_LABELS[category]}</h3>
                <table className="mt-1 w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="py-1 pr-3 font-medium">Provider</th>
                      <th className="py-1 pr-3 font-medium">Server</th>
                      <th className="py-1 pr-3 font-medium">Key</th>
                      <th className="py-1 pr-3 font-medium">Used by</th>
                      <th className="py-1 pr-3 font-medium">Billing</th>
                      <th className="py-1 font-medium">Last test</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((engine) => (
                      <EngineRow key={engine.key} engine={engine} />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Agents"
          subtitle="Autopilot agents that work for client workspaces. Publishing and spending always wait for a person's approval."
        />
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-1 pr-3 font-medium">Agent</th>
                <th className="py-1 pr-3 font-medium">Active in</th>
                <th className="py-1 pr-3 font-medium">Runs (30 d)</th>
                <th className="py-1 pr-3 font-medium">Completed</th>
                <th className="py-1 pr-3 font-medium">Failed</th>
                <th className="py-1 pr-3 font-medium">Waiting</th>
                <th className="py-1 font-medium">Last run</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.key} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <p className="text-sm font-medium text-slate-900">{agent.name}</p>
                    <p className="max-w-md text-xs text-slate-500">{agent.mission}</p>
                  </td>
                  <td className="py-2 pr-3 text-sm text-slate-700">{agent.enabledWorkspaces} workspaces</td>
                  <td className="py-2 pr-3 text-sm text-slate-700">{number.format(agent.runs30d)}</td>
                  <td className="py-2 pr-3 text-sm text-slate-700">{number.format(agent.completed30d)}</td>
                  <td className="py-2 pr-3 text-sm">
                    {agent.failed30d ? <Badge tone="danger">{agent.failed30d}</Badge> : <span className="text-slate-700">0</span>}
                  </td>
                  <td className="py-2 pr-3 text-sm">
                    {agent.awaitingApproval ? <Badge tone="warning">{agent.awaitingApproval}</Badge> : <span className="text-slate-700">0</span>}
                  </td>
                  <td className="py-2 text-xs text-slate-500">{when(agent.lastRunAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Dernières exécutions · Latest runs" subtitle="The ten most recent agent runs, all workspaces." />
        <CardBody>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-slate-600">No agent has run yet. Agents start when a workspace turns one on and the AI Gateway is configured.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentRuns.map((run) => (
                <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {agents.find((agent) => agent.key === run.agentKey)?.name ?? run.agentKey} · {run.workspace}
                    </p>
                    <p className="text-xs text-slate-500">
                      {when(run.createdAt)} · {run.trigger} · {run.creditsDebited} credits
                      {run.error ? ` · ${run.error}` : ""}
                    </p>
                  </div>
                  <Badge tone={RUN_TONE[run.status] ?? "neutral"}>{run.status.replace(/_/g, " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
          {credits ? (
            <p className="mt-3 text-xs text-slate-500">
              Last 30 days: {number.format(credits.granted30d)} credits granted, {number.format(credits.purchased30d)} bought,{" "}
              {number.format(credits.spent30d)} spent. Provider events recorded: {snapshot.providerEvents30d ?? "—"}.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <section aria-label="All AI screens" className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Tous les écrans IA · All AI screens</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {AI_SCREENS.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              <p className="text-sm font-semibold text-slate-900">{screen.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{screen.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-slate-400">Snapshot taken {when(snapshot.generatedAt)}.</p>
    </div>
  );
}
