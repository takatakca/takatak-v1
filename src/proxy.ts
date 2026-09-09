// Phase 3 — Route guard + session refresh (Next.js 16 proxy convention).
// Fails SAFE: if Supabase env vars are missing, requests pass through and
// the dashboard layout renders an honest "Auth not configured" notice.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/auth/env";
import {
  applyTrustedAuthRequestHeaders,
  authCookieNamesToDiscard,
  hasSupabaseAuthCookie,
  isLocalAccessTokenFresh,
  readLocalSessionUser,
  resolveAuthUser,
  stripInternalAuthHeaders,
  type AuthStatus,
} from "@/lib/auth/session-user";
import {
  applySessionCookies,
  expireNamedCookies,
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

const PRIVATE_NO_STORE = "private, no-store, no-cache, must-revalidate";

function copyCookies(
  from: NextResponse,
  to: NextResponse,
): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

function applyPrivateCache(response: NextResponse, path: string): NextResponse {
  stripInternalAuthHeaders(response.headers);
  if (
    path.startsWith("/dashboard") ||
    path.startsWith("/api/") ||
    path.startsWith("/auth/")
  ) {
    response.headers.set("Cache-Control", PRIVATE_NO_STORE);
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Vary", "Cookie");
  }
  return response;
}

function trustedRequestHeaders(
  request: NextRequest,
  input: { status: AuthStatus; userId?: string | null },
): Headers {
  const headers = new Headers(request.headers);
  applyTrustedAuthRequestHeaders(headers, {
    status: input.status,
    pathname: request.nextUrl.pathname,
    userId: input.userId,
  });
  return headers;
}

function passthroughWithoutClientIdentity(request: NextRequest): NextResponse {
  const headers = trustedRequestHeaders(request, { status: "anonymous" });
  const response = NextResponse.next({ request: { headers } });
  stripInternalAuthHeaders(response.headers);
  return response;
}

function applyVerifiedIdentity(
  response: NextResponse,
  requestCookies: Array<{ name: string; value?: string }>,
  verifiedUserId: string,
  identityCookie: string | null,
): void {
  const leftoverAuthCookies = authCookieNamesToDiscard(
    requestCookies,
    verifiedUserId,
  );
  const writes = [
    ...(leftoverAuthCookies.length > 0
      ? expireNamedCookies(leftoverAuthCookies)
      : []),
    ...(identityCookie && identityCookie !== verifiedUserId
      ? staleTenantCookieClears()
      : []),
    ...(identityCookie === verifiedUserId
      ? []
      : identitySessionCookies(verifiedUserId)),
  ];
  if (writes.length === 0) {
    return;
  }
  applySessionCookies(response, writes);
}

export default async function proxy(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return passthroughWithoutClientIdentity(request);

  const path = request.nextUrl.pathname;

  // Health stays a cheap liveness probe. Auth callbacks replace cookies
  // themselves — do not sign-out stale tokens on that response.
  if (
    path === "/api/health" ||
    path.startsWith("/api/health/") ||
    path.startsWith("/auth/callback")
  ) {
    return passthroughWithoutClientIdentity(request);
  }

  const requestCookies = request.cookies.getAll();
  const hasAuthCookie = hasSupabaseAuthCookie(requestCookies);
  const localUser = hasAuthCookie ? readLocalSessionUser(requestCookies) : null;
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
    tokenIsFresh: isLocalAccessTokenFresh(requestCookies),
  });
  const highRisk = isHighRiskPath(path);

  // Low-risk APIs re-read the local JWT only when it matches the identity
  // cookie. A leftover JWT must not rewrite identity or label the request.
  if (path.startsWith("/api/") && !highRisk && !(localUser && !identityAgrees)) {
    const authStatus: AuthStatus = localUser
      ? "authenticated"
      : hasAuthCookie
        ? "network"
        : "anonymous";
    const requestHeaders = trustedRequestHeaders(request, {
      status: authStatus,
      userId: localUser?.id ?? null,
    });
    const response = applyPrivateCache(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
      path,
    );
    if (localUser) {
      applyVerifiedIdentity(
        response,
        requestCookies,
        localUser.id,
        identityCookie,
      );
    }
    return response;
  }

  // Fresh JWT + matching identity cookie + recent Auth verification:
  // skip getUser(). Auth cookie writes on every document request make the
  // App Router restart the RSC fetch in a loop.
  if (localUser && skipAuthLookup) {
    const requestHeaders = trustedRequestHeaders(request, {
      status: "authenticated",
      userId: localUser.id,
    });
    const response = applyPrivateCache(
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
      path,
    );
    applyVerifiedIdentity(
      response,
      requestCookies,
      localUser.id,
      identityCookie,
    );
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
    if (localUser && identityAgrees && !highRisk) {
      authStatus = "authenticated";
    }
  }

  if (resolution.status === "authenticated") {
    applyVerifiedIdentity(
      response,
      requestCookies,
      resolution.user.id,
      identityCookie,
    );
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
    const redirect = applyPrivateCache(NextResponse.redirect(url), path);
    return copyCookies(response, redirect);
  }

  const verifiedUserId =
    resolution.status === "authenticated"
      ? resolution.user.id
      : authStatus === "authenticated" && localUser && identityAgrees
        ? localUser.id
        : null;
  const requestHeaders = trustedRequestHeaders(request, {
    status: authStatus,
    userId: verifiedUserId,
  });
  const next = applyPrivateCache(
    NextResponse.next({
      request: { headers: requestHeaders },
    }),
    path,
  );
  return copyCookies(response, next);
}

export const config = {
  // Refresh/clear auth cookies on document routes. Static assets stay out.
  // Dashboard and login still get the auth redirect; public pages stay open.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
