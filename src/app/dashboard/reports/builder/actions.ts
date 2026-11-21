"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { buildMonthlyReportFor } from "@/lib/reports/build-monthly";
import { isBuildableMonth } from "@/lib/reports/monthly-builder";
import { getServerAccessContext } from "@/lib/security/access-context";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";

const BACK = "/dashboard/reports/builder";

/**
 * Builds (or rebuilds) the monthly report of the active workspace from its
 * own records. One report per month: building the same month again refreshes
 * its numbers. Nothing is sent anywhere.
 */
export async function buildMonthlyReport(formData: FormData) {
  const month = String(formData.get("month") ?? "").trim();
  if (!isBuildableMonth(month)) redirect(`${BACK}?built=refused`);

  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped") redirect(`${BACK}?built=unavailable`);
  if (!hasEffectivePermission(access, "view_reports") || !hasEffectivePermission(access, "create_content")) {
    redirect(`${BACK}?built=denied`);
  }

  const prisma = getPrisma();
  if (!prisma) redirect(`${BACK}?built=unavailable`);

  let reportId: string | null;
  try {
    reportId = await buildMonthlyReportFor(prisma, { clientId: access.activeClientId, month, actorId: access.profileId ?? null, trigger: "builder" });
  } catch {
    redirect(`${BACK}?built=unavailable`);
  }
  if (!reportId) redirect(`${BACK}?built=unavailable`);

  revalidatePath("/dashboard/reports");
  redirect(`${BACK}?built=${reportId}`);
}
