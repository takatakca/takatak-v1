import { NextResponse, type NextRequest } from "next/server";

import { ownSignInCheck, pendingPrompts } from "@/lib/security/checks/store";
import { currentProfile, readDeviceId, securityDb } from "@/lib/security/checks/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * GET — the security questions this device must answer (support identity
 * checks, sign-ins of the person's other devices), and the state of this
 * device's own sign-in check. Never returns the number another device must tap.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ ok: false, code: "sign_in_required" }, { status: 401, headers: noStore });
  const db = securityDb();
  if (!db) return NextResponse.json({ ok: true, prompts: [], ownSignIn: null }, { headers: noStore });
  const deviceId = readDeviceId(request);
  const [prompts, own] = await Promise.all([
    pendingPrompts(db, { profileId: me.profileId, deviceId }),
    deviceId ? ownSignInCheck(db, { profileId: me.profileId, deviceId }) : Promise.resolve(null),
  ]);
  return NextResponse.json({ ok: true, prompts, ownSignIn: own }, { headers: noStore });
}
