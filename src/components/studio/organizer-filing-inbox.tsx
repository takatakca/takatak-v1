"use client";

import { useCallback, useEffect, useState } from "react";
import type { Language } from "@/lib/website/i18n";

type Entry = { id: string; title: string };
type Proposal = {
  id: string;
  sourceOutputId: string;
  destinationProjectId: string;
  status: "pending" | "approved" | "rejected" | "undone";
  revision: number;
  createdAt: string;
  reviewedAt: string | null;
  undoneAt: string | null;
};
type ListReply = { ok: boolean; items?: Proposal[]; hasMore?: boolean; code?: string };
type Action = "approve" | "reject" | "undo" | "change_destination";
type Props = {
  language: Language;
  projects: Entry[];
  outputs: Entry[];
  allowedDestinationIds: string[];
  canPropose: boolean;
  historyOnly?: boolean;
};

const ui = {
  fr: {
    heading: "Propositions de classement",
    intro: "Enregistrez un choix manuel puis approuvez, modifiez, refusez ou annulez son association. Seules les métadonnées sont modifiées; aucun fichier n’est déplacé.",
    source: "Brouillon Studio", target: "Projet de destination",
    create: "Proposer un classement", submitting: "Traitement…",
    pending: "En attente", approved: "Approuvé", rejected: "Refusé", undone: "Annulé",
    approve: "Approuver", change: "Modifier", reject: "Refuser", undo: "Annuler",
    refresh: "Actualiser", empty: "Aucune proposition enregistrée dans cet espace client.",
    unavailable: "Les propositions ne sont pas encore disponibles. Les fichiers restent inchangés.",
    disabled: "Activez et enregistrez une politique avec consentement avant de proposer ou d'approuver.",
    saved: "Proposition enregistrée sans déplacement de fichier.",
    actionDone: "Décision enregistrée dans le journal d’audit. Aucun fichier déplacé.",
    conflict: "Une autre modification est intervenue. Liste actualisée : vérifiez la proposition avant de réessayer.",
    error: "Opération refusée ou indisponible. Aucun déplacement effectué.",
    historyOnly: "Consultez les anciennes décisions. Vous pouvez refuser les propositions en attente et annuler un classement existant, même sans abonnement actif.",
    history: "Historique récent de l'espace client", more: "Seules les 50 propositions les plus récentes sont affichées.",
    created: "Créée le", original: "Brouillon d’origine", selectDifferent: "Choisissez un autre projet avant de modifier.",
    noOptions: "Aucun brouillon et projet autorisé n’est disponible."
  },
  en: {
    heading: "Filing proposals",
    intro: "Record a manual choice, then approve, change, reject or undo its association. Only metadata changes; original files never move.",
    source: "Studio draft", target: "Destination project",
    create: "Propose filing", submitting: "Processing…",
    pending: "Pending", approved: "Approved", rejected: "Rejected", undone: "Undone",
    approve: "Approve", change: "Change", reject: "Reject", undo: "Undo",
    refresh: "Refresh", empty: "No filing proposals have been recorded for this workspace.",
    unavailable: "Proposals are not available yet. Your files are unchanged.",
    disabled: "Enable and save a consented policy before proposing or approving.",
    saved: "Proposal recorded without moving any files.",
    actionDone: "Decision recorded in the audit trail. No files moved.",
    conflict: "Another change occurred. The list was refreshed; review the proposal before retrying.",
    error: "Operation denied or unavailable. No file movement occurred.",
    historyOnly: "Review previous decisions. You can reject pending suggestions or undo an approved association even when the subscription has ended.",
    history: "Recent workspace history", more: "Only the 50 latest proposals are shown.",
    created: "Created", original: "Original Studio draft", selectDifferent: "Choose a different project before changing.",
    noOptions: "No authorized draft and project are available."
  }
} as const;

