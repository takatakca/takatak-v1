// Phase 3 — Route guard + session refresh (Next.js 16 proxy convention).
// Fails SAFE: if Supabase env vars are missing, requests pass through and
// the dashboard layout renders an honest "Auth not configured" notice.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/auth/env";
import {
  AUTH_STATUS_HEADER,
  PATHNAME_HEADER,
  hasSupabaseAuthCookie,
  isLocalAccessTokenFresh,
  readLocalSessionUser,
  resolveAuthUser,
  type AuthStatus,
} from "@/lib/auth/session-user";
import { originFromRequest } from "@/lib/config/app-origin";

export default async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next(); // not configured — no crash, no redirect loop

  const path = request.nextUrl.pathname;

  // Health stays a cheap liveness probe. Auth callbacks replace cookies
  // themselves — do not sign-out stale tokens on that response.
  if (path === "/api/health" || path.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  const hasAuthCookie = hasSupabaseAuthCookie(request.cookies.getAll());
  const localUser = hasAuthCookie
    ? readLocalSessionUser(request.cookies.getAll())
    : null;

  // API handlers re-read the local JWT. Don't spend 1s on getUser() for
  // every image/onboarding poll — that was making picture/onboarding look
  // like 404s while Auth was still in flight.
  if (path.startsWith("/api/")) {
    const authStatus: AuthStatus = localUser
      ? "authenticated"
      : hasAuthCookie
        ? "network"
        : "anonymous";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(AUTH_STATUS_HEADER, authStatus);
    requestHeaders.set(PATHNAME_HEADER, path);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Fresh JWT: skip getUser(). Auth cookie writes on every document request
  // make the App Router restart the RSC fetch in a loop.
  if (localUser && isLocalAccessTokenFresh(request.cookies.getAll())) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(AUTH_STATUS_HEADER, "authenticated");
    requestHeaders.set(PATHNAME_HEADER, path);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  let response = NextResponse.next({ request });
  let authStatus: AuthStatus = "anonymous";
  let persistAuthCookies = true;

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        if (!persistAuthCookies) return;
        const changed = cookiesToSet.some(
          ({ name, value }) => request.cookies.get(name)?.value !== value,
        );
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        if (!changed) return;
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const resolution = await resolveAuthUser(supabase, {
    hasAuthCookie,
    // A live cookie is enough to keep the user in the app. Don't block the
    // whole navigation for 4s if Auth is slow — refresh is best-effort.
    timeoutMs: localUser ? 1_000 : undefined,
  });
  authStatus = resolution.status;

  if (resolution.status === "network") {
    // Timed-out getUser() must not later clear cookies (refresh-token races).
    persistAuthCookies = false;
    if (localUser) {
      authStatus = "authenticated";
    }
  }

  const isDashboard = path.startsWith("/dashboard");
  const origin = originFromRequest(request);

  if (
    isDashboard &&
    (authStatus === "anonymous" || authStatus === "expired")
  ) {
    const url = new URL("/login", origin);
    url.searchParams.set("next", path);
    if (authStatus === "expired") {
      url.searchParams.set("error", "session_expired");
    }
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(AUTH_STATUS_HEADER, authStatus);
  requestHeaders.set(PATHNAME_HEADER, path);
  const next = NextResponse.next({
    request: { headers: requestHeaders },
  });
  for (const cookie of response.cookies.getAll()) {
    next.cookies.set(cookie);
  }
  return next;
}

export const config = {
  // Refresh/clear auth cookies on document routes. Static assets stay out.
  // Dashboard and login still get the auth redirect; public pages stay open.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
