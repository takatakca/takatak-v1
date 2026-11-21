import Link from "next/link";
import { FileDown, Sparkles } from "lucide-react";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { ReportHeader } from "@/components/reports/report-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/prisma";
import { monthRange } from "@/lib/growth/report";
import { buildableMonths, REPORT_BUILDER_SOURCE } from "@/lib/reports/monthly-builder";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import { isUuid } from "@/lib/validation/common";

import { buildMonthlyReport } from "./actions";

export const dynamic = "force-dynamic";

const TITLE = "Rapports mensuels · Monthly reports";
const PURPOSE =
  "Un rapport par mois avec les vrais chiffres de votre espace : visites, actions de contact, prospects, avis, publicité et IA · One report per month with your workspace's real numbers: visits, contact actions, leads, reviews, ads and AI.";

const NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  refused: { tone: "warn", text: "Choisissez un des 12 derniers mois. · Choose one of the last 12 months." },
  denied: { tone: "warn", text: "Votre rôle ne permet pas de créer un rapport dans cet espace. · Your role cannot create reports in this workspace." },
  unavailable: { tone: "warn", text: "Le rapport n’a pas pu être créé pour le moment ; réessayez. · The report could not be built right now; try again." },
};

const SECTIONS = [
  "Faits saillants · Highlights",
  "Comparaison avec le mois précédent · Compared with last month",
  "Site web : pages et sources · Website: pages and sources",
  "Clients et avis · Customers and reviews",
  "13 indicateurs (visites, contacts, prospects, avis, publicité, IA) · 13 metrics",
];

export default async function ReportBuilderPage({ searchParams }: { searchParams: Promise<{ built?: string | string[] }> }) {
  const params = await searchParams;
  const built = Array.isArray(params.built) ? params.built[0] : params.built;
  const { access } = await getServerAccessContext();

  if (access.mode !== "client_scoped") {
    if (access.mode !== "platform_admin") return <ModulePlaceholder def={{ title: TITLE, purpose: PURPOSE, status: "foundation", functions: [] }} />;
    return (
      <div className="space-y-5">
        <ReportHeader title={TITLE} subtitle={PURPOSE} />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Choisissez un espace client (en haut de l’écran) pour bâtir son rapport · Select a client workspace to build its report.
        </p>
      </div>
    );
  }

  const canBuild = hasEffectivePermission(access, "view_reports") && hasEffectivePermission(access, "create_content");
  const prisma = getPrisma();
  const reports = prisma
    ? await prisma.report
        .findMany({
          where: { clientId: access.activeClientId, type: "monthly_business", status: { not: "archived" }, metadata: { path: ["source"], equals: REPORT_BUILDER_SOURCE } },
          orderBy: { periodStart: "desc" },
          take: 12,
          select: { id: true, title: true, updatedAt: true },
        })
        .catch(() => [])
    : [];
  const months = buildableMonths();
  const notice = built && isUuid(built) ? { tone: "ok" as const, text: "Rapport prêt : téléchargez le PDF ou remettez-le depuis Rapports. · Report ready: download the PDF or deliver it from Reports." } : built ? NOTICES[built] : undefined;

  return (
    <div className="space-y-5">
      <ReportHeader title={TITLE} subtitle={PURPOSE} badges={[{ label: "PDF" }, { label: "Données réelles · Live data" }]} />

      {notice ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}
        >
          {notice.text}
        </p>
      ) : null}

      {canBuild ? (
        <Card>
          <CardHeader
            title="Bâtir un rapport · Build a report"
            subtitle="Refaire le même mois met ses chiffres à jour. Rien n’est envoyé par courriel · Building the same month again refreshes its numbers. Nothing is emailed."
          />
          <CardBody>
            <form action={buildMonthlyReport} className="flex flex-wrap items-end gap-3">
              <label className="space-y-1 text-xs font-medium text-slate-600">
                Mois · Month
                <select name="month" defaultValue={months[1]} className="block w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  {months.map((key) => (
                    <option key={key} value={key}>{monthRange(key).label}</option>
                  ))}
                </select>
              </label>
              <button className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                <Sparkles className="h-3.5 w-3.5" />
                Bâtir le rapport · Build report
              </button>
            </form>
            <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {SECTIONS.map((section) => (
                <li key={section} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-xs text-slate-700">{section}</li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Votre rôle permet de lire les rapports, pas d’en créer · Your role can read reports, not build them.
        </p>
      )}

      <Card>
        <CardHeader title="Rapports bâtis · Built reports" subtitle={reports.length ? undefined : "Aucun rapport pour le moment · No report yet."} />
        {reports.length ? (
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {reports.map((report) => (
                <li key={report.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/dashboard/reports/preview?id=${report.id}`} className="font-medium text-slate-800 hover:underline">
                    {report.title}
                  </Link>
                  <span className="flex items-center gap-3 text-xs text-slate-500">
                    {report.updatedAt.toLocaleDateString("fr-CA")}
                    <a href={`/dashboard/reports/export/pdf?id=${report.id}`} className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
                      <FileDown className="h-3.5 w-3.5" /> PDF
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        ) : null}
      </Card>
    </div>
  );
}
