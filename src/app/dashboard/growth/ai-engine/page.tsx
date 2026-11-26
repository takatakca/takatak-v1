import { randomUUID } from "node:crypto";
import Link from "next/link";
import { AgentsPanel } from "@/components/ai-agents/agents-panel";
import { GrantCreditsForm } from "@/components/growth/grant-credits-form";
import { GrowthHeader, GrowthKpi, HonestyNote } from "@/components/growth/growth-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireGrowthAccess } from "@/lib/growth/access";
import { AI_AGENTS, AI_CREDIT_ACTIONS, AI_CREDIT_PACKS, AI_GATEWAY_ENV, AI_PROVIDERS } from "@/lib/growth/ai-engine";
import { connectorByKey } from "@/lib/growth/connectors";
import { getAiEngineStatus } from "@/lib/growth/status";
import { listAgentRuns, listAgentSettings, type AgentSettingView, type RunView } from "@/lib/ai-agents/service";
import { getCreditSnapshot, listClientBalances, type CreditSnapshot } from "@/lib/ai-credits/ledger";
import { aiCreditsCheckoutEnabled } from "@/lib/billing/ai-credits/stripe";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { TAKBOT_ENGINES, takbotActionLabel } from "@/lib/takbot/catalog";
import { connectedEngines } from "@/lib/takbot/server";
import { buyCreditsAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Moteur IA et crédits · AI Engine & Credits" };

const cad = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" });

const CHECKOUT_NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  success: {
    tone: "ok",
    text: "Paiement reçu. Les crédits apparaissent ici dès que Stripe le confirme (quelques secondes) · Payment received; credits appear as soon as Stripe confirms it.",
  },
  canceled: { tone: "warn", text: "Paiement annulé ; aucun montant n’a été prélevé · Checkout was canceled; no charge was made." },
  error: { tone: "warn", text: "Le paiement n’a pas pu démarrer ; réessayez · Checkout could not start; please try again." },
  unavailable: { tone: "warn", text: "L’achat de crédits n’est pas encore ouvert pour ce compte · Buying credits is not available for this account yet." },
};

/** Module names, French first. */
const MODULE_FR: Record<string, string> = {
  Social: "Réseaux sociaux",
  Reputation: "Réputation",
  Conversations: "Conversations",
  Ads: "Annonces",
  SEO: "SEO",
  Web: "Site Web",
  "AI Studio": "Studio IA",
  Reports: "Rapports",
};

const CAPABILITY_FR: Record<string, string> = {
  text: "texte",
  image: "image",
  voice: "voix",
  video: "vidéo",
  code: "code",
  search: "recherche",
};

