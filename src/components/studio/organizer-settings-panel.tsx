"use client";

import { useEffect, useState } from "react";
import { organizerSettingsSavePayload, type OrganizerUiDraft } from "@/lib/ai-file-organizer/settings-ui";
import type { OrganizerSettings } from "@/lib/ai-file-organizer/settings-policy";

type StudioProject = { id: string; title: string };
const UUID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

const words = {
  fr: {
    title: "AI File Organizer — paramètres Studio",
    intro: "Configurez uniquement les suggestions de classement des brouillons texte Studio de votre espace client. Aucun fichier n'est déplacé, aucun traitement IA n'est lancé et aucun paiement n'est effectué ici.",
    loading: "Vérification des droits et de la configuration…",
    locked: "Accès indisponible. Vérifiez les droits de gestion, l'abonnement et l'activation de service avant de modifier les paramètres.",
    unavailable: "Configuration non disponible. La migration et les contrôles serveur doivent être validés avant utilisation.",
    projects: "Projets Studio autorisés",
    projectsHint: "Sélectionnez au moins un projet de votre espace où une suggestion pourrait être classée. Les projets sont revérifiés sur le serveur.",
    noProjects: "Aucun projet Studio accessible pour ce compte. Créez un projet dans Studio avant de configurer des suggestions.",
    off: "Désactivé — aucun consentement conservé",
    suggest: "Suggestions uniquement — approbation humaine obligatoire",
    consent: "J'autorise la préparation des suggestions de classement des brouillons Studio sélectionnés.",
    provider: "Je comprends qu'un traitement par un fournisseur IA demandera mon consentement et des contrôles supplémentaires avant toute activation.",
    confidence: "Seuil de confiance minimal",
    save: "Enregistrer les règles",
    saving: "Enregistrement…",
    saved: "Règles enregistrées. Aucun fichier n'a été déplacé.",
    conflict: "Ces règles ont été modifiées ailleurs. Rechargez avant de recommencer.",
    error: "Impossible d'enregistrer. Aucun changement de classement n'a été appliqué.",
    reload: "Recharger les règles",
    laterTitle: "Traitement des suggestions — étape suivante",
    later: "Les actions Approuver / Modifier / Refuser exigeront d'abord un registre sécurisé des suggestions. Elles ne sont pas encore actives.",
    version: "Révision",
    note: "Mode automatique, stockage de fichiers, facturation à 20 USD/mois et classement par IA : non activés.",
    changeLanguage: "English",
  },
  en: {
    title: "AI File Organizer — Studio settings",
    intro: "Configure suggestions for Studio text drafts in your workspace only. No files are moved, no AI processing is started and no payment is collected here.",
    loading: "Checking access and configuration…",
    locked: "Access unavailable. Verify management rights, subscription and service enablement before changing settings.",
    unavailable: "Settings are unavailable. The migration and server checks must be verified before use.",
    projects: "Approved Studio projects",
    projectsHint: "Choose at least one project in your workspace as a possible suggestion destination. The server verifies these projects again.",
    noProjects: "No Studio projects available for this workspace. Create a project in Studio before configuring suggestions.",
    off: "Off — no consent retained",
    suggest: "Suggestions only — human approval required",
    consent: "I consent to preparing filing suggestions for selected Studio drafts.",
    provider: "I understand that AI-provider processing needs my consent and additional safeguards before activation.",
    confidence: "Minimum confidence threshold",
    save: "Save settings",
    saving: "Saving…",
    saved: "Settings saved. No files were moved.",
    conflict: "These settings changed elsewhere. Reload before trying again.",
    error: "Could not save the settings. No filing changes were made.",
    reload: "Reload settings",
    laterTitle: "Suggestion review — next phase",
    later: "Approve / Edit / Reject will require a secure persisted suggestion queue first. These actions are not active yet.",
    version: "Revision",
    note: "Automatic mode, file storage, USD 20/month billing and AI filing are not enabled.",
    changeLanguage: "Français",
  },
} as const;

