"use client";

import { useActionState } from "react";

import {
  checkProviderKeyAction,
  removeProviderKeyAction,
  saveProviderKeyAction,
  type ProviderKeyActionState,
} from "@/app/dashboard/admin/ai-providers/actions";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import { adminFr } from "@/lib/admin/admin-fr";

const initialState: ProviderKeyActionState = { ok: null };
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function Feedback({ state }: { state: ProviderKeyActionState }) {
  const fr = useDashboardLanguage() === "fr";
  if (state.ok === true) return <p className="text-xs text-emerald-700">{adminFr(state.message, fr)}</p>;
  if (state.ok === false) {
    return (
      <p role="alert" className="text-xs text-rose-700">
        {adminFr(state.error, fr)}
      </p>
    );
  }
  return null;
}

export function AiProviderKeyRow({
  provider,
  name,
  hasSavedKey,
  checkable,
  canWrite,
}: {
  provider: string;
  name: string;
  hasSavedKey: boolean;
  checkable: boolean;
  canWrite: boolean;
}) {
  const fr = useDashboardLanguage() === "fr";
  const [saveState, saveAction, saving] = useActionState(saveProviderKeyAction, initialState);
  const [checkState, checkAction, checking] = useActionState(checkProviderKeyAction, initialState);
  const [removeState, removeAction, removing] = useActionState(removeProviderKeyAction, initialState);

  if (!canWrite) return (
      <p className="text-xs text-slate-500">
        {fr
          ? "Connectez-vous comme propriétaire ou administrateur de la plateforme pour changer les clés."
          : "Sign in as a platform owner or admin to change keys."}
      </p>
    );

  return (
    <div className="space-y-2">
      <form action={saveAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="provider" value={provider} />
        <label className="min-w-0 flex-1 space-y-1 text-xs font-medium text-slate-700">
          {hasSavedKey ? (fr ? `Remplacer la clé ${name}` : `Replace the ${name} key`) : fr ? `Clé API ${name}` : `${name} API key`}
          <input
            name="apiKey"
            type="password"
            required
            autoComplete="off"
            spellCheck={false}
            minLength={16}
            maxLength={512}
            placeholder={fr ? "Collez la clé" : "Paste the key"}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? (fr ? "Enregistrement…" : "Saving…") : fr ? "Enregistrer" : "Save"}
        </button>
      </form>
      <Feedback state={saveState} />

      {hasSavedKey ? (
        <div className="flex flex-wrap items-center gap-2">
          {checkable ? (
            <form action={checkAction}>
              <input type="hidden" name="provider" value={provider} />
              <button
                type="submit"
                disabled={checking}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-blue-400 disabled:opacity-60"
              >
                {checking ? (fr ? "Test en cours…" : "Testing…") : fr ? "Tester la clé" : "Test the key"}
              </button>
            </form>
          ) : null}
          <form action={removeAction}>
            <input type="hidden" name="provider" value={provider} />
            <button
              type="submit"
              disabled={removing}
              className="rounded-xl border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-700 hover:border-rose-400 disabled:opacity-60"
            >
              {removing ? (fr ? "Retrait…" : "Removing…") : fr ? "Retirer" : "Remove"}
            </button>
          </form>
          <Feedback state={checkState} />
          <Feedback state={removeState} />
        </div>
      ) : null}
    </div>
  );
}
