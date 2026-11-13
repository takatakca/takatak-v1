import { NextResponse, type NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { createSupportCheck } from "@/lib/security/checks/store";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { readJsonBody } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST { profileId } — a TAKATAK agent (platform owner or admin) on a call
 * asks the person's signed-in devices « Êtes-vous en contact avec le soutien
 * TAKATAK ? ». Returns the number the agent reads out.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const access = await requirePlatformAdminApiAccess();
  if (!access.ok) return access.response;
  const parsed = await readJsonBody(request, 512);
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.message }, { status: parsed.status, headers: noStore });
  const profileId = (parsed.body as { profileId?: unknown } | null)?.profileId;
  if (typeof profileId !== "string" || !isUuid(profileId)) {
    return NextResponse.json({ ok: false, code: "invalid_request" }, { status: 400, headers: noStore });
  }
  const db = getPrisma();
  if (!db) return NextResponse.json({ ok: false, code: "database_unavailable" }, { status: 503, headers: noStore });
  const result = await createSupportCheck(db, { agentProfileId: access.profileId, targetProfileId: profileId });
  const status = result.ok ? 200 : result.code === "not_found" ? 404 : result.code === "too_many" ? 429 : 409;
  return NextResponse.json(result, { status, headers: noStore });
}
