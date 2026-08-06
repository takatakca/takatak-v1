// Phase 14 — Access control for admin-only API routes.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/supabase-server";
import { canAccessModule, roleForUser } from "@/lib/security/roles";
import { getRuntimeInfo } from "@/lib/security/runtime-mode";

export type AdminApiAccess =
  | { ok: true; foundation: boolean }
  | { ok: false; response: NextResponse };

/**
 * Admin-only API gate:
 * - production_blocked → 503 (service not configured; no env details leaked)
 * - foundation mode (dev or explicit override) → allowed, marked foundation
 * - auth configured → 401 unauthenticated / 403 wrong role / ok
 */
export async function requireAdminApiAccess(): Promise<AdminApiAccess> {
  const runtime = getRuntimeInfo();
  if (runtime.mode === "production_blocked") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Service is not configured. Admin APIs are unavailable." },
        { status: 503 },
      ),
    };
  }
  if (runtime.foundationAllowed) {
    return { ok: true, foundation: true };
  }
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Authentication required." }, { status: 401 }),
    };
  }
  if (!canAccessModule(roleForUser(user), "/dashboard/admin")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
    };
  }
  return { ok: true, foundation: false };
}