export default async function AiEnginePage({ searchParams }: { searchParams: Promise<{ credits?: string }> }) {
  const { access, showSetupDetails } = await requireGrowthAccess("/dashboard/growth/ai-engine");
  const notice = CHECKOUT_NOTICES[(await searchParams).credits ?? ""] ?? null;
  const canBuy = aiCreditsCheckoutEnabled() && access.mode === "client_scoped" && hasEffectivePermission(access, "manage_settings");
  let credits: CreditSnapshot | null = null;
  let adminClients: Array<{ id: string; name: string; balance: number }> | null = null;
  let ledgerUnavailable = false;
  let agentSettings: AgentSettingView[] | null = null;
  let agentRuns: RunView[] = [];
  try {
    if (access.mode === "client_scoped") {
      [credits, agentSettings, agentRuns] = await Promise.all([
        getCreditSnapshot(access.activeClientId),
        listAgentSettings(access.activeClientId),
        listAgentRuns(access.activeClientId),
      ]);
    }
    if (access.mode === "platform_admin") adminClients = await listClientBalances();
  } catch {
    ledgerUnavailable = true;
    console.error("[ai-credits] snapshot unavailable");
  }
  const status = getAiEngineStatus();
  const engines = await connectedEngines().catch(() => new Set<string>());
  const enginesConnected = TAKBOT_ENGINES.filter((engine) => engines.has(engine.key)).length;
  const isConnected = (key: string) => engines.has(key) || status.providers.some((p) => p.key === key && p.configured);
  const rosterConnected = AI_PROVIDERS.filter((p) => isConnected(p.key)).length;
  const running = status.gateway.configured || enginesConnected > 0;

  return (
    <div className="space-y-6">
      <GrowthHeader
        title="Moteur IA et crédits · AI Engine & Credits"
        description="Chaque tâche IA (publications, réponses, annonces, audits, rapports) passe par TAK-TAK, qui choisit le meilleur moteur, et se paie en crédits · Every AI task runs through TAK-TAK, which picks the best engine, and is billed in credits."
        actions={
          <Link href="/dashboard/ai-studio" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:border-indigo-300">
            Studio IA · AI Studio →
          </Link>
        }
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {credits ? (
          <GrowthKpi label="Solde de crédits · Credit balance" value={credits.balance.toLocaleString("fr-CA")} hint="En direct · Live" />
        ) : (
          <GrowthKpi
            label="Moteur · Engine"
            value={status.gateway.configured ? "Passerelle · Gateway" : "TAK-TAK"}
            hint={status.gateway.configured ? "Passerelle externe · External gateway" : "Intégré · Built in"}
          />
        )}
        <GrowthKpi label="Moteurs IA branchés · AI engines connected" value={`${rosterConnected} / ${AI_PROVIDERS.length}`} hint="TAK-TAK choisit pour vous · TAK-TAK picks for you" />
        <GrowthKpi label="Agents autopilote · Autopilot agents" value={String(AI_AGENTS.length)} hint="Avec votre approbation · Approval-gated" />
        <GrowthKpi label="Actions tarifées · Priced actions" value={String(AI_CREDIT_ACTIONS.length)} hint="Prix fixe par tâche · Fixed price per task" />
      </section>

      {notice ? (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          {notice.text}
        </div>
      ) : null}

      {credits ? (
        <Card>
          <CardHeader
            title="Vos crédits IA · Your AI credits"
            subtitle="Solde en direct. Chaque tâche IA est débitée ici avec son reçu, et remboursée si le moteur échoue · Live balance; every AI task is debited here with its receipt and refunded if the engine fails."
          />
          <CardBody className="space-y-4">
            <p className="text-3xl font-bold text-slate-950">
              {credits.balance.toLocaleString("fr-CA")} <span className="text-base font-medium text-slate-500">crédits · credits</span>
            </p>
            {credits.entries.length ? (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-xs">
                {credits.entries.map((e) => {
                  const action = e.actionKey ? AI_CREDIT_ACTIONS.find((a) => a.key === e.actionKey) : null;
                  return (
                    <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                      <span className={`w-16 font-semibold ${e.delta > 0 ? "text-emerald-700" : "text-slate-900"}`}>
                        {e.delta > 0 ? "+" : ""}
                        {e.delta}
                      </span>
                      <span className="text-slate-700">{action ? `${takbotActionLabel(action, "fr")} · ${action.label}` : e.actionKey ?? e.reason}</span>
                      {e.note ? <span className="text-slate-400">· {e.note}</span> : null}
                      <span className="ml-auto text-slate-400">
                        {e.createdAt.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })} · solde {e.balanceAfter}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Aucune activité de crédits pour l’instant · No credit activity yet.</p>
            )}
          </CardBody>
        </Card>
      ) : null}

      {adminClients ? (
        <Card>
          <CardHeader
            title="Accorder des crédits IA · Grant AI credits"
            subtitle="Administration. Chaque envoi est inscrit au registre du client et ne s’applique jamais deux fois · Each grant is recorded in the client’s ledger and can never apply twice."
          />
          <CardBody>
            <GrantCreditsForm clients={adminClients} nonce={randomUUID()} />
          </CardBody>
        </Card>
      ) : null}

      {ledgerUnavailable ? (
        <HonestyNote>
          Le registre des crédits est injoignable pour le moment : les soldes sont masqués plutôt qu’inventés · The credit ledger is not reachable right now; balances are hidden rather than guessed.
        </HonestyNote>
      ) : null}

      <Card>
        <CardHeader
          title="Comment ça marche · How it works"
          subtitle="Le tableau de bord envoie la tâche à TAK-TAK, qui garde les clés des moteurs, choisit le modèle, compte l’usage et débite les crédits · The dashboard sends the task to TAK-TAK, which holds the engine keys, picks the model, meters usage and debits credits."
          action={<Badge tone={running ? "success" : "warning"}>{running ? "En marche · Running" : "Aucun moteur branché · No engine connected"}</Badge>}
        />
        <CardBody className="space-y-3 text-xs leading-5 text-slate-600">
          <ol className="grid gap-2 md:grid-cols-4">
            {[
              ["Tâche · Task", "Un module demande un travail (ex. : « écrire les publications de la semaine ») · A module asks for work."],
              ["Choix · Route", "TAK-TAK choisit le moteur selon la tâche, la langue, le coût et la qualité · TAK-TAK picks the engine by task, language, cost and quality."],
              ["Approbation · Approve", "Tout ce qui publie ou dépense attend votre approbation · Anything that publishes or spends waits for your approval."],
              ["Facturation · Bill", "Les crédits sont débités par action et visibles dans votre solde · Credits are debited per action and shown on your balance."],
            ].map(([title, detail], i) => (
              <li key={title} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                <p className="font-semibold text-slate-800">
                  {i + 1}. {title}
                </p>
                <p className="mt-0.5">{detail}</p>
              </li>
            ))}
          </ol>
          {showSetupDetails ? (
            <p className="font-mono text-[10px] text-slate-400">
              Passerelle externe · External gateway : {status.gateway.configured ? "configurée · configured" : `non utilisée (TAK-TAK intégré) · not used; optional settings ${AI_GATEWAY_ENV.join(", ")}`} · moteurs TAK-TAK branchés {enginesConnected}/{TAKBOT_ENGINES.length}
            </p>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Moteurs IA · AI engines"
          subtitle={`${AI_PROVIDERS.length} moteurs ; TAK-TAK prend le meilleur moteur branché pour chaque tâche · ${AI_PROVIDERS.length} engines; TAK-TAK uses the best connected engine for each task.`}
        />
        <CardBody className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {AI_PROVIDERS.map((p) => (
            <div key={p.key} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                <Badge tone={isConnected(p.key) ? "success" : "muted"}>{isConnected(p.key) ? "Branché · Connected" : "Non branché · Not connected"}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">{p.bestFor}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{p.capabilities.map((c) => CAPABILITY_FR[c] ?? c).join(" · ")}</p>
              {showSetupDetails && !isConnected(p.key) ? <p className="mt-1 font-mono text-[10px] text-slate-400">{p.env}</p> : null}
            </div>
          ))}
        </CardBody>
      </Card>

      {agentSettings ? (
        <AgentsPanel
          settings={agentSettings}
          runs={agentRuns}
          canConfigure={access.mode === "client_scoped" && hasEffectivePermission(access, "manage_settings")}
          canRun={access.mode === "client_scoped" && hasEffectivePermission(access, "create_content")}
          canApprove={access.mode === "client_scoped" && hasEffectivePermission(access, "approve_content")}
          gatewayConfigured={status.gateway.configured}
        />
      ) : (
        <Card>
          <CardHeader
            title="Agents autopilote · Autopilot agents"
            subtitle="Les agents travaillent pour le client jour et nuit ; publier ou dépenser demande toujours une approbation · Agents work around the clock; publishing and spending always need approval."
          />
          <CardBody className="grid gap-3 lg:grid-cols-2">
            {AI_AGENTS.map((agent) => (
              <div key={agent.key} className="rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-900">{agent.name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{agent.mission}</p>
                <p className="mt-2 text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Déclencheurs · Triggers :</span> {agent.triggers.join(", ")}
                </p>
                <p className="text-[11px] text-slate-500">
                  <span className="font-semibold text-slate-700">Utilise · Uses :</span> {agent.connectorKeys.map((k) => connectorByKey(k)?.name ?? k).join(", ")}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Coût en crédits par action · Credit cost per action" />
          <CardBody className="p-0">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Module</th>
                  <th className="px-4 py-2 text-right font-medium">Crédits · Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {AI_CREDIT_ACTIONS.map((a) => (
                  <tr key={a.key}>
                    <td className="px-4 py-2 text-slate-800">
                      {takbotActionLabel(a, "fr")}
                      <span className="block text-[10px] text-slate-400">{a.label}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{MODULE_FR[a.module] ?? a.module}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{a.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title="Forfaits de crédits · Credit packs"
            subtitle={
              canBuy
                ? "Paiement sécurisé par Stripe ; les crédits s’ajoutent automatiquement après le paiement · Secure Stripe checkout; credits are added automatically."
                : "Prix en dollars canadiens. Pour acheter un forfait, écrivez-nous · Prices in CAD. To buy a pack, message us."
            }
          />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {AI_CREDIT_PACKS.map((pack) => (
                <div key={pack.key} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{pack.label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-950">{pack.credits.toLocaleString("fr-CA")} crédits</p>
                  <p className="text-sm text-slate-700">{cad.format(pack.priceCad)}</p>
                  <p className="text-[11px] text-slate-400">{cad.format(pack.priceCad / pack.credits)} / crédit</p>
                  {canBuy ? (
                    <form action={buyCreditsAction} className="mt-2">
                      <input type="hidden" name="packKey" value={pack.key} />
                      <button className="w-full rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700">Acheter · Buy</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
            {!canBuy && access.mode === "client_scoped" ? (
              <Link href="/dashboard/support" className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300">
                Écrire au soutien · Message support →
              </Link>
            ) : null}
          </CardBody>
        </Card>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Cette page ne lance aucune tâche IA. Le prix d’une tâche vient toujours du tableau ci-dessus, et une tâche qui échoue chez le moteur est remboursée · This page runs no AI task; the price always comes from the table above, and a task the engine fails is refunded.
        {showSetupDetails ? " La passerelle externe, si elle est configurée, débite par POST /api/ai/credits/debit (jeton TAKATAK_AI_GATEWAY_TOKEN)." : ""}
      </p>
    </div>
  );
}
