"use client";

import { useEffect, useState } from "react";
import {
  makeOrganizerSettingsUpdate,
  organizerDraftFromSettings,
  type OrganizerSettingsDraft,
} from "@/lib/ai-file-organizer/settings-form-model";
import type { OrganizerSettings } from "@/lib/ai-file-organizer/settings-policy";
import { detectLanguage, storeLanguage, type Language } from "@/lib/website/i18n";

type StudioProject = { id: string; title: string };
type SettingsReply = {
  ok: boolean;
  settings?: OrganizerSettings;
  availableProjects?: StudioProject[];
  availableOutputs?: StudioProject[];
  code?: string;
};
type ScreenState = "loading" | "ready" | "unavailable";

const copy = {
  en: {
    heading: "AI File Organizer — Studio",
    intro: "Configure suggested classification for AI-generated Studio text drafts. This screen does not upload, move, publish, or delete files.",
    loading: "Loading workspace organizer settings…",
    unavailable: "Organizer settings are unavailable. Your existing Studio files and drafts are unchanged.",
    mode: "Organizer mode", off: "Off — no AI organizer processing", suggest: "Suggest — approval always required",
    sources: "Supported source", source: "Studio AI-generated text drafts only",
    destination: "Permitted Studio projects (classification destinations)",
    empty: "No Studio projects are available. Create a project in TAKATAKSTUDIO first.",
    confidence: "Minimum confidence",
    consent: "I authorize this workspace to use the selected Studio drafts for classification suggestions.",
    provider: "External AI-provider processing is not authorized or enabled. A separate provider-specific notice and consent will be needed before sending any file content.",
    note: "Classification changes are metadata-only. Physical files, hosting folders and original Studio drafts are never moved. Human approval is mandatory.",
    settingsSaved: "Policy saved. No classification or file movement was executed.",
    disabled: "Organizer disabled and previously granted consents revoked for this policy.",
    invalid: "Select at least one Studio project, grant consent and use a valid confidence threshold.",
    conflict: "Another manager changed this policy. Reload before saving.",
    error: "Could not save settings. No changes were applied.",
    save: "Save settings", revoke: "Turn off and revoke consent", saving: "Saving…", reload: "Reload settings",
    previewTitle: "Preview a filing choice (no AI call)",
    previewSource: "AI-generated Studio draft",
    previewDestination: "Project to associate",
    preview: "Preview permission",
    previewEmpty: "Create a Studio AI draft and save a suggestion policy first.",
    previewOff: "Save an enabled suggestion policy before previewing.",
    previewReady: "Approval would be required. This preview is not recorded and moves nothing.",
    previewError: "Preview not allowed. Verify saved policy, project access and draft ownership.",
  },
  fr: {
    heading: "Organisateur IA — Studio",
    intro: "Configurez les suggestions de classement des brouillons texte générés par Studio. Cet écran ne téléverse, déplace, publie ni supprime aucun fichier.",
    loading: "Chargement des paramètres de l'espace client…",
    unavailable: "Les paramètres de l'organisateur sont indisponibles. Les fichiers et brouillons Studio existants restent inchangés.",
    mode: "Mode de l'organisateur", off: "Désactivé — aucun traitement IA", suggest: "Suggestions — approbation humaine obligatoire",
    sources: "Source prise en charge", source: "Brouillons texte générés par IA dans Studio uniquement",
    destination: "Projets Studio autorisés (destinations de classement)",
    empty: "Aucun projet Studio disponible. Créez d'abord un projet dans TAKATAKSTUDIO.",
    confidence: "Seuil de confiance minimal",
    consent: "J'autorise cet espace client à utiliser les brouillons Studio sélectionnés pour proposer leur classement.",
    provider: "Aucun traitement par un fournisseur IA externe n’est autorisé ni activé. Un avis et un consentement propres au fournisseur seront requis avant le transfert de contenu.",
    note: "Le classement concerne uniquement les métadonnées. Aucun fichier physique, dossier d'hébergement ou brouillon original n'est déplacé. L'approbation humaine demeure obligatoire.",
    settingsSaved: "Paramètres enregistrés. Aucun classement ni déplacement de fichier n'a été exécuté.",
    disabled: "Organisateur désactivé et consentements de cette politique révoqués.",
    invalid: "Sélectionnez un projet Studio, donnez votre consentement et choisissez un seuil valide.",
    conflict: "Un autre gestionnaire a modifié ces paramètres. Rechargez-les avant d'enregistrer.",
    error: "Impossible d'enregistrer. Aucune modification n'a été appliquée.",
    save: "Enregistrer", revoke: "Désactiver et révoquer les consentements", saving: "Enregistrement…", reload: "Recharger",
    previewTitle: "Prévisualiser un classement (sans appel IA)",
    previewSource: "Brouillon IA Studio",
    previewDestination: "Projet à associer",
    preview: "Vérifier les permissions",
    previewEmpty: "Créez un brouillon IA Studio et enregistrez une politique de suggestion.",
    previewOff: "Enregistrez une politique de suggestion active avant de prévisualiser.",
    previewReady: "Une approbation serait obligatoire. L’aperçu n’est pas enregistré et ne déplace rien.",
    previewError: "Aperçu non autorisé. Vérifiez la politique enregistrée, les projets et le brouillon.",
  },
};

