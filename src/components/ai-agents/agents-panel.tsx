import Link from "next/link";

import { cancelAgentRunAction, decideAgentRunAction, saveAgentSettingAction } from "@/app/dashboard/growth/ai-engine/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { isNativeAgent } from "@/lib/ai-agents/native-prompts";
import type { AgentSettingView, RunView } from "@/lib/ai-agents/service";

import { RunRequestForm } from "./run-request-form";

const DAYS = [
  "dimanche · Sunday",
  "lundi · Monday",
  "mardi · Tuesday",
  "mercredi · Wednesday",
  "jeudi · Thursday",
  "vendredi · Friday",
  "samedi · Saturday",
];
const DAYS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** French first: each agent's job, with the English line alongside. */
const AGENT_FR: Record<string, string> = {
  social_autopilot: "Planifie la semaine, écrit une publication par jour, l’adapte à chaque réseau et la garde pour votre approbation.",
  review_responder: "Prépare une réponse à chaque nouvel avis et vous montre d’abord les avis de 1 à 3 étoiles.",
  review_requester: "Demande un avis après chaque visite ou travail, par texto, WhatsApp ou courriel, avec un seul rappel.",
  chat_concierge: "Répond 24 h sur 24 aux questions du clavardage du site et fait entrer les prospects dans le pipeline.",
  seo_watchdog: "Vérifie vos sites chaque semaine, signale ce qui recule et écrit la liste des correctifs par priorité.",
  ads_optimizer: "Surveille les dépenses et le coût par prospect, propose des ajustements et de nouveaux textes. Ne dépense jamais sans approbation.",
  report_writer: "Transforme les chiffres du mois en un rapport clair, avec les prochaines étapes.",
};

/** Where an agent works when no external gateway is configured, when it is not run here. */
const AGENT_ELSEWHERE: Record<string, { text: string; href: string; cta: string }> = {
  review_responder: {
    text: "Les brouillons de réponses se préparent dans l’écran Avis · Reply drafts are prepared in the Reviews screen.",
    href: "/dashboard/growth/reviews",
    cta: "Ouvrir les avis · Open Reviews",
  },
  review_requester: {
    text: "Les demandes d’avis s’envoient depuis l’écran Avis · Review requests are sent from the Reviews screen.",
    href: "/dashboard/growth/reviews",
    cta: "Ouvrir les avis · Open Reviews",
  },
};

/** Plain words for the error codes a run can end with. */
const RUN_ERRORS: Record<string, string> = {
  insufficient_credits: "Crédits insuffisants · Not enough credits",
  no_engine_connected: "Aucun moteur IA branché · No AI engine connected",
  no_website_on_file: "Ajoutez l’adresse de votre site dans Marques · Add your website in Brands",
  site_unreachable: "Site injoignable pendant la vérification · Website unreachable during the check",
  report_unavailable: "Chiffres du mois indisponibles · Month numbers unavailable",
  no_ad_campaign: "Créez d’abord une campagne TAKATAK ADS · Create a TAKATAK ADS campaign first",
  conversation_closed: "Conversation fermée · Conversation closed",
  empty_draft: "Brouillon vide · Empty draft",
  runner_error: "Erreur du moteur ; relancez · Engine error; run again",
  provider_error: "Erreur du moteur ; relancez · Engine error; run again",
  network: "Moteur injoignable ; relancez · Engine unreachable; run again",
  empty: "Le moteur n’a rien renvoyé ; relancez · The engine returned nothing; run again",
  execution_interrupted: "Interrompu : vérifiez la conversation avant de relancer · Interrupted: check the conversation before retrying",
  timeout: "Le moteur a mis trop de temps · The engine timed out",
  rate_limited: "Moteur occupé ; relancez plus tard · Engine busy; try later",
};

function runError(code: string): string {
  return RUN_ERRORS[code] ?? RUN_ERRORS[code.split(":")[0]] ?? code;
}

function scheduleLabel(s: AgentSettingView): string | null {
  if (s.schedule === "off") return null;
  const hour = `${String(s.scheduleHour).padStart(2, "0")} h`;
  return s.schedule === "daily" ? `Chaque jour à ${hour} · Every day` : `Chaque ${DAYS_FR[s.scheduleWeekday ?? 1]} à ${hour} · Weekly`;
}

const STATUS_LABEL: Record<RunView["status"], { label: string; tone: "neutral" | "accent" | "warning" | "success" | "danger" | "muted" }> = {
  queued: { label: "En file · Queued", tone: "neutral" },
  running: { label: "En cours… · Working…", tone: "accent" },
  awaiting_approval: { label: "À approuver · Needs approval", tone: "warning" },
  approved: { label: "Approuvé · Approved", tone: "accent" },
  executing: { label: "Exécution… · Running…", tone: "accent" },
  completed: { label: "Terminé · Done", tone: "success" },
  rejected: { label: "Refusé · Rejected", tone: "muted" },
  failed: { label: "Échec · Failed", tone: "danger" },
  canceled: { label: "Annulé · Canceled", tone: "muted" },
};

const when = (date: Date) => date.toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" });

