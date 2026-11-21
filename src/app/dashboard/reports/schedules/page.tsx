import Link from "next/link";
import { CalendarClock } from "lucide-react";

import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";
import { ReportHeader } from "@/components/reports/report-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getPrisma } from "@/lib/db/prisma";
import { runDueMonthlySchedules } from "@/lib/reports/build-monthly";
import { monthCoveredBy, MONTHLY_SCHEDULE_SOURCE } from "@/lib/reports/monthly-schedule";
import { monthRange } from "@/lib/growth/report";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

import { setMonthlySchedule } from "./actions";

export const dynamic = "force-dynamic";

const TITLE = "Rapports planifiés · Scheduled reports";
const PURPOSE =
  "Votre rapport mensuel bâti automatiquement le 1er de chaque mois avec les vrais chiffres du mois écoulé, puis remis dans votre tableau de bord · Your monthly report built automatically on the 1st of each month from last month's real numbers, then delivered in your dashboard.";

const NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  on: { tone: "ok", text: "Rapport mensuel automatique activé. · Automatic monthly report turned on." },
  off: { tone: "ok", text: "Rapport mensuel automatique en pause. · Automatic monthly report paused." },
  denied: { tone: "warn", text: "Votre rôle ne permet pas de changer ce réglage. · Your role cannot change this setting." },
  unavailable: { tone: "warn", text: "Réglage indisponible pour le moment ; réessayez. · Setting unavailable right now; try again." },
};

const day = (value: Date) => value.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Toronto" });

export default async function ReportSchedulesPage({ searchParams }: { searchParams: Promise<{ saved?: string | string[] }> }) {
  const params = await searchParams;
  const saved = Array.isArray(params.saved) ? params.saved[0] : params.saved;
  const { access } = await getServerAccessContext();

  if (access.mode !== "client_scoped") {
    if (access.mode !== "platform_admin") return <ModulePlaceholder def={{ title: TITLE, purpose: PURPOSE, status: "foundation", functions: [] }} />;
    return (
      <div className="space-y-5">
        <ReportHeader title={TITLE} subtitle={PURPOSE} />
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Choisissez un espace client (en haut de l’écran) pour régler son rapport automatique · Select a client workspace to set its automatic report.
        </p>
      </div>
    );
  }

  const prisma = getPrisma();
  const clientId = access.activeClientId;
  // Catch-up: a report that came due is built on the next visit, even before the scheduler runs.
  if (prisma) await runDueMonthlySchedules(prisma, { clientId, max: 1 }).catch(() => []);
  const schedule = prisma
    ? await prisma.reportSchedule
        .findFirst({
          where: { clientId, metadata: { path: ["source"], equals: MONTHLY_SCHEDULE_SOURCE } },
          select: { status: true, nextRunAt: true, lastRunAt: true },
        })
        .catch(() => null)
    : null;
  const on = schedule?.status === "active_internal";
  const canChange = hasEffectivePermission(access, "view_reports") && hasEffectivePermission(access, "create_content");
  const notice = saved ? NOTICES[saved] : undefined;

  return (
    <div className="space-y-5">
      <ReportHeader title={TITLE} subtitle={PURPOSE} badges={[{ label: "PDF" }, { label: "Remise dans le tableau de bord · In-dashboard delivery" }]} />
      {notice ? (
        <p
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${notice.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}
        >
          {notice.text}
        </p>
      ) : null}
      <Card>
        <CardHeader
          title="Rapport mensuel automatique · Automatic monthly report"
          subtitle="Aucun courriel n’est envoyé : le rapport et son PDF arrivent dans Rapports, avec une notification · No email is sent: the report and its PDF arrive in Reports, with a notification."
          action={<Badge tone={on ? "success" : "neutral"}>{on ? "Actif · On" : schedule ? "En pause · Paused" : "Pas activé · Off"}</Badge>}
        />
        <CardBody className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-slate-700">
            <CalendarClock className="h-4 w-4 text-slate-400" />
            {on && schedule?.nextRunAt
              ? `Prochain rapport : ${day(schedule.nextRunAt)} (mois de ${monthRange(monthCoveredBy(schedule.nextRunAt)).label}) · Next report: ${schedule.nextRunAt.toISOString().slice(0, 10)}`
              : "Activez-le pour recevoir votre rapport le 1er de chaque mois · Turn it on to get your report on the 1st of each month."}
          </p>
          {schedule?.lastRunAt ? (
            <p className="text-xs text-slate-500">Dernier rapport bâti · Last built : {day(schedule.lastRunAt)}</p>
          ) : null}
          {canChange ? (
            <form action={setMonthlySchedule}>
              <input type="hidden" name="on" value={on ? "false" : "true"} />
              <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700">
                {on ? "Mettre en pause · Pause" : "Activer · Turn on"}
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-500">Votre rôle permet de lire les rapports, pas de changer ce réglage · Your role can read reports, not change this setting.</p>
          )}
          <p className="text-xs text-slate-500">
            Besoin d’un mois précis maintenant ? <Link href="/dashboard/reports/builder" className="font-semibold text-emerald-700 hover:underline">Rapports mensuels · Monthly reports</Link>
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