const emptyDraft: OrganizerUiDraft = {
  mode: "off", consentGranted: false, providerProcessingConsent: false,
  allowedDestinationIds: [], minimumConfidence: 0.9,
};
function settingsFromResponse(data: unknown): OrganizerSettings | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const payload = data as Record<string, unknown>;
  const s = payload.settings;
  if (payload.ok !== true || !s || typeof s !== "object" || Array.isArray(s)) return null;
  const v = s as Record<string, unknown>;
  if ((v.mode !== "off" && v.mode !== "suggest") ||
    typeof v.consentGranted !== "boolean" ||
    typeof v.providerProcessingConsent !== "boolean" ||
    !Array.isArray(v.allowedDestinationIds) ||
    !v.allowedDestinationIds.every(x => typeof x === "string" && UUID.test(x)) ||
    typeof v.minimumConfidence !== "number" || !Number.isFinite(v.minimumConfidence) ||
    !Number.isSafeInteger(v.revision) || (v.revision as number) < 0) return null;
  return {
    mode: v.mode, consentGranted: v.consentGranted,
    providerProcessingConsent: v.providerProcessingConsent,
    allowedDestinationIds: v.allowedDestinationIds as string[],
    allowedSourceKinds: v.mode === "suggest" ? ["studio"] : [],
    minimumConfidence: v.minimumConfidence, requireApproval: true, revision: v.revision as number,
  };
}
function projectsFromResponse(data: unknown): StudioProject[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const value = (data as Record<string, unknown>).projects;
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const p = item as Record<string, unknown>;
    if (typeof p.id !== "string" || !UUID.test(p.id) ||
      typeof p.title !== "string" || p.title.length > 120 || !p.title.trim() ||
      seen.has(p.id)) return [];
    seen.add(p.id);
    return [{ id: p.id, title: p.title }];
  }).slice(0, 20);
}

