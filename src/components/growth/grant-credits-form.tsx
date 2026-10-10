"use client";

import { useActionState } from "react";

import { grantCreditsAction, type GrantState } from "@/app/dashboard/growth/ai-engine/actions";

const initialState: GrantState = { ok: null };
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function GrantCreditsForm({ clients, nonce }: { clients: Array<{ id: string; name: string; balance: number }>; nonce: string }) {
  const [state, formAction, pending] = useActionState(grantCreditsAction, initialState);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-5">
      <input type="hidden" name="nonce" value={nonce} />
      <label className="space-y-1 text-xs font-medium text-slate-700 md:col-span-2">
        Client
        <select name="clientId" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.balance.toLocaleString("en-CA")} cr)
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Credits
        <input name="credits" type="number" step={1} required placeholder="500" className={inputClass} />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Type
        <select name="reason" defaultValue="grant" className={inputClass}>
          <option value="grant">Grant (free)</option>
          <option value="purchase">Purchase (paid)</option>
          <option value="adjustment">Adjustment (+/−)</option>
        </select>
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Note
        <input name="note" maxLength={280} placeholder="Invoice #, reason…" className={inputClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-5">
        <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Saving…" : "Apply credits"}
        </button>
        {state.ok === true ? <p className="text-xs text-emerald-700">{state.message}</p> : null}
        {state.ok === false ? (
          <p role="alert" className="text-xs text-rose-700">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
