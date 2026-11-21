"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, Search, TriangleAlert, XCircle } from "lucide-react";

import { dnsCheckAction, type DnsCheckState } from "@/app/dashboard/web-hosting/dns/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";

const initial: DnsCheckState = { ok: null };

const ICON = {
  pass: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />,
  warn: <TriangleAlert className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />,
  fail: <XCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />,
} as const;

export function DnsCheckForm({ suggestions }: { suggestions: string[] }) {
  const [state, action, pending] = useActionState(dnsCheckAction, initial);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Vérifier un domaine · Check a domain"
          subtitle="Lecture seule : ce que l’internet voit de votre domaine, pour le site et pour le courriel. Rien n’est modifié · Read only: what the internet sees of your domain, for the website and for email. Nothing is changed."
        />
        <CardBody>
          <form action={action} className="flex flex-wrap items-end gap-3">
            <label className="min-w-[240px] flex-1 space-y-1 text-xs font-medium text-slate-600">
              Domaine · Domain
              <input
                name="domain"
                required
                list="dns-domains"
                defaultValue={suggestions[0] ?? ""}
                placeholder="votresite.ca"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600"
              />
              <datalist id="dns-domains">
                {suggestions.map((domain) => <option key={domain} value={domain} />)}
              </datalist>
            </label>
            <button
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {pending ? "Lecture… · Reading…" : "Vérifier · Check"}
            </button>
          </form>
          {state.ok === false ? <p role="alert" className="mt-3 text-xs text-rose-700">{state.error}</p> : null}
        </CardBody>
      </Card>

      {state.ok ? (
        <>
          <Card>
            <CardHeader title={state.report.domain} subtitle="Site web et courriel · Website and email" />
            <CardBody>
              <ul className="divide-y divide-slate-100">
                {state.report.checks.map((check) => (
                  <li key={check.key} className="flex items-start gap-3 py-2.5">
                    {ICON[check.status]}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{check.label}</p>
                      <p className="break-words text-xs text-slate-500">{check.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Enregistrements publics · Public records" />
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {state.report.records.map((record, index) => (
                      <tr key={`${record.type}-${index}`} className="border-b border-slate-100 last:border-0">
                        <td className="w-28 py-1.5 pr-3 font-mono font-semibold text-slate-700">{record.type}</td>
                        <td className="break-all py-1.5 font-mono text-slate-600">{record.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
