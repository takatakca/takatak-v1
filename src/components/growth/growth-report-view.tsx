import type { GrowthReport, ReportNumbers } from "@/lib/growth/report";
import { percentChange } from "@/lib/growth/report";

const METRICS: Array<{ key: keyof ReportNumbers; label: string; format?: (n: number) => string }> = [
  { key: "visits", label: "Visites du site" },
  { key: "pageviews", label: "Pages vues" },
  { key: "conversions", label: "Actions de contact" },
  { key: "leads", label: "Nouveaux prospects" },
  { key: "ratings", label: "Nouveaux avis" },
  { key: "publicReviewClicks", label: "Avis publics (Google/Facebook)" },
  { key: "conversations", label: "Conversations clavardage" },
  { key: "aiRunsCompleted", label: "Tâches IA réalisées" },
  { key: "adImpressions", label: "Impressions TAKATAK ADS" },
  { key: "adClicks", label: "Clics TAKATAK ADS" },
];

function Delta({ current, previous }: { current: number; previous: number }) {
  const pct = percentChange(current, previous);
  if (pct === null) return <span className="text-[11px] text-emerald-700">nouveau</span>;
  if (pct === 0) return <span className="text-[11px] text-slate-400">= mois préc.</span>;
  return <span className={`text-[11px] ${pct > 0 ? "text-emerald-700" : "text-rose-700"}`}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)} %</span>;
}

function List({ title, rows, empty }: { title: string; rows: Array<{ label: string; count: number }>; empty: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 break-inside-avoid">
      <p className="text-xs font-semibold text-slate-900">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">{empty}</p>
      ) : (
        <ol className="mt-2 space-y-1 text-xs">
          {rows.map((r) => (
            <li key={r.label} className="flex justify-between gap-3">
              <span className="truncate text-slate-700">{r.label}</span>
              <span className="font-semibold text-slate-900">{r.count.toLocaleString("fr-CA")}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function GrowthReportView({ report }: { report: GrowthReport }) {
  return (
    <article className="space-y-6 bg-white text-slate-900">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Rapport de croissance TAKATAK</p>
          <h1 className="mt-1 text-2xl font-bold">{report.clientName}</h1>
          <p className="text-sm capitalize text-slate-600">{report.month.label}</p>
        </div>
        <p className="text-[11px] text-slate-400">Données réelles enregistrées par TAKATAK — aucune estimation.</p>
      </header>

      <section className="rounded-xl bg-indigo-50 p-4 break-inside-avoid">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Faits saillants</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-indigo-950">
          {report.highlights.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {METRICS.map((m) => (
          <div key={m.key} className="rounded-xl border border-slate-200 p-3 break-inside-avoid">
            <p className="text-[11px] text-slate-500">{m.label}</p>
            <p className="mt-1 text-xl font-bold">{Number(report.current[m.key] ?? 0).toLocaleString("fr-CA")}</p>
            <Delta current={Number(report.current[m.key] ?? 0)} previous={Number(report.previous[m.key] ?? 0)} />
          </div>
        ))}
        <div className="rounded-xl border border-slate-200 p-3 break-inside-avoid">
          <p className="text-[11px] text-slate-500">Note moyenne</p>
          <p className="mt-1 text-xl font-bold">{report.current.averageRating !== null ? `${report.current.averageRating.toFixed(1)} ★` : "—"}</p>
          <span className="text-[11px] text-slate-400">
            {report.previous.averageRating !== null ? `mois préc. ${report.previous.averageRating.toFixed(1)}` : " "}
          </span>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <List title="Pages les plus visitées" rows={report.topPages} empty="Aucune donnée." />
        <List title="Sources de trafic" rows={report.topSources} empty="Trafic direct uniquement." />
        <List title="Actions de contact" rows={report.conversionsByType} empty="Aucune action enregistrée." />
      </section>

      <footer className="border-t border-slate-200 pt-3 text-[11px] text-slate-400">
        Préparé par GROUPE TAKATAK · Les visites sont des visiteurs uniques par jour, mesurés sans témoins (cookies).
      </footer>
    </article>
  );
}
