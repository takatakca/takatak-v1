import { NextResponse, type NextRequest } from "next/server";

import { getPrisma } from "@/lib/db/prisma";
import { agentCheckStatus } from "@/lib/security/checks/store";
import { requirePlatformAdminApiAccess } from "@/lib/security/platform-admin-api";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/** GET — the agent who started a support identity check follows the answer. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ checkId: string }> },
): Promise<NextResponse> {
  const access = await requirePlatformAdminApiAccess();
  if (!access.ok) return access.response;
  const { checkId } = await context.params;
  if (!isUuid(checkId)) return NextResponse.json({ ok: false, code: "invalid_request" }, { status: 400, headers: noStore });
  const db = getPrisma();
  if (!db) return NextResponse.json({ ok: false, code: "database_unavailable" }, { status: 503, headers: noStore });
  const view = await agentCheckStatus(db, { checkId, agentProfileId: access.profileId });
  if (!view) return NextResponse.json({ ok: false, code: "not_found" }, { status: 404, headers: noStore });
  return NextResponse.json({ ok: true, ...view }, { headers: noStore });
}
