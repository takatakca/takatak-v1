import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { getHockeyMembershipSnapshot } from "@/lib/billing/hockey/membership-service";
import { jsonResponse } from "@/lib/security/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return jsonResponse({ ok: false, message: "Sign in to continue." }, 401);
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });

  if (sync.outcome === "denied") {
    return jsonResponse(
      { ok: false, message: "Your TAKATAK identity could not be verified." },
      403,
    );
  }
  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return jsonResponse(
      { ok: false, message: "Membership identity is temporarily unavailable." },
      503,
    );
  }

  const membership = await getHockeyMembershipSnapshot(user.id);
  return jsonResponse({ ok: true, membership }, 200);
}
