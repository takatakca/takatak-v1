// Signs the current user out and returns to the login page.
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

export async function POST(request: Request) {
  const response = NextResponse.redirect(
    new URL("/login", originFromRequest(request)),
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
        console.error("[signout] Local sign-out failed");
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
