import { NextResponse, type NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { jsonResponse } from "@/lib/security/api-response";
import { resolveDataScope } from "@/lib/security/data-scope";
import { signedAttachmentDownload } from "@/lib/website-leads/attachment-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Staff download of a lead attachment: scope-checked, then a one-minute signed link. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return jsonResponse({ ok: false, code: "not_found" }, 404);

  const scope = await resolveDataScope();
  if (scope.kind !== "db") return jsonResponse({ ok: false, code: "forbidden" }, 403);

  const prisma = getPrisma();
  if (!prisma) return jsonResponse({ ok: false, code: "unavailable" }, 503);

  const attachment = await prisma.leadAttachment.findFirst({
    where: {
      id,
      status: "quarantined",
      ...(scope.clientIds ? { clientId: { in: scope.clientIds } } : {}),
    },
    select: { storageBucket: true, storagePath: true, originalName: true },
  });
  if (!attachment) return jsonResponse({ ok: false, code: "not_found" }, 404);

  const url = await signedAttachmentDownload(attachment);
  if (!url) return jsonResponse({ ok: false, code: "unavailable" }, 503);
  const response = NextResponse.redirect(url, 302);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
