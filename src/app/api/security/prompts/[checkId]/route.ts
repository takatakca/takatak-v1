import { NextResponse, type NextRequest } from "next/server";

import { respondToCheck } from "@/lib/security/checks/store";
import { currentProfile, readDeviceId, securityDb, signOutOtherSessions } from "@/lib/security/checks/server";
import { readJsonBody } from "@/lib/security/write-request";
import { isUuid } from "@/lib/validation/common";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST { answer: number | "not_me" } — this device answers a security question.
 * « Ce n'était pas moi » on a new sign-in closes the person's other sessions
 * and forgets the unknown device, so it is treated as new again next time.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ checkId: string }> },
): Promise<NextResponse> {
  const { checkId } = await context.params;
  if (!isUuid(checkId)) return NextResponse.json({ ok: false, code: "invalid_request" }, { status: 400, headers: noStore });
  const parsed = await readJsonBody(request, 256);
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.message }, { status: parsed.status, headers: noStore });
  const raw = (parsed.body as { answer?: unknown } | null)?.answer;
  const answer = raw === "not_me" ? "not_me" : typeof raw === "number" && Number.isInteger(raw) && raw >= 10 && raw <= 99 ? raw : null;
  if (answer === null) return NextResponse.json({ ok: false, code: "invalid_request" }, { status: 400, headers: noStore });

  const me = await currentProfile();
  if (!me) return NextResponse.json({ ok: false, code: "sign_in_required" }, { status: 401, headers: noStore });
  const db = securityDb();
  if (!db) return NextResponse.json({ ok: false, code: "database_unavailable" }, { status: 503, headers: noStore });

  const deviceId = readDeviceId(request);
  const result = await respondToCheck(db, { profileId: me.profileId, checkId, deviceId, answer });
  if (!result.ok) return NextResponse.json(result, { status: result.code === "not_found" ? 404 : 409, headers: noStore });

  let otherSessionsClosed = false;
  if (result.kind === "new_sign_in" && (result.status === "denied" || result.status === "mismatch")) {
    otherSessionsClosed = await signOutOtherSessions();
    const check = await db.securityCheck.findUnique({ where: { id: checkId }, select: { deviceId: true } });
    if (check?.deviceId) {
      await db.securityDevice.deleteMany({ where: { profileId: me.profileId, deviceId: check.deviceId } });
    }
    await db.auditLog.create({
      data: {
        profileId: me.profileId,
        action: "security.other_sessions_closed",
        entityType: "security_check",
        entityId: checkId,
        metadata: { ok: otherSessionsClosed },
      },
    });
  }
  return NextResponse.json({ ...result, otherSessionsClosed }, { headers: noStore });
}
