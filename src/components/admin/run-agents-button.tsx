"use client";

import { useActionState } from "react";

import { runWaitingAgentsAction, type RunAgentsState } from "@/app/dashboard/admin/ai/actions";
import { useDashboardLanguage } from "@/components/layout/dashboard-language";
import { adminFr } from "@/lib/admin/admin-fr";

export function RunAgentsButton({ disabledReason }: { disabledReason: string | null }) {
  const fr = useDashboardLanguage() === "fr";
  const [state, action, pending] = useActionState<RunAgentsState, FormData>(runWaitingAgentsAction, { ok: null });
  return (
    <form action={action} className="space-y-2">
      <button
        type="submit"
        disabled={pending || disabledReason !== null}
        className="inline-flex items-center rounded-xl bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {pending ? (fr ? "En cours…" : "Running…") : fr ? "Lancer les agents en attente" : "Run waiting agents now"}
      </button>
      {disabledReason ? <p className="text-xs text-slate-500">{adminFr(disabledReason, fr)}</p> : null}
      {state.ok === true ? <p role="status" className="text-xs text-emerald-700">{adminFr(state.message, fr)}</p> : null}
      {state.ok === false ? <p role="alert" className="text-xs text-red-700">{adminFr(state.error, fr)}</p> : null}
    </form>
  );
}
