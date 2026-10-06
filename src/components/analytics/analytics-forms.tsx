"use client";

import { useActionState } from "react";

import { createAudienceAction, createSiteAction, linkGoogleAction, type AnalyticsFormState } from "@/app/dashboard/growth/analytics/actions";

const initialState: AnalyticsFormState = { ok: null };
const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

function Feedback({ state }: { state: AnalyticsFormState }) {
  if (state.ok === true) return <p className="text-xs text-emerald-700">{state.message}</p>;
  if (state.ok === false)
    return (
      <p role="alert" className="text-xs text-rose-700">
        {state.error}
      </p>
    );
  return null;
}

export function CreateSiteForm({ brands }: { brands: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createSiteAction, initialState);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-4">
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Website name *
        <input name="name" required maxLength={80} placeholder="Garage Verdun" className={inputClass} />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Domain *
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
      <div className="flex items-end gap-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Adding…" : "Add website"}
        </button>
      </div>
      <div className="md:col-span-4">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function CreateAudienceForm({ sites }: { sites: Array<{ id: string; name: string }> }) {
  const [state, formAction, pending] = useActionState(createAudienceAction, initialState);
  return (
    <form action={formAction} className="grid gap-3 md:grid-cols-4">
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Audience name *
        <input name="name" required maxLength={80} placeholder="Viewed pricing, no call" className={inputClass} />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Website
        <select name="siteId" className={inputClass}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Visited pages starting with
        <input name="pathPrefixes" maxLength={500} placeholder="/pricing, /booking" className={inputClass} />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        Or did events
        <input name="eventNames" maxLength={500} placeholder="form_submit, call_click" className={inputClass} />
      </label>
      <label className="space-y-1 text-xs font-medium text-slate-700">
        In the last (days)
        <input name="lookbackDays" type="number" min={1} max={540} defaultValue={30} className={inputClass} />
      </label>
      <div className="flex items-end gap-3 md:col-span-3">
        <button type="submit" disabled={pending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save audience"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function LinkGoogleForm({
  siteId,
  ga4PropertyId,
  searchConsoleProperty,
}: {
  siteId: string;
  ga4PropertyId: string | null;
  searchConsoleProperty: string | null;
}) {
  const [state, formAction, pending] = useActionState(linkGoogleAction, initialState);
  return (
    <form action={formAction} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="siteId" value={siteId} />
      <label className="space-y-1 text-[11px] font-medium text-slate-600">
        GA4 property ID
        <input name="ga4PropertyId" defaultValue={ga4PropertyId ?? ""} placeholder="123456789" inputMode="numeric" maxLength={30} className={inputClass} />
      </label>
      <label className="space-y-1 text-[11px] font-medium text-slate-600">
        Search Console property
        <input name="searchConsoleProperty" defaultValue={searchConsoleProperty ?? ""} placeholder="sc-domain:example.com" maxLength={300} className={inputClass} />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={pending} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 disabled:opacity-60">
          {pending ? "Saving…" : "Save Google links"}
        </button>
      </div>
      <div className="md:col-span-3">
        <Feedback state={state} />
      </div>
    </form>
  );
}
