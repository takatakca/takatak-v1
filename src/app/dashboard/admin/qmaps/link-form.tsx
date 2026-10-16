"use client";

import { useActionState } from "react";

import { linkQmapsWorkspaceAction, type QmapsLinkFormState } from "@/app/dashboard/admin/qmaps/actions";

const initialState: QmapsLinkFormState = { ok: null };
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function QmapsLinkForm({ clients }: { clients: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(linkQmapsWorkspaceAction, initialState);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-2">
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Espace client
        <select name="clientId" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Choisir…
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Identifiant de la fiche QMAPS
        <input name="businessId" required placeholder="UUID QMAPS" className={inputClass} />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Nom de la fiche
        <input name="name" required maxLength={160} className={inputClass} />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Ville
        <input name="city" maxLength={80} className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={pending || clients.length === 0}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Lier la fiche"}
        </button>
        {state.ok === true ? (
          <p className={state.confirmed ? "text-xs text-emerald-700" : "text-xs text-amber-700"}>{state.message}</p>
        ) : null}
        {state.ok === false ? (
          <p role="alert" className="text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
