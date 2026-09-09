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
import {
  applySessionCookies,
  identitySessionCookies,
  staleTenantCookieClears,
} from "@/lib/auth/workspace-session-cookies";
import { originFromRequest } from "@/lib/config/app-origin";
import {
  AUTH_IDENTITY_COOKIE,
  AUTH_VERIFIED_AT_COOKIE,
  isHighRiskPath,
  localIdentityAgrees,
  mayUseCachedLocalSession,
} from "@/lib/security/authenticated-identity";

function copyCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

function applyStaleTenantPolicy(
  response: NextResponse,
  localUserId: string | null,
  identityCookie: string | null,
): void {
  if (!localUserId || !identityCookie || identityCookie === localUserId) {
    return;
  }
  applySessionCookies(response, [
    ...staleTenantCookieClears(),
    ...identitySessionCookies(localUserId),
  ]);
}

export default async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next(); // not configured — no crash, no redirect loop

  const path = request.nextUrl.pathname;

  // Health stays a cheap liveness probe. Auth callbacks replace cookies
  // themselves — do not sign-out stale tokens on that response.
  if (
    path === "/api/health" ||
    path.startsWith("/api/health/") ||
    path.startsWith("/auth/callback")
  ) {
    return NextResponse.next();
  }

  const hasAuthCookie = hasSupabaseAuthCookie(request.cookies.getAll());
  const localUser = hasAuthCookie
    ? readLocalSessionUser(request.cookies.getAll())
    : null;
  const identityCookie =
    request.cookies.get(AUTH_IDENTITY_COOKIE)?.value ?? null;
  const verifiedAtMs = Number(
    request.cookies.get(AUTH_VERIFIED_AT_COOKIE)?.value ?? "",
  );
  const identityAgrees = localIdentityAgrees({
    sessionUserId: localUser?.id,
    identityCookie,
  });
  const skipAuthLookup = mayUseCachedLocalSession({
    pathname: path,
    hasLocalUser: Boolean(localUser),
    sessionUserId: localUser?.id,
    identityCookie,
    verifiedAtMs: Number.isFinite(verifiedAtMs) ? verifiedAtMs : null,
    tokenIsFresh: isLocalAccessTokenFresh(request.cookies.getAll()),
  });
  const highRisk = isHighRiskPath(path);

  // Low-risk APIs re-read the local JWT. High-risk APIs always go through
  // Auth getUser() — decoded JWT `sub` is not enough for billing/admin/team.
  if (path.startsWith("/api/") && !highRisk) {
    const authStatus: AuthStatus = localUser
      ? "authenticated"
      : hasAuthCookie
        ? "network"
        : "anonymous";
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(AUTH_STATUS_HEADER, authStatus);
    requestHeaders.set(PATHNAME_HEADER, path);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    applyStaleTenantPolicy(response, localUser?.id ?? null, identityCookie);
    return response;
  }

  // Fresh JWT + matching identity cookie + recent Auth verification:
  // skip getUser(). Auth cookie writes on every document request make the
  // App Router restart the RSC fetch in a loop.
  if (localUser && skipAuthLookup) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(AUTH_STATUS_HEADER, "authenticated");
    requestHeaders.set(PATHNAME_HEADER, path);
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    applyStaleTenantPolicy(response, localUser.id, identityCookie);
    return response;
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
    if (localUser && !highRisk) {
      authStatus = "authenticated";
    }
  }

  if (resolution.status === "authenticated") {
    applySessionCookies(
      response,
      identitySessionCookies(resolution.user.id),
    );
  }

  if (
    localUser &&
    identityCookie &&
    !identityAgrees
  ) {
    applyStaleTenantPolicy(response, localUser.id, identityCookie);
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
    const redirect = NextResponse.redirect(url);
    return copyCookies(response, redirect);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(AUTH_STATUS_HEADER, authStatus);
  requestHeaders.set(PATHNAME_HEADER, path);
  const next = NextResponse.next({
    request: { headers: requestHeaders },
  });
  return copyCookies(response, next);
}

export const config = {
  // Refresh/clear auth cookies on document routes. Static assets stay out.
  // Dashboard and login still get the auth redirect; public pages stay open.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
