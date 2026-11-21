"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert, XCircle } from "lucide-react";

import { securityCheckAction, type SecurityCheckState } from "@/app/dashboard/web-hosting/security/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

const initial: SecurityCheckState = { ok: null };

const ICON = {
  pass: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />,
  warn: <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />,
  fail: <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />,
} as const;

const STATUS_TEXT = { pass: "Bon · Good", warn: "À améliorer · Improve", fail: "À corriger · Fix" } as const;

export function SecurityCheckForm({ suggestions }: { suggestions: string[] }) {
  const [state, action, pending] = useActionState(securityCheckAction, initial);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Vérifier un site · Check a website"
          subtitle="HTTPS, redirection, certificat et en-têtes de sécurité, vus de l’extérieur comme un visiteur. Rien n’est modifié ni enregistré · Seen from the outside like a visitor. Nothing is changed or stored."
        />
        <CardBody>
          <form action={action} className="flex flex-wrap items-end gap-3">
            <label className="min-w-[240px] flex-1 space-y-1 text-xs font-medium text-slate-600">
              Adresse du site · Website address
              <input
                name="url"
                required
                list="security-sites"
                defaultValue={suggestions[0] ?? ""}
                placeholder="votresite.ca"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
              <datalist id="security-sites">
                {suggestions.map((site) => <option key={site} value={site} />)}
              </datalist>
            </label>
            <button
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {pending ? "Vérification… · Checking…" : "Vérifier · Check"}
            </button>
          </form>
          {state.ok === false ? <p role="alert" className="mt-3 text-xs text-rose-700">{state.error}</p> : null}
        </CardBody>
      </Card>

      {state.ok ? (
        <Card>
          <CardHeader
            title={`${state.report.host} — ${state.report.score} / 100`}
            subtitle="Pointage pondéré : HTTPS et certificat comptent le plus · Weighted score: HTTPS and the certificate count most."
          />
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {state.report.checks.map((check) => (
                <li key={check.key} className="flex items-start gap-3 py-2.5">
                  {ICON[check.status]}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{check.label}</p>
                    <p className="text-xs text-slate-500">{check.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-slate-500">{STATUS_TEXT[check.status]}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
