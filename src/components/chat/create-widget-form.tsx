"use client";

import { useActionState } from "react";

import { createChatWidgetAction, type WidgetFormState } from "@/app/dashboard/growth/conversations/actions";

const initialState: WidgetFormState = { ok: null };
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export function CreateWidgetForm({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createChatWidgetAction, initialState);
  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Business name *
          <input name="name" required maxLength={80} placeholder="Garage Verdun" className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Website domain *
          <input name="domain" required maxLength={253} placeholder="garageverdun.ca" className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Brand (optional)
          <select name="businessBrandId" defaultValue="" className={inputClass}>
            <option value="">— None —</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700 md:col-span-2">
          Greeting
          <input name="greeting" maxLength={200} placeholder="Bonjour ! Comment pouvons-nous vous aider ?" className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Color
          <input name="accentColor" type="color" defaultValue="#4f46e5" className="h-10 w-full rounded-xl border border-slate-300" />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-700">
          WhatsApp fallback (optional)
          <input name="whatsappNumber" inputMode="tel" maxLength={24} placeholder="+1 514 555 0123" className={inputClass} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Creating…" : "Create chat"}
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