export function AgentsPanel({
  settings,
  runs,
  canConfigure,
  canRun,
  canApprove,
  gatewayConfigured,
}: {
  settings: AgentSettingView[];
  runs: RunView[];
  canConfigure: boolean;
  canRun: boolean;
  canApprove: boolean;
  gatewayConfigured: boolean;
}) {
  const awaiting = runs.filter((r) => r.status === "awaiting_approval");
  return (
    <div className="space-y-6">
      {awaiting.length > 0 ? (
        <Card>
          <CardHeader
            title={`À approuver · Waiting for your approval (${awaiting.length})`}
            subtitle="Rien n’est publié ni dépensé avant votre approbation · Nothing is published or spent until you approve it."
          />
          <CardBody className="space-y-3">
            {awaiting.map((r) => (
              <div key={r.id} className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <p className="text-sm font-semibold text-slate-900">
                  {r.agentName} <span className="text-xs font-normal text-slate-500">· {when(r.createdAt)}</span>
                </p>
                {r.summary ? <p className="text-sm text-slate-700">{r.summary}</p> : null}
                {r.preview ? <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-white p-3 font-sans text-xs text-slate-800 ring-1 ring-slate-200">{r.preview}</pre> : null}
                {canApprove ? (
                  <div className="flex gap-2">
                    <form action={decideAgentRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Approuver · Approve</button>
                    </form>
                    <form action={decideAgentRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-rose-300">Refuser · Reject</button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Vos agents IA · Your AI agents"
          subtitle="Activez les agents voulus ; ils travaillent sur les moteurs TAK-TAK et vous demandent l’approbation avant de publier · Turn on the agents you want; they run on the TAK-TAK engines and ask before publishing."
        />
        <CardBody className="grid gap-3 lg:grid-cols-2">
          {settings.map((s) => {
            const elsewhere = gatewayConfigured || isNativeAgent(s.key) ? null : AGENT_ELSEWHERE[s.key] ?? null;
            return (
              <div key={s.key} className="space-y-3 rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                  <div className="flex items-center gap-1.5">
                    {s.enabled && scheduleLabel(s) ? <Badge tone="accent">{scheduleLabel(s)}</Badge> : null}
                    <Badge tone={s.enabled ? "success" : "muted"}>{s.enabled ? "Actif · On" : "Inactif · Off"}</Badge>
                  </div>
                </div>
                <div className="space-y-0.5 text-xs leading-5">
                  {AGENT_FR[s.key] ? <p className="text-slate-700">{AGENT_FR[s.key]}</p> : null}
                  <p className="text-slate-500">{s.mission}</p>
                </div>
                {!gatewayConfigured && isNativeAgent(s.key) ? (
                  <p className="text-[11px] font-medium text-emerald-700">Fonctionne sur les moteurs TAK-TAK · Runs on the TAK-TAK engines</p>
                ) : null}
                {elsewhere ? (
                  <p className="text-[11px] text-slate-600">
                    {elsewhere.text}{" "}
                    <Link href={elsewhere.href} className="font-semibold text-indigo-700 hover:underline">
                      {elsewhere.cta} →
                    </Link>
                  </p>
                ) : null}
                {canConfigure ? (
                  <form action={saveAgentSettingAction} className="space-y-2 rounded-lg bg-slate-50 p-2">
                    <input type="hidden" name="agentKey" value={s.key} />
                    <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                      <label className="flex items-center gap-1.5">
                        <input type="checkbox" name="enabled" defaultChecked={s.enabled} /> Activé · Enabled
                      </label>
                      <label
                        className="flex items-center gap-1.5"
                        title={s.approvalLocked ? "Cet agent peut dépenser : l’approbation est toujours requise · This agent can spend money, so approval is always required." : undefined}
                      >
                        <input type="checkbox" name="requireApproval" defaultChecked={s.requireApproval} disabled={s.approvalLocked} />
                        Me demander avant de publier · Ask me first{s.approvalLocked ? " (toujours · always)" : ""}
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                      <span>Pilote automatique · Autopilot :</span>
                      <select name="schedule" defaultValue={s.schedule} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
                        <option value="off">Sur demande · Manual only</option>
                        <option value="daily">Chaque jour · Every day</option>
                        <option value="weekly">Chaque semaine · Every week</option>
                      </select>
                      <select name="scheduleWeekday" defaultValue={String(s.scheduleWeekday ?? 1)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" aria-label="Jour (hebdomadaire) · Day (weekly)">
                        {DAYS.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                      <select name="scheduleHour" defaultValue={String(s.scheduleHour)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs" aria-label="Heure · Hour">
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {String(h).padStart(2, "0")} h
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      name="instructions"
                      rows={2}
                      maxLength={2000}
                      defaultValue={s.instructions ?? ""}
                      placeholder="Consignes permanentes : ton, offres, sujets à éviter… · Standing instructions: tone, offers, things to avoid…"
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900"
                    />
                    <button className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-indigo-300">Enregistrer · Save</button>
                  </form>
                ) : null}
                {canRun && !elsewhere ? <RunRequestForm agentKey={s.key} disabled={!s.enabled} /> : null}
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tâches récentes des agents · Recent agent runs" />
        <CardBody className="p-0">
          {runs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">Aucune tâche pour l’instant · No runs yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {runs.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5">
                  <span className="font-semibold text-slate-900">{r.agentName}</span>
                  <Badge tone={STATUS_LABEL[r.status].tone}>{STATUS_LABEL[r.status].label}</Badge>
                  {r.summary ? <span className="max-w-md truncate text-slate-600">{r.summary}</span> : r.brief ? <span className="max-w-md truncate text-slate-400">« {r.brief} »</span> : null}
                  {r.error ? <span className="text-rose-700">{runError(r.error)}</span> : null}
                  {r.creditsDebited ? <span className="text-slate-500">{r.creditsDebited} crédit{r.creditsDebited > 1 ? "s" : ""}</span> : null}
                  <span className="ml-auto text-slate-400">{when(r.createdAt)}</span>
                  {canRun && (r.status === "queued" || r.status === "approved") ? (
                    <form action={cancelAgentRunAction}>
                      <input type="hidden" name="runId" value={r.id} />
                      <button className="text-slate-400 hover:text-rose-600">Annuler · Cancel</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
