import { reauditDueAction } from "@/app/dashboard/seo/actions";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { isDue, latestByUrl, MAX_REAUDIT_PER_RUN, type SeoScoreSnapshot } from "@/lib/seo/score-history";

export function SeoScoreHistory({
  rows,
  reauditCount,
}: {
  rows: SeoScoreSnapshot[];
  reauditCount: number | null;
}) {
  const now = new Date();
  const latest = latestByUrl(rows);
  const due = latest.filter((row) => isDue(row.auditedAt, now));

  return (
    <Card>
      <CardHeader
        title="Historique des scores"
        subtitle="Un ré-audit est dû 7 jours après le dernier contrôle de ce site. Le PDF ne porte pas la marque interne."
      />
      <CardBody className="space-y-4">
        {reauditCount !== null ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Ré-audits terminés : {reauditCount}. Rien n&apos;est publié à l&apos;extérieur.
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="text-sm text-slate-600">
            Aucun score enregistré pour cet espace. Lancez un audit : seul le résumé est conservé, pas le HTML.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
            {rows.slice(0, 20).map((row) => {
              let host = row.url;
              try {
                host = new URL(row.url).host;
              } catch {
                host = row.url;
              }
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-900">{host}</p>
                    <p className="text-xs text-slate-500">{row.auditedAt.slice(0, 10)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-900">{row.score}/100</span>
                    <a href={`/dashboard/seo/history/pdf?id=${row.id}`} className="text-xs font-medium text-indigo-700 hover:text-indigo-500">
                      PDF
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {due.length ? (
          <form action={reauditDueAction} className="space-y-2">
            <button
              type="submit"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              {`Lancer les ré-audits dus (${Math.min(due.length, MAX_REAUDIT_PER_RUN)})`}
            </button>
            {due.length > MAX_REAUDIT_PER_RUN ? (
              <p className="text-xs text-slate-500">Les autres sites restent dus pour le prochain passage.</p>
            ) : null}
          </form>
        ) : rows.length ? (
          <p className="text-xs text-slate-500">Aucun site n&apos;a encore 7 jours depuis son dernier score.</p>
        ) : null}
      </CardBody>
    </Card>
  );
}
