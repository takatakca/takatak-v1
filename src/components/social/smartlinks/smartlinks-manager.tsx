"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, ExternalLink, Link2, Loader2, Plus, Trash2 } from "lucide-react";

import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import type { SmartLinkView } from "@/lib/social/smartlinks/store";
import { SMARTLINK_LIMITS } from "@/lib/social/smartlinks/policy";

type DraftButton = { id: string | null; label: string; url: string };
type Draft = { id: string | null; slug: string; title: string; bio: string; buttons: DraftButton[] };

const EMPTY_DRAFT: Draft = { id: null, slug: "", title: "", bio: "", buttons: [{ id: null, label: "", url: "https://" }] };

const input =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function SmartLinksManager({
  activated,
  hasBrand,
  brandName,
  canManage,
  origin,
  initialLinks,
}: {
  activated: boolean;
  hasBrand: boolean;
  brandName: string | null;
  canManage: boolean;
  origin: string;
  initialLinks: SmartLinkView[];
}) {
  const fr = useDashboardLanguage() === "fr";
  const [links, setLinks] = useState<SmartLinkView[]>(initialLinks);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const base = origin.replace(/\/+$/, "");

  async function reload() {
    const response = await fetch("/api/social/smartlinks", { cache: "no-store" });
    const body = (await response.json().catch(() => ({}))) as { ok?: boolean; smartLinks?: SmartLinkView[] };
    if (body.ok && body.smartLinks) setLinks(body.smartLinks);
  }

  async function call(key: string, url: string, method: string, payload?: unknown): Promise<boolean> {
    setBusy(key);
    setError("");
    try {
      const response = await fetch(url, {
        method,
        headers: payload ? { "content-type": "application/json" } : undefined,
        body: payload ? JSON.stringify(payload) : undefined,
      });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; message?: string; messageFr?: string };
      if (!response.ok || !body.ok) {
        setError((fr ? body.messageFr : undefined) ?? body.message ?? (fr ? "L’action a échoué." : "The action failed."));
        return false;
      }
      await reload();
      return true;
    } catch {
      setError(fr ? "Erreur réseau. Réessayez." : "Network error. Try again.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    const payload = { slug: draft.slug, title: draft.title, bio: draft.bio, buttons: draft.buttons };
    const ok = draft.id
      ? await call("save", `/api/social/smartlinks/${draft.id}`, "PATCH", payload)
      : await call("save", "/api/social/smartlinks", "POST", payload);
    if (ok) setDraft(null);
  }

  function edit(link: SmartLinkView) {
    setError("");
    setDraft({
      id: link.id,
      slug: link.slug,
      title: link.title,
      bio: link.bio,
      buttons: link.buttons.map((button) => ({ id: button.id, label: button.label, url: button.url })),
    });
  }

  function updateButton(index: number, patch: Partial<DraftButton>) {
    setDraft((current) =>
      current ? { ...current, buttons: current.buttons.map((button, i) => (i === index ? { ...button, ...patch } : button)) } : current,
    );
  }

  function moveButton(index: number, step: -1 | 1) {
    setDraft((current) => {
      if (!current) return current;
      const target = index + step;
      if (target < 0 || target >= current.buttons.length) return current;
      const buttons = [...current.buttons];
      [buttons[index], buttons[target]] = [buttons[target], buttons[index]];
      return { ...current, buttons };
    });
  }

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(`${base}/l/${slug}`);
      setCopied(slug);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
            <Link2 className="h-5 w-5 text-blue-600" aria-hidden /> SmartLinks
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            {fr
              ? "Une page publique de liens pour votre bio (Instagram, TikTok, etc.) : vos boutons, vos liens, et le nombre de visites et de clics des 30 derniers jours."
              : "A public link page for your bio (Instagram, TikTok and more): your buttons, your links, and the visits and clicks of the last 30 days."}
            {brandName ? (fr ? ` Marque : ${brandName}.` : ` Brand: ${brandName}.`) : ""}
          </p>
        </div>
        {activated && hasBrand && canManage && !draft ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setDraft({ ...EMPTY_DRAFT, buttons: [...EMPTY_DRAFT.buttons] });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" aria-hidden /> {fr ? "Nouvelle page de liens" : "New link page"}
          </button>
        ) : null}
      </div>

      {!activated ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {fr
            ? "SmartLinks n’est pas encore activé : la mise à jour de la base de données SmartLinks doit d’abord être appliquée par l’équipe TAKATAK. Vos pages de liens seront disponibles ici dès que ce sera fait."
            : "SmartLinks is not activated yet: the TAKATAK team first has to apply the SmartLinks database update. Your link pages will be available here as soon as it is done."}
        </p>
      ) : !hasBrand ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {fr ? "Choisissez une marque en haut de l’écran pour gérer ses SmartLinks." : "Choose a brand at the top of the screen to manage its SmartLinks."}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {error}
        </p>
      ) : null}

      {draft ? (
        <form
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <h2 className="text-sm font-semibold text-slate-900">
            {draft.id ? (fr ? "Modifier la page de liens" : "Edit link page") : fr ? "Nouvelle page de liens" : "New link page"}
          </h2>
          <label className="block space-y-1 text-xs font-medium text-slate-700">
            {fr ? "Adresse" : "Address"}
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap text-sm text-slate-500">{base}/l/</span>
              <input
                className={input}
                value={draft.slug}
                maxLength={SMARTLINK_LIMITS.slugMax}
                placeholder={fr ? "ma-marque" : "my-brand"}
                onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                required
              />
            </div>
          </label>
          <label className="block space-y-1 text-xs font-medium text-slate-700">
            {fr ? "Titre" : "Title"}
            <input
              className={input}
              value={draft.title}
              maxLength={SMARTLINK_LIMITS.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              required
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-slate-700">
            {fr ? "Texte court (facultatif)" : "Short text (optional)"}
            <textarea
              className={input}
              rows={2}
              value={draft.bio}
              maxLength={SMARTLINK_LIMITS.bio}
              onChange={(event) => setDraft({ ...draft, bio: event.target.value })}
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-slate-700">{fr ? "Boutons" : "Buttons"}</legend>
            {draft.buttons.map((button, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
                <input
                  className={`${input} min-w-0 flex-1`}
                  value={button.label}
                  maxLength={SMARTLINK_LIMITS.label}
                  placeholder={fr ? "Libellé (ex. : Réserver)" : "Label (e.g. Book now)"}
                  aria-label={fr ? `Libellé du bouton ${index + 1}` : `Button ${index + 1} label`}
                  onChange={(event) => updateButton(index, { label: event.target.value })}
                  required
                />
                <input
                  className={`${input} min-w-0 flex-[2]`}
                  value={button.url}
                  maxLength={SMARTLINK_LIMITS.url}
                  type="url"
                  placeholder="https://"
                  aria-label={fr ? `Lien du bouton ${index + 1}` : `Button ${index + 1} link`}
                  onChange={(event) => updateButton(index, { url: event.target.value })}
                  required
                />
                <div className="flex gap-1">
                  <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-white" onClick={() => moveButton(index, -1)} aria-label={fr ? "Monter" : "Move up"}>
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-white" onClick={() => moveButton(index, 1)} aria-label={fr ? "Descendre" : "Move down"}>
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-rose-600 hover:bg-white"
                    onClick={() => setDraft({ ...draft, buttons: draft.buttons.filter((_, i) => i !== index) })}
                    aria-label={fr ? "Retirer ce bouton" : "Remove this button"}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
            {draft.buttons.length < SMARTLINK_LIMITS.buttons ? (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, buttons: [...draft.buttons, { id: null, label: "", url: "https://" }] })}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden /> {fr ? "Ajouter un bouton" : "Add a button"}
              </button>
            ) : null}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {fr ? "Enregistrer" : "Save"}
            </button>
            <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
              {fr ? "Annuler" : "Cancel"}
            </button>
          </div>
        </form>
      ) : null}

      {activated && hasBrand && !draft && links.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-sm text-slate-500">
          {canManage
            ? fr
              ? "Aucune page de liens pour cette marque. Créez-en une, ajoutez vos boutons, publiez-la, puis mettez son adresse dans votre bio."
              : "No link page for this brand yet. Create one, add your buttons, publish it, then put its address in your bio."
            : fr
              ? "Aucune page de liens pour cette marque."
              : "No link page for this brand yet."}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {links.map((link) => {
          const published = link.status === "published";
          const url = `${base}/l/${link.slug}`;
          return (
            <article key={link.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">{link.title}</h3>
                  <p className="truncate font-mono text-xs text-slate-500">{url}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                >
                  {published ? (fr ? "Publiée" : "Published") : fr ? "Brouillon" : "Draft"}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-xl bg-slate-50 p-2">
                  <dt className="text-[11px] text-slate-500">{fr ? "Visites (30 j)" : "Visits (30 d)"}</dt>
                  <dd className="text-lg font-semibold text-slate-900">{link.views30d}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 p-2">
                  <dt className="text-[11px] text-slate-500">{fr ? "Clics (30 j)" : "Clicks (30 d)"}</dt>
                  <dd className="text-lg font-semibold text-slate-900">{link.clicks30d}</dd>
                </div>
              </dl>
              <ul className="space-y-1 text-xs text-slate-600">
                {link.buttons.map((button) => (
                  <li key={button.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{button.label}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {button.clicks30d} {fr ? "clics" : "clicks"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                {published ? (
                  <>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden /> {fr ? "Ouvrir" : "Open"}
                    </a>
                    <button
                      type="button"
                      onClick={() => void copy(link.slug)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300"
                    >
                      {copied === link.slug ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
                      {copied === link.slug ? (fr ? "Copiée" : "Copied") : fr ? "Copier l’adresse" : "Copy address"}
                    </button>
                  </>
                ) : null}
                {canManage ? (
                  <>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => edit(link)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-300 disabled:opacity-60"
                    >
                      {fr ? "Modifier" : "Edit"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void call(`status-${link.id}`, `/api/social/smartlinks/${link.id}`, "PATCH", { status: published ? "draft" : "published" })}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      {published ? (fr ? "Retirer de la publication" : "Unpublish") : fr ? "Publier" : "Publish"}
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        if (window.confirm(fr ? "Supprimer cette page de liens et ses statistiques ?" : "Delete this link page and its statistics?")) {
                          void call(`delete-${link.id}`, `/api/social/smartlinks/${link.id}`, "DELETE");
                        }
                      }}
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:border-rose-400 disabled:opacity-60"
                    >
                      {fr ? "Supprimer" : "Delete"}
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
