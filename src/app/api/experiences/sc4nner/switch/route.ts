// "Changer de compte" from the SC4NNER authorize page: signs the current
// TAKATAK user out (same cookie handling as /auth/signout) and returns to
// the login page with the SC4NNER launch as `next`, so signing in with a
// different account resumes the flow bound to THAT identity.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/auth/env";
import {
  applySessionCookies,
  expireAuthCookies,
  workspaceCookieClears,
} from "@/lib/auth/workspace-session-cookies";
import { originFromRequest } from "@/lib/config/app-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const state = new URL(request.url).searchParams.get("state") || "";
  const loginPath = /^[A-Za-z0-9_-]{43}$/.test(state)
    ? "/login?next=" +
      encodeURIComponent(
        "/api/experiences/sc4nner/launch?state=" + encodeURIComponent(state),
      )
    : "/login";
  const response = NextResponse.redirect(
    new URL(loginPath, originFromRequest(request)),
    { status: 303 },
  );
  response.headers.set("Cache-Control", "no-store");

  try {
    const cookieStore = await cookies();
    const existingNames = cookieStore.getAll().map((cookie) => cookie.name);
    const env = getSupabaseEnv();

    if (env) {
      const supabase = createServerClient(env.url, env.anonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      });

      try {
        await supabase.auth.signOut();
      } catch {
        console.error("[sc4nner-switch] Local sign-out failed");
      }
    }

    applySessionCookies(response, [
      ...expireAuthCookies(existingNames),
      ...workspaceCookieClears(),
    ]);
  } catch {
    applySessionCookies(response, workspaceCookieClears());
  }

  return response;
}
