import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { isConsentPostAllowed } from "@/lib/auth/oauth-consent";
import {
  createSc4nnerExperienceLaunch,
  sc4nnerAuthorizeDecision,
} from "@/lib/experiences/sc4nner-experience-access";
import { provisionSc4nnerAccount } from "@/lib/experiences/sc4nner-provisioning";
import { handleApiError, jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_RE = /^[A-Za-z0-9_-]{43}$/;

// The authorization itself. Posted from the authorize page, which showed
// the account first: the launch code is created for the CURRENT session's
// identity only — authorizing is impossible without an identified account,
// and switching accounts before confirming binds the code (and the
// provisioning) to the newly signed-in identity. Confirming also triggers
// the provisioning of this account's SC4NNER copy: the main-database
// provider record plus the SC4NNER /api/provision call (idempotent,
// non-blocking on failure — the outcome stays on the record).
export async function POST(request: NextRequest) {
  if (!isConsentPostAllowed(request)) {
    return jsonResponse({ ok: false, message: "Forbidden." }, 403);
  }
  const form = await request.formData().catch(() => null);
  const state = form?.get("state");
  if (typeof state !== "string" || !STATE_RE.test(state)) {
    return jsonResponse({ ok: false, message: "Invalid SC4NNER launch state." }, 400);
  }
  const user = await getSessionUser();
  if (!user) {
    const next = "/api/experiences/sc4nner/launch?state=" + encodeURIComponent(state);
    return NextResponse.redirect(new URL("/login?next=" + encodeURIComponent(next), request.url));
  }
  const sync = await ensureProfileForSupabaseUser(user, { createPersonalWorkspace: false });
  const decision = sc4nnerAuthorizeDecision({ hasUser: true, syncOutcome: sync.outcome });
  if (decision === "denied") return jsonResponse({ ok: false, message: "SC4NNER access denied." }, 403);
  if (decision === "unavailable")
    return jsonResponse({ ok: false, message: "TAKATAK identity temporarily unavailable." }, 503);
  try {
    const launch = await createSc4nnerExperienceLaunch(user.id, state);
    await provisionSc4nnerAccount({
      identityId: launch.identityId,
      email: launch.email,
      displayName: launch.displayName,
    });
    const response = NextResponse.redirect(launch.callbackUrl, 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return handleApiError("sc4nner-launch-confirm", error, "SC4NNER launch failed.");
  }
}