const STATUS: Proposal["status"][] = ["pending", "approved", "rejected", "undone"];
export function OrganizerFilingInbox({
  language, projects, outputs, allowedDestinationIds, canPropose, historyOnly = false,
}: Props) {
  const t = ui[language === "fr" ? "fr" : "en"];
  const [items, setItems] = useState<Proposal[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [more, setMore] = useState(false);
  const [selectedSource, setSelectedSource] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const destinations = projects.filter(project => allowedDestinationIds.includes(project.id));
  const sourceId = outputs.some(item => item.id === selectedSource) ? selectedSource : (outputs[0]?.id ?? "");
  const projectId = destinations.some(item => item.id === selectedProject) ? selectedProject : (destinations[0]?.id ?? "");
  const titleOf = (list: Entry[], id: string) =>
    list.find(item => item.id === id)?.title || id.slice(0, 8) + "…";

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/ai-file-organizer/proposals", {
        credentials: "same-origin", cache: "no-store",
      });
      if (!response.ok) { setState("unavailable"); return; }
      const body = await response.json() as ListReply;
      if (!body.ok || !Array.isArray(body.items) ||
        body.items.some(item => !item || typeof item.id !== "string" ||
          !STATUS.includes(item.status) || !Number.isSafeInteger(item.revision))) {
        setState("unavailable");
        return;
      }
      setItems(body.items);
      setMore(body.hasMore === true);
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function create() {
    if (!canPropose || !sourceId || !projectId || busy) return;
    setBusy("create");
    setNotice("");
    try {
      const response = await fetch("/api/ai-file-organizer/proposals", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: crypto.randomUUID().replaceAll("-", ""),
          outputId: sourceId, destinationProjectId: projectId,
        }),
      });
      if (!response.ok) {
        await refresh();
        setNotice(response.status === 409 ? t.conflict : t.error);
        return;
      }
      await refresh();
      setNotice(t.saved);
    } catch {
      setNotice(t.error);
    } finally { setBusy(""); }
  }

  async function decide(item: Proposal, action: Action) {
    if (busy) return;
    const changedTo = changes[item.id] || item.destinationProjectId;
    if (action === "change_destination" && changedTo === item.destinationProjectId) {
      setNotice(t.selectDifferent);
      return;
    }
    setBusy(item.id);
    setNotice("");
    try {
      const response = await fetch("/api/ai-file-organizer/proposals/" +
        encodeURIComponent(item.id) + "/decision", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "change_destination"
          ? { action, expectedRevision: item.revision, destinationProjectId: changedTo }
          : { action, expectedRevision: item.revision }),
      });
      await refresh();
      if (!response.ok) {
        setNotice(response.status === 409 ? t.conflict : t.error);
        return;
      }
      setChanges(current => { const next = { ...current }; delete next[item.id]; return next; });
      setNotice(t.actionDone);
    } catch {
      setNotice(t.error);
    } finally { setBusy(""); }
  }

  return (
    <section className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4" aria-label={t.heading}>
      <h2 className="text-lg font-bold text-slate-950">{t.heading}</h2>
      <p className="text-sm leading-6 text-slate-700">{historyOnly ? t.historyOnly : t.intro}</p>
      {!historyOnly && !canPropose && <p className="text-sm font-medium text-slate-700">{t.disabled}</p>}
      {!historyOnly && <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm font-medium text-slate-800">
          <span className="block">{t.source}</span>
          <select value={sourceId} onChange={event => setSelectedSource(event.target.value)}
            disabled={Boolean(busy) || !canPropose || outputs.length === 0}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
            {outputs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm font-medium text-slate-800">
          <span className="block">{t.target}</span>
          <select value={projectId} onChange={event => setSelectedProject(event.target.value)}
            disabled={Boolean(busy) || !canPropose || destinations.length === 0}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
            {destinations.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>
      </div>
      {(outputs.length === 0 || destinations.length === 0) && <p className="text-sm text-slate-700">{t.noOptions}</p>}
      <button type="button" onClick={() => { void create(); }}
        disabled={Boolean(busy) || !canPropose || !sourceId || !projectId || state !== "ready"}
        className="min-h-11 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy === "create" ? t.submitting : t.create}
      </button>
      </>}
      <p role="status" aria-live="polite" className="text-sm text-slate-700">{notice}</p>

      <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <h3 className="font-semibold text-slate-900">{t.history}</h3>
        <button type="button" onClick={() => { void refresh(); }} disabled={Boolean(busy)}
          className="min-h-11 rounded-lg border border-blue-700 px-3 text-sm font-semibold text-blue-700 disabled:opacity-50">
          {t.refresh}
        </button>
      </div>
      {state === "loading" && <p className="text-sm text-slate-700">{t.submitting}</p>}
      {state === "unavailable" && <p role="status" className="text-sm text-slate-700">{t.unavailable}</p>}
      {state === "ready" && items.length === 0 && <p className="text-sm text-slate-700">{t.empty}</p>}
      {state === "ready" && items.length > 0 && (
        <ul className="space-y-3">
          {items.map(item => {
            const nextProject = changes[item.id] || item.destinationProjectId;
            const eligible = item.status === "pending" && canPropose;
            return <li key={item.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="min-w-0 break-words text-sm text-slate-900">
                  {titleOf(outputs, item.sourceOutputId)}
                </strong>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-800">
                  {t[item.status]}
                </span>
              </div>
              <p className="break-words text-sm text-slate-700">
                {t.target}: <span className="font-medium">{titleOf(projects, item.destinationProjectId)}</span>
              </p>
              <p className="text-xs text-slate-600">
                {t.created}: {new Date(item.createdAt).toLocaleDateString(language === "fr" ? "fr-CA" : "en-CA")}
              </p>
              {eligible && <label className="block space-y-1 text-sm font-medium text-slate-800">
                <span className="block">{t.change}: {t.target}</span>
                <select value={nextProject}
                  onChange={event => setChanges(current => ({ ...current, [item.id]: event.target.value }))}
                  disabled={Boolean(busy)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">
                  {destinations.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}
                </select>
              </label>}
              <div className="flex flex-wrap gap-2">
                {item.status === "pending" && <>
                  <button type="button" disabled={Boolean(busy) || !canPropose}
                    onClick={() => { void decide(item, "approve"); }}
                    className="min-h-11 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
                    {t.approve}
                  </button>
                  <button type="button" disabled={Boolean(busy) || !eligible ||
                    nextProject === item.destinationProjectId}
                    onClick={() => { void decide(item, "change_destination"); }}
                    className="min-h-11 rounded-lg border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">
                    {t.change}
                  </button>
                  <button type="button" disabled={Boolean(busy)}
                    onClick={() => { void decide(item, "reject"); }}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                    {t.reject}
                  </button>
                </>}
                {item.status === "approved" &&
                  <button type="button" disabled={Boolean(busy)}
                    onClick={() => { void decide(item, "undo"); }}
                    className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">
                    {t.undo}
                  </button>}
              </div>
            </li>;
          })}
        </ul>
      )}
      {more && <p className="text-xs text-slate-700">{t.more}</p>}
    </section>
  );
}