export function OrganizerSettingsPanel() {
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const t = words[language];
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"locked" | "unavailable" | null>(null);
  const [settings, setSettings] = useState<OrganizerSettings | null>(null);
  const [draft, setDraft] = useState<OrganizerUiDraft>(emptyDraft);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"saved" | "conflict" | "error" | null>(null);

  async function load() {
    setLoading(true);
    setFeedback(null);
    try {
      const settingsResponse = await fetch("/api/ai-file-organizer/settings", { cache: "no-store" });
      if (!settingsResponse.ok) {
        setError(settingsResponse.status === 403 || settingsResponse.status === 401 ? "locked" : "unavailable");
        setSettings(null);
        return;
      }
      const parsed: unknown = await settingsResponse.json();
      const value = settingsFromResponse(parsed);
      if (!value) throw new Error("invalid_settings_response");
      const projectsResponse = await fetch("/api/studio/projects?offset=0", { cache: "no-store" });
      const projectData: unknown = projectsResponse.ok ? await projectsResponse.json() : null;
      const visible = projectsFromResponse(projectData);
      setProjects(visible);
      setSettings(value);
      setDraft({
        mode: value.mode === "suggest" ? "suggest" : "off", consentGranted: value.consentGranted,
        providerProcessingConsent: value.providerProcessingConsent,
        allowedDestinationIds: value.allowedDestinationIds.filter(id => visible.some(p => p.id === id)),
        minimumConfidence: value.minimumConfidence,
      });
      setError(null);
    } catch {
      setError("unavailable");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);
  const payload = settings ? organizerSettingsSavePayload(draft, settings.revision, projects.map(p => p.id)) : null;
  async function save() {
    if (!payload || saving) return;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/ai-file-organizer/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), cache: "no-store",
      });
      if (response.status === 409) {
        setFeedback("conflict");
        return;
      }
      if (!response.ok) throw new Error("save_failed");
      const data: unknown = await response.json();
      const value = settingsFromResponse(data);
      if (!value) throw new Error("invalid_saved_settings");
      setSettings(value);
      setDraft({
        mode: value.mode === "suggest" ? "suggest" : "off", consentGranted: value.consentGranted,
        providerProcessingConsent: value.providerProcessingConsent,
        allowedDestinationIds: value.allowedDestinationIds.filter(id => projects.some(p => p.id === id)),
        minimumConfidence: value.minimumConfidence,
      });
      setFeedback("saved");
    } catch {
      setFeedback("error");
    } finally {
      setSaving(false);
    }
  }

  return <section className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm sm:p-8" aria-labelledby="organizer-settings-heading">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 id="organizer-settings-heading" className="text-xl font-bold text-slate-950">{t.title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-700">{t.intro}</p>
      </div>
      <button type="button" onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
        className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">{t.changeLanguage}</button>
    </div>
    {loading ? <p role="status" className="text-slate-700">{t.loading}</p> : error ?
      <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
        <p>{t[error]}</p>
        <button type="button" onClick={() => void load()} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-white">{t.reload}</button>
      </div> : settings && <>
        <div className="space-y-3" role="group" aria-label="Organizer operating mode">
          <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3">
            <input type="radio" name="organizer-mode" checked={draft.mode === "off"}
              onChange={() => setDraft({ ...emptyDraft, minimumConfidence: draft.minimumConfidence })}
              className="mt-1 accent-blue-700" />
            <span className="font-medium text-slate-900">{t.off}</span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3">
            <input type="radio" name="organizer-mode" checked={draft.mode === "suggest"}
              onChange={() => setDraft({ ...draft, mode: "suggest", consentGranted: false,
                providerProcessingConsent: false, allowedDestinationIds: [] })}
              className="mt-1 accent-blue-700" />
            <span className="font-medium text-slate-900">{t.suggest}</span>
          </label>
        </div>
        {draft.mode === "suggest" && <>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 font-semibold text-slate-900">{t.projects}</legend>
            <p className="text-sm text-slate-600">{t.projectsHint}</p>
            {!projects.length ? <p className="text-sm text-amber-700">{t.noProjects}</p> : projects.map(project =>
              <label key={project.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-900">
                <input type="checkbox" checked={draft.allowedDestinationIds.includes(project.id)}
                  onChange={event => setDraft(previous => ({
                    ...previous, allowedDestinationIds: event.target.checked ?
                      [...previous.allowedDestinationIds, project.id] :
                      previous.allowedDestinationIds.filter(id => id !== project.id),
                  }))} className="h-4 w-4 accent-blue-700" />
                <span>{project.title}</span>
              </label>)}
          </fieldset>
          <div className="space-y-3">
            <label className="flex min-h-11 items-start gap-3 text-sm text-slate-900">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-700"
                checked={draft.consentGranted} onChange={event => setDraft(previous => ({ ...previous, consentGranted: event.target.checked }))} />
              <span>{t.consent}</span>
            </label>
            <label className="flex min-h-11 items-start gap-3 text-sm text-slate-900">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-blue-700"
                checked={draft.providerProcessingConsent} onChange={event => setDraft(previous => ({ ...previous, providerProcessingConsent: event.target.checked }))} />
              <span>{t.provider}</span>
            </label>
            <label className="block text-sm font-medium text-slate-900" htmlFor="organizer-confidence">{t.confidence}</label>
            <select id="organizer-confidence" value={draft.minimumConfidence}
              onChange={event => setDraft(previous => ({ ...previous, minimumConfidence: Number(event.target.value) }))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-950">
              <option value={0.8}>80%</option><option value={0.9}>90%</option><option value={0.95}>95%</option><option value={1}>100%</option>
            </select>
          </div>
        </>}
        <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4">
          <button type="button" onClick={() => void save()} disabled={!payload || saving}
            className="min-h-11 rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
            {saving ? t.saving : t.save}
          </button>
          <span className="text-xs text-slate-500">{t.version} {settings.revision}</span>
          {feedback && <p role="status" className={feedback === "saved" ? "text-sm text-green-800" : "text-sm text-amber-800"}>{t[feedback]}</p>}
          {feedback === "conflict" && <button type="button" onClick={() => void load()}
            className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-blue-800">{t.reload}</button>}
        </div>
      </>}
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="font-semibold text-slate-900">{t.laterTitle}</h3>
      <p className="mt-2 text-sm text-slate-700">{t.later}</p>
    </div>
    <p className="text-xs leading-relaxed text-slate-600">{t.note}</p>
  </section>;
}
