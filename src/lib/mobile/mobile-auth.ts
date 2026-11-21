// Claude (Anthropic) · 2026-11-21 — request authentication for the native TAKATAK app (/api/mobile/v1).
// Every call verifies the bearer token with Supabase Auth (no local trust of the JWT), then resolves the
// workspace with the same tenant rules as the website (resolveTenantAccessBundle). A workspace the user
// is not an active member of is never selected: the header is only a preference.
import "server-only";

import type { NextRequest } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/auth/env";
import { jsonResponse } from "@/lib/security/api-response";
import { hasEffectivePermission } from "@/lib/security/effective-permissions";
import type { Permission } from "@/lib/security/roles";
import {
  resolveTenantAccessBundle,
  type TenantAccessBundle,
} from "@/lib/security/tenant-access";
import { readBearerToken, readWorkspaceHeader } from "./mobile-session";

export const MOBILE_WORKSPACE_HEADER = "x-takatak-workspace";

/** Stateless Auth client: anon key only, never a service-role key, never a cookie. */
export function statelessAuthClient() {
  const env = getSupabaseEnv();
  if (!env) return null;
  return createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export type MobileContext = TenantAccessBundle & { user: User };

export type MobileGate =
  | { ok: true; context: MobileContext }
  | { ok: false; response: ReturnType<typeof jsonResponse> };

const fail = (status: number, code: string, message: string): MobileGate => ({
  ok: false,
  response: jsonResponse({ ok: false, code, message }, status),
});

export async function authenticateMobile(request: NextRequest): Promise<MobileGate> {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return fail(401, "not_authenticated", "Please sign in again.");

  const supabase = statelessAuthClient();
  if (!supabase) return fail(503, "configuration_unavailable", "Sign-in is not available right now.");

  let user: User | null = null;
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      const status = typeof error.status === "number" ? error.status : 0;
      if (status === 401 || status === 403 || /expired|invalid/i.test(error.message)) {
        return fail(401, "session_expired", "Your session has expired. Please sign in again.");
      }
      return fail(503, "auth_unavailable", "The sign-in service could not be reached. Please try again.");
    }
    user = data.user;
  } catch {
    return fail(503, "auth_unavailable", "The sign-in service could not be reached. Please try again.");
  }
  if (!user) return fail(401, "session_expired", "Your session has expired. Please sign in again.");

  const requested = readWorkspaceHeader(request.headers.get(MOBILE_WORKSPACE_HEADER));
  const bundle = await resolveTenantAccessBundle(requested, { id: user.id, email: user.email ?? null });
  return { ok: true, context: { ...bundle, user } };
}

export type ScopedMobileContext = MobileContext & {
  access: Extract<TenantAccessBundle["access"], { mode: "client_scoped" }>;
};

/** Same rule as the website's requireWorkspaceApiPermission: an active workspace and the permission. */
export async function requireMobileWorkspace(
  request: NextRequest,
  permission: Permission,
): Promise<{ ok: true; context: ScopedMobileContext } | { ok: false; response: ReturnType<typeof jsonResponse> }> {
  const gate = await authenticateMobile(request);
  if (!gate.ok) return gate;
  const { access } = gate.context;
  if (access.mode !== "client_scoped") {
    return {
      ok: false,
      response: jsonResponse(
        {
          ok: false,
          code: access.mode === "selection_required" || access.mode === "platform_admin" ? "workspace_required" : "no_workspace",
          message: "Choose a business to continue.",
        },
        409,
      ),
    };
  }
  if (!hasEffectivePermission(access, permission)) {
    return { ok: false, response: jsonResponse({ ok: false, code: "forbidden", message: "Your role does not allow this." }, 403) };
  }
  return { ok: true, context: gate.context as ScopedMobileContext };
}
