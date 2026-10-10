import type { NextRequest } from "next/server";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";
import { promoAuditStore } from "@/lib/promotions/audit-store";
import { previewPromo } from "@/lib/promotions/service";
import { jsonResponse } from "@/lib/security/api-response";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request, 2_048);
  if (!body.ok) {
    return jsonResponse(
      { ok: false, code: "invalid_request", message: body.message },
      body.status,
    );
  }

  const payload =
    body.body && typeof body.body === "object"
      ? (body.body as { code?: unknown; subtotalCents?: unknown })
      : {};

  const prisma = getPrisma();
  if (!prisma) {
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }

  let profileId: string | null = null;
  const user = await getSessionUser();
  if (user) {
    const profile = await prisma.profile.findUnique({
      where: { authUserId: user.id },
      select: { id: true },
    });
    profileId = profile?.id ?? null;
  }

  const result = await previewPromo(
    promoAuditStore(prisma),
    profileId,
    payload.code,
    payload.subtotalCents,
  );
  if (!result.ok) {
    return jsonResponse({ ok: false, code: result.code }, 400);
  }
  return jsonResponse({ ok: true, ...result.preview }, 200);
}
