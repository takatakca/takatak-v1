"use client";

import { useActionState } from "react";
import { auditSiteAction, type SiteAuditState } from "@/app/dashboard/seo/actions";
import type { AuditCheckStatus } from "@/lib/seo/site-audit";

const initialState: SiteAuditState = { ok: null };

const STATUS_STYLE: Record<AuditCheckStatus, { dot: string; label: string }> = {
  pass: { dot: "bg-emerald-500", label: "Pass" },
  warn: { dot: "bg-amber-400", label: "Improve" },
  fail: { dot: "bg-rose-500", label: "Fix" },
};

function scoreTone(score: number): string {
  if (score >= 85) return "text-emerald-600 border-emerald-200 bg-emerald-50";
  if (score >= 60) return "text-amber-600 border-amber-200 bg-amber-50";
  return "text-rose-600 border-rose-200 bg-rose-50";
}

export function SiteAuditForm({ defaultUrl = "" }: { defaultUrl?: string }) {
  const [state, formAction, pending] = useActionState(auditSiteAction, initialState);
  const report = state.ok === true ? state.report : null;
  const order: Record<AuditCheckStatus, number> = { fail: 0, warn: 1, pass: 2 };
  const checks = report ? [...report.checks].sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight) : [];

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="audit-url" className="sr-only">
          Website address
        </label>
        <input
          id="audit-url"
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          required
          defaultValue={defaultUrl}
          placeholder="example.com"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Auditing…" : "Run audit"}
        </button>
      </form>

      {state.ok === false ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {state.error}
        </p>
      ) : null}

      {report ? (
        <div className="space-y-4" aria-live="polite">
          <div className="flex flex-wrap items-center gap-4">
            <div className={`flex h-20 w-20 flex-col items-center justify-center rounded-2xl border ${scoreTone(report.score)}`}>
              <span className="text-2xl font-bold">{report.score}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide">score</span>
            </div>
            <div className="min-w-0 flex-1 text-xs leading-5 text-slate-600">
              <p className="truncate font-medium text-slate-900">{report.finalUrl}</p>
              <p>
                HTTP {report.statusCode} · {report.responseMs} ms · {(report.bytes / 1024).toFixed(0)} KB ·{" "}
                {report.facts.wordCount} words · {report.facts.internalLinks} internal / {report.facts.externalLinks} external links
              </p>
              <p className="text-slate-400">Audited {new Date(report.auditedAt).toLocaleString()}</p>
            </div>
          </div>

          {report.facts.title || report.facts.description ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Google preview</p>
              <p className="mt-1 truncate text-xs text-emerald-700">{report.finalUrl}</p>
              <p className="truncate text-base text-indigo-700">{report.facts.title ?? "(no title)"}</p>
              <p className="line-clamp-2 text-xs text-slate-600">{report.facts.description ?? "(no meta description)"}</p>
            </div>
          ) : null}

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_STYLE[c.status].dot}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">
                    {c.label} <span className="ml-1 text-[11px] font-normal text-slate-400">{STATUS_STYLE[c.status].label}</span>
                  </p>
                  <p className="break-words text-xs text-slate-600">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
