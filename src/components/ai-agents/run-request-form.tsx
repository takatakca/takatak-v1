"use client";

import { useActionState } from "react";

import { requestAgentRunAction, type RunRequestState } from "@/app/dashboard/growth/ai-engine/actions";

const initialState: RunRequestState = { ok: null };

export function RunRequestForm({ agentKey, disabled }: { agentKey: string; disabled: boolean }) {
  const [state, formAction, pending] = useActionState(requestAgentRunAction, initialState);
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="agentKey" value={agentKey} />
      <input
        name="brief"
        maxLength={2000}
        disabled={disabled}
        placeholder="Consigne facultative, ex. : « Mettre en avant le spécial de la semaine » · Optional brief"
        className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-indigo-500 disabled:bg-slate-50"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" disabled={disabled || pending} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {pending ? "Envoi… · Queuing…" : "Lancer maintenant · Run now"}
        </button>
        {state.ok === true ? <span className="text-[11px] text-emerald-700">{state.message}</span> : null}
        {state.ok === false ? (
          <span role="alert" className="text-[11px] text-rose-700">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
