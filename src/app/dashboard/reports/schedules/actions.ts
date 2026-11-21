"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { MONTHLY_SCHEDULE_NAME, MONTHLY_SCHEDULE_SOURCE, nextMonthlyRun } from "@/lib/reports/monthly-schedule";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

const BACK = "/dashboard/reports/schedules";

/** Turns the automatic monthly report of the active workspace on or off. */
export async function setMonthlySchedule(formData: FormData) {
  const turnOn = String(formData.get("on") ?? "") === "true";
  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped") redirect(`${BACK}?saved=unavailable`);
  if (!hasEffectivePermission(access, "view_reports") || !hasEffectivePermission(access, "create_content")) {
    redirect(`${BACK}?saved=denied`);
  }
  const prisma = getPrisma();
  if (!prisma) redirect(`${BACK}?saved=unavailable`);

  const clientId = access.activeClientId;
  const existing = await prisma.reportSchedule.findFirst({
    where: { clientId, metadata: { path: ["source"], equals: MONTHLY_SCHEDULE_SOURCE } },
    select: { id: true },
  });
  const data = turnOn
    ? { status: "active_internal" as const, frequency: "monthly" as const, nextRunAt: nextMonthlyRun(new Date()) }
    : { status: "paused" as const, nextRunAt: null };
  if (existing) {
    await prisma.reportSchedule.update({ where: { id: existing.id }, data });
  } else if (turnOn) {
    await prisma.reportSchedule.create({
      data: {
        ...data,
        clientId,
        name: MONTHLY_SCHEDULE_NAME,
        metadata: {
          source: MONTHLY_SCHEDULE_SOURCE,
          version: 1,
          createdBy: access.profileId ?? null,
          note: "Bâti le 1er de chaque mois, remis dans le tableau de bord · Built on the 1st of each month, delivered in the dashboard.",
        },
      },
    });
  }
  revalidatePath(BACK);
  redirect(`${BACK}?saved=${turnOn ? "on" : "off"}`);
}
