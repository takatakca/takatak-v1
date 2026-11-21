"use client";

import { useActionState } from "react";
import { ArrowDown, CheckCircle2, Loader2, Route, TriangleAlert, XCircle } from "lucide-react";

import { redirectCheckAction, type RedirectCheckState } from "@/app/dashboard/web-hosting/redirects/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

const initial: RedirectCheckState = { ok: null };

const ICON = {
  pass: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />,
  warn: <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />,
  fail: <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />,
} as const;

export function RedirectCheckForm() {
  const [state, action, pending] = useActionState(redirectCheckAction, initial);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Suivre un lien · Follow a link"
          subtitle="Chaque étape, son code et la page finale, comme un navigateur. Utile après un déménagement de site · Each step, its code and the final page, like a browser. Useful after moving a site."
        />
        <CardBody>
          <form action={action} className="flex flex-wrap items-end gap-3">
            <label className="min-w-[240px] flex-1 space-y-1 text-xs font-medium text-slate-600">
              Adresse · Address
              <input
                name="url"
                required
                placeholder="http://votresite.ca/ancienne-page"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
            </label>
            <button
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Route className="h-3.5 w-3.5" />}
              {pending ? "Suivi… · Following…" : "Suivre · Follow"}
            </button>
          </form>
          {state.ok === false ? <p role="alert" className="mt-3 text-xs text-rose-700">{state.error}</p> : null}
        </CardBody>
      </Card>

      {state.ok ? (
        <Card>
          <CardHeader title="Résultat · Result" subtitle={state.report.finalUrl ? `Page finale · Final page : ${state.report.finalUrl}` : undefined} />
          <CardBody className="space-y-4">
            <ol className="space-y-1">
              {state.report.hops.map((hop, index) => (
                <li key={`${hop.url}-${index}`} className="space-y-1">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs">
                    <span className={`rounded px-1.5 py-0.5 font-mono font-semibold ${hop.status < 300 ? "bg-emerald-100 text-emerald-800" : hop.status < 400 ? "bg-sky-100 text-sky-800" : "bg-rose-100 text-rose-800"}`}>
                      {hop.status}
                    </span>
                    <span className="break-all font-mono text-slate-700">{hop.url}</span>
                  </div>
                  {hop.location ? <ArrowDown className="ml-4 h-3.5 w-3.5 text-slate-300" aria-hidden /> : null}
                </li>
              ))}
            </ol>
            <ul className="divide-y divide-slate-100">
              {state.report.findings.map((finding) => (
                <li key={finding.key} className="flex items-start gap-3 py-2">
                  {ICON[finding.status]}
                  <p className="text-xs text-slate-700">{finding.detail}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
