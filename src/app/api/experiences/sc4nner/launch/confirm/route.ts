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
// the account first: the launch code is created only for the account the
// page displayed — the form carries that account, and a confirmation
// whose session no longer matches it creates nothing and returns to the
// authorize screen, which then shows the current account. Authorizing is
// impossible without an identified account. Confirming also triggers
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
    // 303: the browser must load /login with a GET — the default 307
    // would replay this confirmation POST (and its form) at /login.
    return NextResponse.redirect(new URL("/login?next=" + encodeURIComponent(next), request.url), 303);
  }
  // The confirmation is bound to the account the authorize page showed:
  // if the session changed after the page was rendered (e.g. another tab
  // signed in as a different account), no code is created — the authorize
  // screen comes back, now showing the current account.
  const shownAccount = form?.get("account");
  if (typeof shownAccount !== "string" || shownAccount !== user.id) {
    const response = NextResponse.redirect(
      new URL("/experiences/sc4nner/authorize?state=" + encodeURIComponent(state), request.url),
      303,
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
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
