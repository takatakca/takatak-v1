import { getPrisma } from "@/lib/db/prisma";
import { reportPdfLines } from "@/lib/reports/export-document";
import { textPdf } from "@/lib/seo/text-pdf";
import { getServerAccessContext } from "@/lib/security/access-context";
import { isUuid } from "@/lib/validation/common";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isUuid(id)) return new Response("Not found", { status: 404 });

  const { access } = await getServerAccessContext();
  if (access.mode !== "client_scoped") return new Response("Not found", { status: 404 });

  const prisma = getPrisma();
  if (!prisma) return new Response("Not found", { status: 404 });

  const report = await prisma.report.findFirst({
    where: { id, clientId: access.activeClientId, status: { not: "archived" } },
    include: {
      client: { select: { name: true, companyName: true } },
      sections: { where: { status: { not: "hidden" } }, orderBy: { order: "asc" } },
      metrics: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!report) return new Response("Not found", { status: 404 });

  const pdf = textPdf(
    reportPdfLines({
      title: report.title,
      clientName: report.client.companyName?.trim() || report.client.name,
      summary: report.summary,
      sections: report.sections.map((section) => ({ title: section.title, content: section.content })),
      metrics: report.metrics.map((metric) => ({ label: metric.label, value: metric.value, unit: metric.unit })),
    }),
  );

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=\"rapport.pdf\"",
      "Cache-Control": "private, no-store",
    },
  });
}
