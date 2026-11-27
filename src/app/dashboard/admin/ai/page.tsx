import { randomUUID } from "node:crypto";

import Link from "next/link";
import { ArrowRight, Bot, CircleDollarSign, Cpu, KeyRound, Sparkles, Workflow } from "lucide-react";

import { AdminHeader } from "@/components/admin/admin-header";
import { RunAgentsButton } from "@/components/admin/run-agents-button";
import { GrantCreditsForm } from "@/components/growth/grant-credits-form";
import { listClientBalances } from "@/lib/ai-credits/ledger";
import { nativeRunnerEnabled } from "@/lib/ai-agents/native-runner";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getAiControlSnapshot, type AiControlEngine } from "@/lib/admin/ai-control";
import { CATEGORY_LABELS, type AiProviderCategory } from "@/lib/ai-providers/catalog";
import type { ProviderKeyState } from "@/lib/ai-providers/store";
import { adminFr } from "@/lib/admin/admin-fr";
import { getDashboardLanguage } from "@/lib/dashboard/language";
import { requireAdminAccess } from "@/lib/security/guard";

export const dynamic = "force-dynamic";

// Owner's request (Nov 2026): every AI in TAKATAK on one screen, for the
// platform owner and admins, with real production state only.

const KEY_STATE: Record<ProviderKeyState, { label: string; labelFr: string; tone: "success" | "warning" | "danger" | "neutral" | "muted" }> = {
  verified: { label: "Key works (tested)", labelFr: "La clé fonctionne (testée)", tone: "success" },
  saved_untested: { label: "Saved, not tested", labelFr: "Enregistrée, non testée", tone: "warning" },
  check_failed: { label: "Test failed", labelFr: "Test échoué", tone: "danger" },
  no_automatic_check: { label: "Saved, no automatic test", labelFr: "Enregistrée, sans test automatique", tone: "neutral" },
  env_only: { label: "Server variable", labelFr: "Variable du serveur", tone: "neutral" },
  not_configured: { label: "No key", labelFr: "Aucune clé", tone: "muted" },
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

const RUN_STATUS_FR: Record<string, string> = {
  completed: "terminé",
  approved: "approuvé",
  awaiting_approval: "en attente d’approbation",
  queued: "en file",
  running: "en cours",
  executing: "en exécution",
  failed: "échec",
  rejected: "refusé",
  canceled: "annulé",
};

const CATEGORY_ORDER: AiProviderCategory[] = ["text", "voice", "video", "image", "music", "builder"];

const AI_SCREENS = [
  { href: "/dashboard/admin/go-live", label: "Go-live", labelFr: "Mise en service", note: "Everything still needed for 100% in production.", noteFr: "Tout ce qui manque encore pour 100 % en production." },
  { href: "/dashboard/admin/ai-providers", label: "Provider keys", labelFr: "Clés des fournisseurs", note: "Enter, test and remove each provider key.", noteFr: "Saisir, tester et retirer chaque clé de fournisseur." },
  { href: "/dashboard/growth/ai-engine", label: "AI Engine & credits", labelFr: "Moteur IA et crédits", note: "Gateway, credit packs, grant credits to a workspace.", noteFr: "Passerelle, forfaits de crédits, crédits accordés à un espace." },
  { href: "/dashboard/ai-studio", label: "AI Studio", labelFr: "AI Studio", note: "Brand voices, saved drafts, content generator.", noteFr: "Voix de marque, brouillons enregistrés, générateur de contenu." },
  { href: "/dashboard/ai-studio/usage", label: "Usage & cost", labelFr: "Utilisation et coût", note: "Credit balance and estimated cost.", noteFr: "Solde de crédits et coût estimé." },
  { href: "/dashboard/studio", label: "TAKATAKSTUDIO", labelFr: "TAKATAKSTUDIO", note: "Scripts, outlines and lyrics with TAK-TAK.", noteFr: "Scénarios, plans et paroles avec TAK-TAK." },
  { href: "/dashboard/admin/integration-events", label: "Provider events", labelFr: "Événements des fournisseurs", note: "Webhooks and provider tests.", noteFr: "Webhooks et tests des fournisseurs." },
  { href: "/dashboard/admin/system-health", label: "System health", labelFr: "Santé du système", note: "Server settings and capability status.", noteFr: "Réglages du serveur et état des fonctions." },
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

function EngineRow({ engine, fr }: { engine: AiControlEngine; fr: boolean }) {
  const state = KEY_STATE[engine.keyState];
  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 pr-3 text-sm font-medium text-slate-900">{engine.name}</td>
      <td className="py-2 pr-3">
        <Badge tone={engine.connected ? "success" : "muted"}>{engine.connected ? (fr ? "Branché" : "Connected") : fr ? "Non branché" : "Not connected"}</Badge>
      </td>
      <td className="py-2 pr-3">
        <Badge tone={state.tone}>{fr ? state.labelFr : state.label}</Badge>
        {engine.keyHint ? <span className="ml-2 font-mono text-[11px] text-slate-500">••••{engine.keyHint}</span> : null}
      </td>
      <td className="py-2 pr-3 text-xs text-slate-600">{engine.inTakbot ? "TAK-TAK" : "—"}</td>
      <td className="py-2 pr-3 text-xs text-slate-600">{engine.billableToClients ? (fr ? "Crédits" : "Credits") : fr ? "Interne" : "Internal"}</td>
      <td className="py-2 text-xs text-slate-500">{when(engine.lastCheckedAt)}</td>
    </tr>
  );
}

export default async function AiControlCenterPage() {
  const access = await requireAdminAccess();
  const fr = (await getDashboardLanguage(access.profileId)) === "fr";
  const [snapshot, balances] = await Promise.all([getAiControlSnapshot(), listClientBalances().catch(() => null)]);
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
        title={fr ? "Centre de contrôle IA" : "AI Control Center"}
        subtitle={
          fr
            ? "Toutes les IA de TAKATAK sur un écran : moteurs et leurs clés, ce qui est allumé, crédits, agents et leurs derniers passages. Données réelles de production ; les clés ne sont jamais affichées."
            : "Every AI in TAKATAK on one screen: engines and their keys, what is switched on, credits, agents and their latest runs. Live production data; keys are never shown."
        }
        badges={[fr ? "Propriétaires et administrateurs de la plateforme" : "Platform owners and admins"]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/admin/ai-providers" className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800">
              <KeyRound className="h-3.5 w-3.5" aria-hidden /> {fr ? "Gérer les clés" : "Manage keys"}
            </Link>
            <Link href="/dashboard/growth/ai-engine" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-blue-300">
              {fr ? "Crédits et passerelle →" : "Credits & gateway →"}
            </Link>
          </div>
        }
      />

      {!snapshot.databaseAvailable ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {fr
            ? "La base de données n’est pas disponible : les crédits, les agents et les passages ne peuvent pas être affichés. L’état des moteurs et des interrupteurs ci-dessous vient des réglages du serveur."
            : "The database is not available: credits, agents and runs cannot be shown. Engine and switch states below come from the server settings."}
        </p>
      ) : null}

      <section aria-label={fr ? "L’IA en un coup d’œil" : "AI at a glance"} className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Cpu} label={fr ? "Moteurs branchés" : "Engines connected"} value={`${connected} / ${engines.length}`} hint={fr ? `${verified} avec une clé testée` : `${verified} with a tested key`} />
        <Kpi icon={Bot} label={fr ? "Moteurs TAK-TAK" : "TAK-TAK engines"} value={`${takbotConnected} / ${takbot.length}`} hint={fr ? "Utilisables sur le site et dans le studio" : "Usable on the site and in the studio"} />
        <Kpi icon={Sparkles} label={fr ? "Interrupteurs allumés" : "Switches on"} value={`${switchesOn} / ${switches.length}`} hint={fr ? "Studio, essai, ventes, passerelle, stockage des clés" : "Studio, trial, sales, gateway, key storage"} />
        <Kpi icon={Workflow} label={fr ? "Passages d’agents (30 jours)" : "Agent runs (30 days)"} value={number.format(runs30d)} hint={waiting ? (fr ? `${waiting} en attente d’approbation` : `${waiting} waiting for approval`) : fr ? "Aucun en attente d’approbation" : "None waiting for approval"} />
        <Kpi icon={CircleDollarSign} label={fr ? "Crédits en circulation" : "Credits in circulation"} value={credits ? number.format(credits.totalBalance) : "—"} hint={credits ? (fr ? `${credits.accounts} comptes d’espaces` : `${credits.accounts} workspace accounts`) : fr ? "Indisponible" : "Unavailable"} />
        <Kpi icon={CircleDollarSign} label={fr ? "Crédits dépensés (30 jours)" : "Credits spent (30 days)"} value={credits ? number.format(credits.spent30d) : "—"} hint={credits ? (fr ? `${credits.debits30d} tâches IA facturées` : `${credits.debits30d} AI tasks billed`) : fr ? "Indisponible" : "Unavailable"} />
      </section>

      <Card>
        <CardHeader
          title={fr ? "Accorder des crédits IA" : "Grant AI credits"}
          subtitle={
            fr
              ? "Les clients utilisent les crédits pour TAK-TAK, AI Studio et les agents. Chaque octroi est inscrit une seule fois dans le registre du client, avec votre nom."
              : "Clients use credits for TAK-TAK, AI Studio and the agents. Each grant is written once in the client's ledger, with your name."
          }
        />
        <CardBody>
          {balances ? (
            <GrantCreditsForm clients={balances} nonce={randomUUID()} />
          ) : (
            <p className="text-sm text-slate-500">
              {fr ? "Le registre des crédits est injoignable pour le moment ; réessayez bientôt." : "The credit ledger is not reachable right now; try again shortly."}
            </p>
          )}
        </CardBody>
      </Card>

      <section aria-label={fr ? "Interrupteurs" : "Switches"} className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{fr ? "Ce qui est allumé" : "What is switched on"}</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {switches.map((item) => (
            <Card key={item.key}>
              <CardBody className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{adminFr(item.label, fr)}</p>
                  <Badge tone={item.on ? "success" : "warning"}>{item.on ? (fr ? "Allumé" : "On") : fr ? "Éteint" : "Off"}</Badge>
                </div>
                <p className="text-sm text-slate-600">{adminFr(item.detail, fr)}</p>
                <p className="text-[11px] text-slate-500">
                  {fr ? "Réglages du serveur :" : "Server settings:"} <span className="font-mono">{item.settings.join(" · ")}</span>
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader
          title={fr ? "Moteurs" : "Engines"}
          subtitle={
            fr
              ? "Chaque fournisseur IA, si le serveur a sa clé, et le résultat de son dernier vrai test. Testez ou remplacez une clé sur l’écran des clés des fournisseurs."
              : "Each AI provider, whether the server has its key, and the result of its last real test. Test or replace a key on the provider keys screen."
          }
          action={
            <Link href="/dashboard/admin/ai-providers" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
              {fr ? "Tester les clés" : "Test keys"} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />
        <CardBody className="space-y-5 overflow-x-auto">
          {CATEGORY_ORDER.map((category) => {
            const group = engines.filter((engine) => engine.category === category);
            if (!group.length) return null;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{adminFr(CATEGORY_LABELS[category], fr)}</h3>
                <table className="mt-1 w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="py-1 pr-3 font-medium">{fr ? "Fournisseur" : "Provider"}</th>
                      <th className="py-1 pr-3 font-medium">{fr ? "Serveur" : "Server"}</th>
                      <th className="py-1 pr-3 font-medium">{fr ? "Clé" : "Key"}</th>
                      <th className="py-1 pr-3 font-medium">{fr ? "Utilisé par" : "Used by"}</th>
                      <th className="py-1 pr-3 font-medium">{fr ? "Facturation" : "Billing"}</th>
                      <th className="py-1 font-medium">{fr ? "Dernier test" : "Last test"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.map((engine) => (
                      <EngineRow key={engine.key} engine={engine} fr={fr} />
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
          subtitle={
            fr
              ? "Les agents autopilote qui travaillent pour les espaces clients. Chat Concierge et Social Autopilot tournent ici sur les moteurs branchés ; publier et dépenser attendent toujours l’approbation d’une personne."
              : "Autopilot agents that work for client workspaces. Chat Concierge and Social Autopilot run here on the connected engines; publishing and spending always wait for a person's approval."
          }
        />
        <CardBody className="space-y-4 overflow-x-auto">
          <RunAgentsButton disabledReason={nativeRunnerEnabled() ? null : "The AI Gateway is configured: it runs the agents."} />
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-400">
                <th className="py-1 pr-3 font-medium">Agent</th>
                <th className="py-1 pr-3 font-medium">{fr ? "Actif dans" : "Active in"}</th>
                <th className="py-1 pr-3 font-medium">{fr ? "Passages (30 j)" : "Runs (30 d)"}</th>
                <th className="py-1 pr-3 font-medium">{fr ? "Réussis" : "Completed"}</th>
                <th className="py-1 pr-3 font-medium">{fr ? "Échoués" : "Failed"}</th>
                <th className="py-1 pr-3 font-medium">{fr ? "En attente" : "Waiting"}</th>
                <th className="py-1 font-medium">{fr ? "Dernier passage" : "Last run"}</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.key} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <p className="text-sm font-medium text-slate-900">{agent.name}</p>
                    <p className="max-w-md text-xs text-slate-500">{adminFr(agent.mission, fr)}</p>
                  </td>
                  <td className="py-2 pr-3 text-sm text-slate-700">{agent.enabledWorkspaces} {fr ? "espaces" : "workspaces"}</td>
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
        <CardHeader
          title={fr ? "Derniers passages" : "Latest runs"}
          subtitle={fr ? "Les dix derniers passages d’agents, tous espaces confondus." : "The ten most recent agent runs, all workspaces."}
        />
        <CardBody>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-slate-600">
              {fr
                ? "Aucun agent n’a encore tourné. Un agent tourne quand un espace l’allume (Croissance → Moteur IA), a des crédits IA, et qu’un passage est prévu ou demandé."
                : "No agent has run yet. An agent runs once a workspace turns it on (Growth → AI Engine), has AI credits, and a run is due or requested."}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentRuns.map((run) => (
                <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {agents.find((agent) => agent.key === run.agentKey)?.name ?? run.agentKey} · {run.workspace}
                    </p>
                    <p className="text-xs text-slate-500">
                      {when(run.createdAt)} · {run.trigger} · {run.creditsDebited} {fr ? "crédits" : "credits"}
                      {run.error ? ` · ${run.error}` : ""}
                    </p>
                  </div>
                  <Badge tone={RUN_TONE[run.status] ?? "neutral"}>{fr ? (RUN_STATUS_FR[run.status] ?? run.status.replace(/_/g, " ")) : run.status.replace(/_/g, " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
          {credits ? (
            <p className="mt-3 text-xs text-slate-500">
              {fr
                ? `30 derniers jours : ${number.format(credits.granted30d)} crédits accordés, ${number.format(credits.purchased30d)} achetés, ${number.format(credits.spent30d)} dépensés. Événements des fournisseurs inscrits : ${snapshot.providerEvents30d ?? "—"}.`
                : `Last 30 days: ${number.format(credits.granted30d)} credits granted, ${number.format(credits.purchased30d)} bought, ${number.format(credits.spent30d)} spent. Provider events recorded: ${snapshot.providerEvents30d ?? "—"}.`}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <section aria-label={fr ? "Tous les écrans IA" : "All AI screens"} className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">{fr ? "Tous les écrans IA" : "All AI screens"}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {AI_SCREENS.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-blue-300 hover:bg-blue-50/40"
            >
              <p className="text-sm font-semibold text-slate-900">{fr ? screen.labelFr : screen.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">{fr ? screen.noteFr : screen.note}</p>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-slate-400">
        {fr ? "Instantané pris le" : "Snapshot taken"} {when(snapshot.generatedAt)}.
      </p>
    </div>
  );
}
