import "server-only";

import { getSessionUser } from "@/lib/auth/supabase-server";
import { ensureProfileForSupabaseUser } from "@/lib/auth/profile-sync";
import { jsonResponse } from "@/lib/security/api-response";

export async function requireHockeyFamilyApiUser() {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false as const,
      response: jsonResponse({ ok: false, message: "Sign in to continue." }, 401),
    };
  }

  const sync = await ensureProfileForSupabaseUser(user, {
    createPersonalWorkspace: false,
  });

  if (sync.outcome === "denied") {
    return {
      ok: false as const,
      response: jsonResponse(
        { ok: false, message: "Your TAKATAK identity could not be verified." },
        403,
      ),
    };
  }

  if (sync.outcome === "unavailable" || sync.outcome === "error") {
    return {
      ok: false as const,
      response: jsonResponse(
        { ok: false, message: "TAKATAK identity is temporarily unavailable." },
        503,
      ),
    };
  }

  return { ok: true as const, user };
}
