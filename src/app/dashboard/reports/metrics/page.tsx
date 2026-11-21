import Link from "next/link";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { ReportHeader } from "@/components/reports/report-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/prisma";
import { monthRange } from "@/lib/growth/report";
import { REPORT_BUILDER_SOURCE } from "@/lib/reports/monthly-builder";
import { getServerAccessContext } from "@/lib/security/access-context";

export const dynamic = "force-dynamic";

const TITLE = "Indicateurs des rapports · Report metrics";
const PURPOSE =
  "Les chiffres de vos rapports mensuels, mois par mois · The numbers of your monthly reports, month by month.";

/** Metrics of the last six monthly reports, side by side. Values are the stored snapshots. */
export default async function ReportMetricsPage() {
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped") {
    if (access.mode !== "platform_admin") return <ModulePlaceholder def={{ title: TITLE, purpose: PURPOSE, status: "foundation", functions: [] }} />;
    return (
      <div className="space-y-5">
        <ReportHeader title={TITLE} subtitle={PURPOSE} />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Choisissez un espace client (en haut de l’écran) pour voir ses indicateurs · Select a client workspace to see its metrics.
        </p>
      </div>
    );
  }

  const prisma = getPrisma();
  const reports = prisma
    ? await prisma.report
        .findMany({
          where: {
            clientId: access.activeClientId,
            type: "monthly_business",
            status: { not: "archived" },
            metadata: { path: ["source"], equals: REPORT_BUILDER_SOURCE },
          },
          orderBy: { periodStart: "desc" },
          take: 6,
          select: { id: true, periodStart: true, metrics: { select: { key: true, label: true, value: true, unit: true }, orderBy: { createdAt: "asc" } } },
        })
        .catch(() => [])
    : [];
  const columns = [...reports].reverse();
  const rows = new Map<string, { label: string; unit: string | null }>();
  for (const report of columns) for (const metric of report.metrics) if (!rows.has(metric.key)) rows.set(metric.key, { label: metric.label, unit: metric.unit });
  const monthKey = (date: Date | null) => (date ? date.toISOString().slice(0, 7) : "");

  return (
    <div className="space-y-5">
      <ReportHeader title={TITLE} subtitle={PURPOSE} badges={[{ label: "Données réelles · Live data" }]} />
      <Card>
        <CardHeader
          title="Mois par mois · Month by month"
          subtitle={
            columns.length
              ? "Chaque colonne est un rapport mensuel bâti ; refaites un mois pour mettre ses chiffres à jour · Each column is a built monthly report; rebuild a month to refresh it."
              : undefined
          }
        />
        <CardBody>
          {columns.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">Indicateur · Metric</th>
                    {columns.map((report) => (
                      <th key={report.id} className="py-2 pr-3 text-right font-medium">{monthRange(monthKey(report.periodStart)).label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...rows.entries()].map(([key, row]) => (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td className="py-2 pr-3 text-slate-700">{row.label}</td>
                      {columns.map((report) => {
                        const metric = report.metrics.find((m) => m.key === key);
                        return (
                          <td key={report.id} className="py-2 pr-3 text-right font-semibold tabular-nums text-slate-900">
                            {metric ? `${metric.value}${metric.unit ? ` ${metric.unit}` : ""}` : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Aucun rapport mensuel pour le moment · No monthly report yet.{" "}
              <Link href="/dashboard/reports/builder" className="font-semibold text-emerald-700 hover:underline">
                Bâtir un rapport · Build a report
              </Link>
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