export function OrganizerSettingsPanel() {
  const [lang, setLang] = useState<Language>("en");
  const [screen, setScreen] = useState<ScreenState>("loading");
  const [settings, setSettings] = useState<OrganizerSettings | null>(null);
  const [draft, setDraft] = useState<OrganizerSettingsDraft | null>(null);
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [outputs, setOutputs] = useState<StudioProject[]>([]);
  const [previewOutputId, setPreviewOutputId] = useState("");
  const [previewProjectId, setPreviewProjectId] = useState("");
  const [previewNotice, setPreviewNotice] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const t = copy[lang];

  useEffect(() => { setLang(detectLanguage()); }, []);

  async function reload() {
    setNotice("");
    setScreen("loading");
    try {
      const response = await fetch("/api/ai-file-organizer/settings", {
        cache: "no-store", credentials: "same-origin",
      });
      if (!response.ok) { setScreen("unavailable"); return; }
      const body = await response.json() as SettingsReply;
      if (!body.ok || !body.settings || !Array.isArray(body.availableProjects)) {
        setScreen("unavailable");
        return;
      }
      setSettings(body.settings);
      setDraft(organizerDraftFromSettings(body.settings));
      setProjects(body.availableProjects);
      setOutputs(Array.isArray(body.availableOutputs) ? body.availableOutputs : []);
      setPreviewOutputId(body.availableOutputs?.[0]?.id ?? "");
      setPreviewProjectId(body.availableProjects[0]?.id ?? "");
      setPreviewNotice("");
      setScreen("ready");
    } catch {
      setScreen("unavailable");
    }
  }

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/ai-file-organizer/settings", {
          cache: "no-store", credentials: "same-origin", signal: controller.signal,
        });
        if (!response.ok) { if (active) setScreen("unavailable"); return; }
        const body = await response.json() as SettingsReply;
        if (!active) return;
        if (!body.ok || !body.settings || !Array.isArray(body.availableProjects)) {
          setScreen("unavailable");
          return;
        }
        setSettings(body.settings);
        setDraft(organizerDraftFromSettings(body.settings));
        setProjects(body.availableProjects);
      setOutputs(Array.isArray(body.availableOutputs) ? body.availableOutputs : []);
      setPreviewOutputId(body.availableOutputs?.[0]?.id ?? "");
      setPreviewProjectId(body.availableProjects[0]?.id ?? "");
      setPreviewNotice("");
        setScreen("ready");
      } catch {
        if (active) setScreen("unavailable");
      }
    })();
    return () => { active = false; controller.abort(); };
  }, []);

  async function save(forceOff: boolean) {
    if (!draft || !settings || saving) return;
    const candidate: OrganizerSettingsDraft = forceOff ? { ...draft, mode: "off" } : draft;
    const input = makeOrganizerSettingsUpdate(candidate, settings.revision);
    if (!input) { setNotice(t.invalid); return; }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/ai-file-organizer/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(input),
      });
      if (response.status === 409) { setNotice(t.conflict); return; }
      if (!response.ok) { setNotice(t.error); return; }
      const body = await response.json() as SettingsReply;
      if (!body.ok || !body.settings) { setNotice(t.error); return; }
      setSettings(body.settings);
      setDraft(organizerDraftFromSettings(body.settings));
      setNotice(forceOff || body.settings.mode === "off" ? t.disabled : t.settingsSaved);
      setPreviewNotice("");
    } catch {
      setNotice(t.error);
    } finally {
      setSaving(false);
    }
  }

  async function preview() {
    if (!previewOutputId || !previewProjectId || previewing) return;
    if (settings?.mode !== "suggest" || !settings.allowedDestinationIds.includes(previewProjectId)) {
      setPreviewNotice(t.previewOff);
      return;
    }
    setPreviewing(true);
    setPreviewNotice("");
    try {
      const response = await fetch("/api/ai-file-organizer/preview", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outputId: previewOutputId, destinationProjectId: previewProjectId }),
      });
      const result = await response.json() as { ok?: boolean; decision?: string };
      setPreviewNotice(response.ok && result.ok && result.decision === "approval_required"
        ? t.previewReady : t.previewError);
    } catch {
      setPreviewNotice(t.previewError);
    } finally {
      setPreviewing(false);
    }
  }

  const enabled = draft?.mode === "suggest";
  const selected = new Set(draft?.destinationIds ?? []);

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{t.heading}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{t.intro}</p>
        </div>
        <div className="flex gap-2" role="group" aria-label="Language / Langue">
          {(["fr", "en"] as const).map(value => (
            <button key={value} type="button"
              onClick={() => { setLang(value); storeLanguage(value); }}
              aria-pressed={lang === value}
              className={"rounded-lg border px-3 py-2 text-sm font-semibold " +
                (lang === value ? "border-blue-700 bg-blue-700 text-white" : "border-slate-300 bg-white text-slate-700")}>
              {value.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <p className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800">
        {t.note}
      </p>

      {screen !== "ready" || !draft ? (
        <div className="space-y-3">
          <p role="status" className="text-sm text-slate-700">
            {screen === "loading" ? t.loading : t.unavailable}
          </p>
          {screen === "unavailable" && (
            <button type="button" onClick={() => { void reload(); }}
              className="rounded-lg border border-blue-700 px-4 py-2 font-semibold text-blue-700">
              {t.reload}
            </button>
          )}
        </div>
      ) : (
        <form className="space-y-6" onSubmit={event => { event.preventDefault(); void save(false); }}>
          <fieldset className="space-y-3">
            <legend className="font-semibold text-slate-900">{t.mode}</legend>
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-900">
              <input type="radio" name="mode" checked={!enabled} disabled={saving}
                onChange={() => setDraft({ ...draft, mode: "off" })}/>
              {t.off}
            </label>
            <label className="flex min-h-11 items-center gap-3 text-sm text-slate-900">
              <input type="radio" name="mode" checked={Boolean(enabled)} disabled={saving || projects.length === 0}
                onChange={() => setDraft({ ...draft, mode: "suggest" })}/>
              {t.suggest}
            </label>
          </fieldset>
          <p className="text-sm text-slate-700"><strong>{t.sources}:</strong> {t.source}</p>
          <fieldset disabled={saving || !enabled} className="space-y-3">
            <legend className="font-semibold text-slate-900">{t.destination}</legend>
            {projects.length === 0 && <p className="text-sm text-slate-600">{t.empty}</p>}
            {projects.map(project => (
              <label key={project.id} className="flex min-h-11 items-center gap-3 text-sm text-slate-800">
                <input type="checkbox" checked={selected.has(project.id)}
                  onChange={event => setDraft({
                    ...draft,
                    destinationIds: event.target.checked
                      ? [...draft.destinationIds, project.id]
                      : draft.destinationIds.filter(id => id !== project.id),
                  })}/>
                <span className="min-w-0 break-words">{project.title}</span>
              </label>
            ))}
          </fieldset>
          <div className="space-y-2">
            <label className="block font-semibold text-slate-900" htmlFor="organizer-confidence">
              {t.confidence} — {Math.round(draft.minimumConfidence * 100)}%
            </label>
            <input id="organizer-confidence" type="range" min="80" max="100" step="1"
              value={Math.round(draft.minimumConfidence * 100)} disabled={saving || !enabled}
              onChange={event => setDraft({ ...draft, minimumConfidence: Number(event.target.value) / 100 })}
              className="w-full accent-blue-700"/>
          </div>
          <fieldset disabled={saving || !enabled} className="space-y-3">
            <label className="flex items-start gap-3 text-sm leading-6 text-slate-800">
              <input type="checkbox" className="mt-1" checked={draft.consentGranted}
                onChange={event => setDraft({ ...draft, consentGranted: event.target.checked })}/>
              {t.consent}
            </label>
            <p className="text-sm leading-6 text-slate-700">{t.provider}</p>
          </fieldset>
          <div className="flex flex-wrap gap-3">
            <button disabled={saving} type="submit"
              className="min-h-11 rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50">
              {saving ? t.saving : t.save}
            </button>
            <button disabled={saving} type="button" onClick={() => { void save(true); }}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 disabled:opacity-50">
              {t.revoke}
            </button>
          </div>
          <p className="text-sm text-slate-700" role="status" aria-live="polite">{notice}</p>
          <fieldset className="space-y-3 rounded-xl border border-slate-200 p-4">
            <legend className="px-2 font-semibold text-slate-900">{t.previewTitle}</legend>
            {outputs.length === 0 && <p className="text-sm text-slate-600">{t.previewEmpty}</p>}
            <label className="block space-y-1 text-sm text-slate-700">
              <span>{t.previewSource}</span>
              <select value={previewOutputId} onChange={event => setPreviewOutputId(event.target.value)}
                disabled={saving || previewing || outputs.length === 0}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2">
                {outputs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm text-slate-700">
              <span>{t.previewDestination}</span>
              <select value={previewProjectId} onChange={event => setPreviewProjectId(event.target.value)}
                disabled={saving || previewing || projects.length === 0}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white p-2">
                {projects.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <button type="button" disabled={saving || previewing || !previewOutputId || !previewProjectId}
              onClick={() => { void preview(); }}
              className="min-h-11 rounded-lg border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-700 disabled:opacity-50">
              {t.preview}
            </button>
            <p role="status" aria-live="polite" className="text-sm text-slate-700">{previewNotice}</p>
          </fieldset>
        </form>
      )}
    </section>
  );
}
