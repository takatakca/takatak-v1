import { getPrisma } from "@/lib/db/prisma";
import { whiteLabelLines } from "@/lib/seo/score-history";
import { findSeoScore } from "@/lib/seo/score-store";
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

  const snapshot = await findSeoScore(prisma, access.activeClientId, id);
  if (!snapshot) return new Response("Not found", { status: 404 });

  const client = await prisma.client.findFirst({
    where: { id: access.activeClientId },
    select: { name: true, companyName: true },
  });
  const preparedFor = client?.companyName?.trim() || client?.name?.trim() || "Client";
  const pdf = textPdf(whiteLabelLines(snapshot, preparedFor));
  let host = "site";
  try {
    host = new URL(snapshot.url).host.replace(/[^a-z0-9.-]/gi, "") || "site";
  } catch {
    host = "site";
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="seo-${host}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
