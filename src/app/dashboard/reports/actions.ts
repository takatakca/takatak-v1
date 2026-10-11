"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/db/prisma";
import { decideDelivery, internalReportPath } from "@/lib/reports/export-document";
import { getServerAccessContext } from "@/lib/security/access-context";
import { isUuid } from "@/lib/validation/common";

export async function deliverReport(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "").trim();
  if (!isUuid(reportId)) redirect("/dashboard/reports?delivery=refused");

  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped") redirect("/dashboard/reports?delivery=unavailable");

  const prisma = getPrisma();
  if (!prisma) redirect("/dashboard/reports?delivery=unavailable");

  const report = await prisma.report.findFirst({
    where: { id: reportId, clientId: access.activeClientId },
    select: { id: true, title: true, status: true, clientId: true },
  });
  if (!report) redirect("/dashboard/reports?delivery=denied");

  const existing = await prisma.reportShare.findFirst({
    where: {
      reportId: report.id,
      clientId: report.clientId,
      status: { in: ["ready_to_share", "shared_internal"] },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const decision = decideDelivery(report, existing?.id ?? null);
  if (decision.action === "refuse") redirect("/dashboard/reports?delivery=refused");
  if (decision.action === "already") redirect("/dashboard/reports?delivery=already");

  const path = internalReportPath(report.id);
  await prisma.$transaction(async (tx) => {
    await tx.reportShare.create({
      data: {
        reportId: report.id,
        clientId: report.clientId,
        status: "shared_internal",
        shareUrl: path,
      },
    });
    await tx.notification.create({
      data: {
        clientId: report.clientId,
        type: "report_ready",
        title: "Rapport prêt",
        message: `${report.title} est disponible dans le tableau de bord. Aucun courriel n'a été envoyé.`.slice(0, 500),
        relatedEntityType: "report",
        relatedEntityId: report.id,
      },
    });
    if (report.status !== "sent") {
      await tx.report.update({ where: { id: report.id }, data: { status: "sent" } });
    }
  });

  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/notifications");
  redirect("/dashboard/reports?delivery=sent");
}
