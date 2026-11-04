import { NextResponse, type NextRequest } from "next/server";

import { noteDeviceSeen } from "@/lib/security/checks/store";
import {
  currentProfile,
  describeRequest,
  newDeviceId,
  readDeviceId,
  securityDb,
  sendNewSignInEmail,
  writeDeviceCookie,
} from "@/lib/security/checks/server";
import { readJsonBody } from "@/lib/security/write-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * POST — called once per browser session by the dashboard. Records this
 * browser for the signed-in person; a browser the account never used opens a
 * « Nouvelle connexion » check on the other devices and sends the alert email.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = await readJsonBody(request, 256);
  if (!parsed.ok) return NextResponse.json({ ok: false, message: parsed.message }, { status: parsed.status, headers: noStore });
  const me = await currentProfile();
  if (!me) return NextResponse.json({ ok: false, code: "sign_in_required" }, { status: 401, headers: noStore });
  const db = securityDb();
  if (!db) return NextResponse.json({ ok: false, code: "database_unavailable" }, { status: 503, headers: noStore });

  const existing = readDeviceId(request);
  const deviceId = existing ?? newDeviceId();
  const { label, ipHint } = describeRequest(request);
  const now = new Date();
  const seen = await noteDeviceSeen(db, { profileId: me.profileId, deviceId, label, ipHint, now });

  if (seen.signInCheck && me.email) {
    // Best effort: the pop-up on the other devices does not depend on email delivery.
    void sendNewSignInEmail({ to: me.email, device: label, ipHint, when: now }).catch(() => undefined);
  }

  const response = NextResponse.json(
    { ok: true, isNew: seen.isNew, signIn: seen.signInCheck },
    { headers: noStore },
  );
  if (!existing) writeDeviceCookie(response, deviceId);
  return response;
}
