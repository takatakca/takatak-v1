"use client";

import { useActionState } from "react";

import { pageSpeedAction, type PageSpeedState } from "@/app/dashboard/seo/actions";
import type { Grade } from "@/lib/seo/pagespeed-parse";

const initialState: PageSpeedState = { ok: null };
const GRADE: Record<Grade, { dot: string; label: string }> = {
  good: { dot: "bg-emerald-500", label: "Good" },
  needs_improvement: { dot: "bg-amber-400", label: "Needs work" },
  poor: { dot: "bg-rose-500", label: "Poor" },
};

export function PageSpeedForm({ configured }: { configured: boolean }) {
  const [state, formAction, pending] = useActionState(pageSpeedAction, initialState);
  const report = state.ok === true ? state.report : null;
  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="psi-url" className="sr-only">
          Website address
        </label>
        <input
          id="psi-url"
          name="url"
          required
          disabled={!configured}
          placeholder="example.com"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
        />
        <select name="strategy" disabled={!configured} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          <option value="mobile">Mobile</option>
          <option value="desktop">Desktop</option>
        </select>
        <button type="submit" disabled={!configured || pending} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Testing… (up to a minute)" : "Test speed"}
        </button>
      </form>
      {!configured ? <p className="text-xs text-slate-500">Add a Google PageSpeed API key (PAGESPEED_API_KEY) to enable Core Web Vitals tests.</p> : null}
      {state.ok === false ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}
      {report ? (
        <div className="space-y-3" aria-live="polite">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-20 w-20 flex-col items-center justify-center rounded-2xl border ${
                report.score === null ? "border-slate-200" : report.score >= 90 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : report.score >= 50 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              <span className="text-2xl font-bold">{report.score ?? "—"}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">{report.strategy}</span>
            </div>
            <div className="text-xs text-slate-600">
              <p className="font-medium text-slate-900">{report.url}</p>
              <p>Lighthouse performance score (lab test by Google).</p>
              {report.fieldCategory ? <p>Real-user experience (Chrome UX Report): {report.fieldCategory.toLowerCase()}</p> : <p>Not enough real-user data from Chrome yet.</p>}
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {report.metrics.map((m) => (
              <li key={m.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] text-slate-500">{m.label}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-base font-semibold text-slate-900">
                  <span className={`h-2 w-2 rounded-full ${GRADE[m.grade].dot}`} aria-hidden />
                  {m.display}
                </p>
                <p className="text-[10px] text-slate-400">{GRADE[m.grade].label}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
