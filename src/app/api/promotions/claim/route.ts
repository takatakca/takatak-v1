import type { NextRequest } from "next/server";

import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { getPrisma } from "@/lib/db/prisma";
import { promoAuditStore } from "@/lib/promotions/audit-store";
import { claimPromo } from "@/lib/promotions/service";
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

  const user = await getSessionUser();
  if (!user) {
    return jsonResponse({ ok: false, code: "sign_in_required" }, 401);
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });
  if (sync.outcome === "denied") {
    return jsonResponse({ ok: false, code: "identity_denied" }, 403);
  }
  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return jsonResponse({ ok: false, code: "unavailable" }, 503);
  }

  const code =
    body.body && typeof body.body === "object" && "code" in body.body
      ? (body.body as { code?: unknown }).code
      : null;
  const result = await claimPromo(promoAuditStore(prisma), sync.profileId, code);
  if (!result.ok) {
    const status = result.code === "already_redeemed" ? 409 : 400;
    return jsonResponse({ ok: false, code: result.code }, status);
  }
  return jsonResponse({ ok: true, promotion: result.promotion }, 200);
}
