// Phase 3 — Route guard + session refresh (Next.js 16 proxy convention).
// Fails SAFE: if Supabase env vars are missing, requests pass through and
// the dashboard layout renders an honest "Auth not configured" notice.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/auth/env";
import { originFromRequest } from "@/lib/config/app-origin";

export default async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next(); // not configured — no crash, no redirect loop

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh session if expired; required for Server Components.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isDashboard = path.startsWith("/dashboard");
  const isLogin = path === "/login";

  const origin = originFromRequest(request);

  if (isDashboard && !user) {
    const url = new URL("/login", origin);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  if (isLogin && user) {
    return NextResponse.redirect(new URL("/dashboard", origin));
  }
  return response;
}

export const config = {
  // Guard dashboard + login only. Public home, /api/health, and static assets stay open.
  matcher: ["/dashboard/:path*", "/login"],
};
