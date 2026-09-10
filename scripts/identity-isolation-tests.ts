import {
  AUTH_STATUS_HEADER,
  AUTH_USER_ID_HEADER,
  PATHNAME_HEADER,
  applyTrustedAuthRequestHeaders,
  authCookieNamesToDiscard,
  readLocalSessionUser,
  resolveAuthUser,
  stripInternalAuthHeaders,
} from "../src/lib/auth/session-user";
import {
  expireAuthCookies,
  expireNamedCookies,
  identitySessionCookies,
  staleTenantCookieClears,
  workspaceCookieClears,
} from "../src/lib/auth/workspace-session-cookies";
import {
  AUTH_IDENTITY_COOKIE,
  bindActiveClientCookie,
  brandSelectorCacheKey,
  cookieUserMatchesAccessToken,
  dashboardLoaderScopeKey,
  isHighRiskPath,
  localIdentityAgrees,
  mayUseCachedLocalSession,
  ordinaryUserCannotUsePlatformScope,
  parseBoundClientCookie,
  sessionMatchesProfile,
  shouldSkipAuthLookup,
  staleActiveBrandCookie,
  staleActiveClientCookie,
} from "../src/lib/security/authenticated-identity";
import { clientWhere, resolveDataScope } from "../src/lib/security/data-scope";
import { computeTenantAccess, type TenantAccessInput } from "../src/lib/security/tenant-access";
import { reportWorkspaceSelection } from "../src/lib/security/workspace-selection";
import { applyWorkspaceCookieClear } from "../src/lib/security/workspace-cookie-mutation";

let failed = 0;

function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

const ACCOUNT_A = {
  authUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  profileId: "profile-a",
  email: "account-a@example.test",
  clientId: "client-a",
  brandId: "brand-a",
};

const ACCOUNT_B = {
  authUserId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  profileId: "profile-b",
  email: "account-b@example.test",
  clientId: "client-b",
  brandId: "brand-b",
};

const runtime = { foundationAllowed: false, mode: "staging_configured" };

function accessInput(
  partial: Partial<TenantAccessInput>,
): TenantAccessInput {
  return {
    runtime,
    authenticated: true,
    databaseAvailable: true,
    profile: null,
    memberships: [],
    requestedClientId: null,
    ...partial,
  };
}

function membership(clientId: string): TenantAccessInput["memberships"][number] {
  return {
    clientId,
    clientStatus: "active",
    role: "manager",
    status: "active",
    customPermissions: [],
    deniedPermissions: [],
  };
}

function encodeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
    "base64url",
  );
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function authCookie(input: {
  authUserId: string;
  email: string;
  cookieUserId?: string;
  cookieEmail?: string;
  omitUser?: boolean;
  iat?: number;
  exp?: number;
  expiresAt?: number;
}): { name: string; value: string } {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = encodeJwt({
    sub: input.authUserId,
    email: input.email,
    aud: "authenticated",
    role: "authenticated",
    iat: input.iat ?? now,
    exp: input.exp ?? now + 3600,
  });
  const payload: Record<string, unknown> = { access_token: accessToken };
  if (typeof input.expiresAt === "number") {
    payload.expires_at = input.expiresAt;
  }
  if (!input.omitUser) {
    payload.user = {
      id: input.cookieUserId ?? input.authUserId,
      email: input.cookieEmail ?? input.email,
    };
  }
  return {
    name: "sb-example-auth-token",
    value: JSON.stringify(payload),
  };
}

function splitAuthCookieChunks(
  cookie: { name: string; value: string },
  reverseOrder = false,
): Array<{ name: string; value: string }> {
  const mid = Math.max(1, Math.floor(cookie.value.length / 2));
  const chunks = [
    { name: `${cookie.name}.0`, value: cookie.value.slice(0, mid) },
    { name: `${cookie.name}.1`, value: cookie.value.slice(mid) },
  ];
  return reverseOrder ? [...chunks].reverse() : chunks;
}

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  console.log("[identity-isolation] synthetic account A/B isolation");

  const accessA = computeTenantAccess(
    accessInput({
      profile: { id: ACCOUNT_A.profileId, role: "user", status: "active" },
      memberships: [membership(ACCOUNT_A.clientId)],
      requestedClientId: ACCOUNT_A.clientId,
    }),
  );
  const accessB = computeTenantAccess(
    accessInput({
      profile: { id: ACCOUNT_B.profileId, role: "user", status: "active" },
      memberships: [membership(ACCOUNT_B.clientId)],
      requestedClientId: ACCOUNT_B.clientId,
    }),
  );

  assert(
    "Account A logs in and sees only Account A",
    accessA.mode === "client_scoped" &&
      accessA.activeClientId === ACCOUNT_A.clientId &&
      !accessA.allowedClientIds.includes(ACCOUNT_B.clientId),
  );
  assert(
    "Account B logs in and sees only Account B",
    accessB.mode === "client_scoped" &&
      accessB.activeClientId === ACCOUNT_B.clientId &&
      !accessB.allowedClientIds.includes(ACCOUNT_A.clientId),
  );

  const afterLogout = computeTenantAccess(
    accessInput({ authenticated: false, profile: null, memberships: [] }),
  );
  const afterBLogin = computeTenantAccess(
    accessInput({
      profile: { id: ACCOUNT_B.profileId, role: "user", status: "active" },
      memberships: [membership(ACCOUNT_B.clientId)],
      requestedClientId: ACCOUNT_A.clientId,
    }),
  );
  assert("logout is unauthenticated", afterLogout.mode === "denied" && afterLogout.reason === "not_authenticated");
  assert(
    "Account A logs out; Account B logs in and sees only Account B",
    afterBLogin.mode === "client_scoped" && afterBLogin.activeClientId === ACCOUNT_B.clientId,
  );

  const staleClient = staleActiveClientCookie({
    requestedClientId: ACCOUNT_A.clientId,
    access: afterBLogin,
  });
  const staleBrand = staleActiveBrandCookie({
    requestedBrandId: ACCOUNT_A.brandId,
    availableBrandIds: [ACCOUNT_B.brandId],
    activeClientId: ACCOUNT_B.clientId,
  });
  const tenantClears = staleTenantCookieClears();
  assert("stale Account A workspace/client cookies are rejected for Account B", staleClient);
  assert("stale Account A brand cookies are rejected for Account B", staleBrand);
  assert(
    "stale tenant cookies are cleared by name",
    tenantClears.some((cookie) => cookie.name === "takatak_active_client" && cookie.value === "") &&
      tenantClears.some((cookie) => cookie.name === "takatak_active_brand" && cookie.value === ""),
  );

  const reported = reportWorkspaceSelection({
    access: afterBLogin,
    requestedClientId: ACCOUNT_A.clientId,
    rawClientCookie: bindActiveClientCookie(ACCOUNT_B.authUserId, ACCOUNT_A.clientId),
    authUserId: ACCOUNT_B.authUserId,
  });
  assert(
    "invalid workspace selection is reported without granting B access to A",
    reported.shouldClearWorkspaceCookie &&
      reported.activeClientId === ACCOUNT_B.clientId &&
      (Array.isArray(reported.allowedClientIds)
        ? !reported.allowedClientIds.includes(ACCOUNT_A.clientId)
        : reported.allowedClientIds !== "all"),
  );
  assert(
    "standalone execution does not mutate cookies",
    applyWorkspaceCookieClear(reported.shouldClearWorkspaceCookie, "takatak_active_client", undefined) === false,
  );
  const cleared: string[] = [];
  assert(
    "request-boundary adapter clears the stale cookie",
    applyWorkspaceCookieClear(
      reported.shouldClearWorkspaceCookie,
      "takatak_active_client",
      { delete: (name) => cleared.push(name) },
    ) === true && cleared[0] === "takatak_active_client",
  );

  const manipulatedClient = computeTenantAccess(
    accessInput({
      profile: { id: ACCOUNT_B.profileId, role: "user", status: "active" },
      memberships: [membership(ACCOUNT_B.clientId)],
      requestedClientId: ACCOUNT_A.clientId,
    }),
  );
  assert(
    "a manipulated client ID cannot access another tenant",
    manipulatedClient.mode === "client_scoped" &&
      manipulatedClient.activeClientId === ACCOUNT_B.clientId,
  );
  assert(
    "a manipulated brand ID cannot access another tenant",
    staleActiveBrandCookie({
      requestedBrandId: ACCOUNT_A.brandId,
      availableBrandIds: [ACCOUNT_B.brandId],
      activeClientId: ACCOUNT_B.clientId,
    }),
  );

  const userA = readLocalSessionUser([authCookie(ACCOUNT_A)]);
  const userB = readLocalSessionUser([authCookie(ACCOUNT_B)]);
  assert(
    "parallel sessions for two users remain isolated",
    userA?.id === ACCOUNT_A.authUserId &&
      userB?.id === ACCOUNT_B.authUserId &&
      userA?.email === ACCOUNT_A.email &&
      userB?.email === ACCOUNT_B.email &&
      userA?.id !== userB?.id,
  );

  const swappedCookie = readLocalSessionUser([
    authCookie({
      authUserId: ACCOUNT_A.authUserId,
      email: ACCOUNT_A.email,
      cookieUserId: ACCOUNT_B.authUserId,
      cookieEmail: ACCOUNT_B.email,
    }),
  ]);
  assert(
    "cookie user/JWT mismatch fails closed",
    swappedCookie === null,
  );
  assert(
    "cookie.user cannot override access-token identity",
    cookieUserMatchesAccessToken({
      accessTokenUserId: ACCOUNT_A.authUserId,
      accessTokenEmail: ACCOUNT_A.email,
      cookieUserId: ACCOUNT_B.authUserId,
      cookieUserEmail: ACCOUNT_B.email,
    }) === false,
  );

  const deletedAuth = await resolveAuthUser(
    {
      auth: {
        getUser: async () => ({
          data: { user: null },
          error: { message: "User not found", status: 403 },
        }),
        signOut: async () => undefined,
      },
    },
    { hasAuthCookie: true },
  );
  assert(
    "disabled/deleted Supabase Auth users cannot retain a working TAKATAK session",
    deletedAuth.status === "expired",
  );

  const disabledProfile = computeTenantAccess(
    accessInput({
      profile: { id: ACCOUNT_A.profileId, role: "user", status: "disabled" },
      memberships: [membership(ACCOUNT_A.clientId)],
    }),
  );
  assert(
    "disabled TAKATAK profiles fail closed",
    disabledProfile.mode === "denied" && disabledProfile.reason === "profile_disabled",
  );

  assert(
    "profile/authUserId/email mismatches fail closed",
    sessionMatchesProfile({
      sessionUserId: ACCOUNT_A.authUserId,
      sessionEmail: ACCOUNT_A.email,
      profileAuthUserId: ACCOUNT_B.authUserId,
      profileEmail: ACCOUNT_A.email,
    }) === false &&
      sessionMatchesProfile({
        sessionUserId: ACCOUNT_A.authUserId,
        sessionEmail: ACCOUNT_A.email,
        profileAuthUserId: ACCOUNT_A.authUserId,
        profileEmail: ACCOUNT_B.email,
      }) === false &&
      sessionMatchesProfile({
        sessionUserId: ACCOUNT_A.authUserId,
        sessionEmail: ACCOUNT_A.email,
        profileAuthUserId: ACCOUNT_A.authUserId,
        profileEmail: ACCOUNT_A.email,
      }) === true,
  );

  const scopeA = await resolveDataScope(accessA);
  const scopeB = await resolveDataScope(accessB);
  assert(
    "cached dashboard loaders are scoped by authenticated profile and tenant",
    scopeA.kind === "db" &&
      scopeB.kind === "db" &&
      JSON.stringify(clientWhere(scopeA)) !== JSON.stringify(clientWhere(scopeB)) &&
      dashboardLoaderScopeKey({
        authUserId: ACCOUNT_A.authUserId,
        profileId: ACCOUNT_A.profileId,
        clientId: ACCOUNT_A.clientId,
      }) !==
        dashboardLoaderScopeKey({
          authUserId: ACCOUNT_B.authUserId,
          profileId: ACCOUNT_B.profileId,
          clientId: ACCOUNT_B.clientId,
        }) &&
      brandSelectorCacheKey(ACCOUNT_A.profileId, ACCOUNT_A.clientId) !==
        brandSelectorCacheKey(ACCOUNT_B.profileId, ACCOUNT_A.clientId),
  );

  const ordinaryAdminAttempt = computeTenantAccess(
    accessInput({
      profile: { id: ACCOUNT_A.profileId, role: "user", status: "active" },
      memberships: [],
      requestedClientId: ACCOUNT_B.clientId,
    }),
  );
  assert(
    "ordinary users cannot use TAKATAK master authority",
    ordinaryAdminAttempt.mode === "denied" &&
      ordinaryUserCannotUsePlatformScope({
        platformRole: "user",
        accessMode: ordinaryAdminAttempt.mode,
      }),
  );

  const explicitOwner = computeTenantAccess(
    accessInput({
      profile: { id: "owner-profile", role: "owner", status: "active" },
      memberships: [],
    }),
  );
  assert(
    "admin/owner elevation is explicit and server-authorized",
    explicitOwner.mode === "platform_admin" && explicitOwner.role === "owner",
  );

  const loginClears = workspaceCookieClears();
  const logoutAuth = expireAuthCookies(["sb-example-auth-token.0"]);
  assert(
    "logging out and logging into another account clears auth, workspace, client and brand cookies",
    loginClears.some((cookie) => cookie.name === "takatak_active_client") &&
      loginClears.some((cookie) => cookie.name === "takatak_active_brand") &&
      loginClears.some((cookie) => cookie.name === AUTH_IDENTITY_COOKIE) &&
      logoutAuth.some((cookie) => cookie.name === "sb-example-auth-token.0" && cookie.value === ""),
  );

  const bound = identitySessionCookies(ACCOUNT_B.authUserId);
  assert(
    "new login binds identity to Account B, not Account A",
    bound.some((cookie) => cookie.name === AUTH_IDENTITY_COOKIE && cookie.value === ACCOUNT_B.authUserId) &&
      !bound.some((cookie) => cookie.value === ACCOUNT_A.authUserId),
  );

  assert(
    "stale identity cookie does not skip Auth lookup",
    shouldSkipAuthLookup({
      hasLocalUser: true,
      sessionUserId: ACCOUNT_B.authUserId,
      identityCookie: ACCOUNT_A.authUserId,
      verifiedAtMs: Date.now(),
      tokenIsFresh: true,
    }) === false,
  );
  assert(
    "matching identity and fresh verification may skip lookup",
    localIdentityAgrees({
      sessionUserId: ACCOUNT_B.authUserId,
      identityCookie: ACCOUNT_B.authUserId,
    }) &&
      shouldSkipAuthLookup({
        hasLocalUser: true,
        sessionUserId: ACCOUNT_B.authUserId,
        identityCookie: ACCOUNT_B.authUserId,
        verifiedAtMs: Date.now(),
        tokenIsFresh: true,
      }) === true,
  );
  assert(
    "expired Auth verification cannot skip lookup",
    shouldSkipAuthLookup({
      hasLocalUser: true,
      sessionUserId: ACCOUNT_B.authUserId,
      identityCookie: ACCOUNT_B.authUserId,
      verifiedAtMs: Date.now() - 10 * 60 * 1000,
      tokenIsFresh: true,
    }) === false,
  );

  assert(
    "five-minute cached verification cannot authorize high-risk routes",
    mayUseCachedLocalSession({
      pathname: "/api/billing/stripe/checkout",
      hasLocalUser: true,
      sessionUserId: ACCOUNT_B.authUserId,
      identityCookie: ACCOUNT_B.authUserId,
      verifiedAtMs: Date.now(),
      tokenIsFresh: true,
    }) === false &&
      isHighRiskPath("/api/account") &&
      isHighRiskPath("/api/team/members/1/role") &&
      isHighRiskPath("/dashboard/admin") &&
      !isHighRiskPath("/api/health"),
  );

  const identityWrites = identitySessionCookies(ACCOUNT_B.authUserId);
  const identityCookieWrite = identityWrites.find(
    (cookie) => cookie.name === AUTH_IDENTITY_COOKIE,
  );
  assert(
    "takatak_auth_identity is HttpOnly and SameSite=Lax",
    identityCookieWrite?.options?.httpOnly === true &&
      identityCookieWrite?.options?.sameSite === "lax",
  );
  const previousNodeEnv = process.env.NODE_ENV;
  Reflect.set(process.env, "NODE_ENV", "production");
  const productionIdentity = identitySessionCookies(ACCOUNT_B.authUserId);
  Reflect.set(process.env, "NODE_ENV", previousNodeEnv);
  assert(
    "takatak_auth_identity is Secure in production and cannot authenticate alone",
    productionIdentity.find((cookie) => cookie.name === AUTH_IDENTITY_COOKIE)
      ?.options?.secure === true &&
      sessionMatchesProfile({
        sessionUserId: ACCOUNT_B.authUserId,
        sessionEmail: ACCOUNT_B.email,
        profileAuthUserId: ACCOUNT_A.authUserId,
        profileEmail: ACCOUNT_A.email,
      }) === false,
  );

  const userC = computeTenantAccess(
    accessInput({
      profile: { id: "profile-c", role: "user", status: "active" },
      memberships: [],
    }),
  );
  assert(
    "Account C with no workspace receives an honest empty/onboarding state",
    userC.mode === "denied" && userC.reason === "membership_missing",
  );

  const unauthenticatedDashboard = computeTenantAccess(
    accessInput({ authenticated: false, profile: null, memberships: [] }),
  );
  assert(
    "unauthenticated dashboard requests are rejected",
    unauthenticatedDashboard.mode === "denied" &&
      unauthenticatedDashboard.reason === "not_authenticated",
  );

  const now = Math.floor(Date.now() / 1000);
  const leftoverA = authCookie({
    authUserId: ACCOUNT_A.authUserId,
    email: ACCOUNT_A.email,
    iat: now - 3_600,
    exp: now + 86_400,
    expiresAt: now + 86_400,
  });
  leftoverA.name = "sb-example-auth-token.0";
  const currentB = authCookie({
    authUserId: ACCOUNT_B.authUserId,
    email: ACCOUNT_B.email,
    iat: now,
    exp: now + 600,
    expiresAt: now + 600,
  });
  const mixedSession = readLocalSessionUser([leftoverA, currentB]);
  assert(
    "leftover JWT with later expiry cannot override the current login",
    mixedSession?.id === ACCOUNT_B.authUserId &&
      mixedSession?.email === ACCOUNT_B.email,
  );

  const foreignProject = authCookie({
    authUserId: ACCOUNT_A.authUserId,
    email: ACCOUNT_A.email,
    iat: now + 10,
  });
  foreignProject.name = "sb-otherproject-auth-token";
  const currentProject = readLocalSessionUser([foreignProject, currentB]);
  assert(
    "another Supabase project's leftover cookie cannot become the session",
    currentProject?.id === ACCOUNT_B.authUserId,
  );
  const discarded = authCookieNamesToDiscard(
    [foreignProject, leftoverA, currentB],
    ACCOUNT_B.authUserId,
  );
  assert(
    "foreign and leftover auth cookies are expired for the current user",
    discarded.includes("sb-otherproject-auth-token") &&
      discarded.includes("sb-example-auth-token.0") &&
      !discarded.includes("sb-example-auth-token"),
  );
  assert(
    "a clean current session does not expire placeholder auth cookie chunks",
    authCookieNamesToDiscard([currentB], ACCOUNT_B.authUserId).length === 0,
  );

  const chunkedB = splitAuthCookieChunks(currentB, true);
  const chunk0 = chunkedB.find((cookie) => cookie.name.endsWith(".0"));
  const chunk1 = chunkedB.find((cookie) => cookie.name.endsWith(".1"));
  assert(
    "chunked Supabase cookies are reconstituted in index order, not cookie-header order",
    chunkedB[0]?.name.endsWith(".1") === true &&
      readLocalSessionUser(chunkedB)?.id === ACCOUNT_B.authUserId,
  );
  let partialChunkParses = false;
  try {
    JSON.parse(chunk0?.value ?? "");
    partialChunkParses = true;
  } catch {
    partialChunkParses = false;
  }
  assert("partial auth cookie chunk is not valid JSON on its own", !partialChunkParses);
  assert(
    "a partial leftover chunk cannot become the session",
    readLocalSessionUser(chunk0 ? [chunk0] : []) === null &&
      readLocalSessionUser(chunk1 ? [chunk1] : []) === null,
  );
  const chunkedDiscard = authCookieNamesToDiscard(
    [...chunkedB, foreignProject],
    ACCOUNT_B.authUserId,
  );
  assert(
    "chunked current-session cookies are preserved during leftover cleanup",
    !chunkedDiscard.includes("sb-example-auth-token.0") &&
      !chunkedDiscard.includes("sb-example-auth-token.1") &&
      chunkedDiscard.includes("sb-otherproject-auth-token"),
  );

  const staleWholeA = authCookie({
    authUserId: ACCOUNT_A.authUserId,
    email: ACCOUNT_A.email,
    iat: now - 3_600,
    expiresAt: now + 86_400,
  });
  const mixedWholeAndChunks = readLocalSessionUser([
    staleWholeA,
    ...splitAuthCookieChunks(currentB),
  ]);
  const mixedDiscard = authCookieNamesToDiscard(
    [staleWholeA, ...splitAuthCookieChunks(currentB)],
    ACCOUNT_B.authUserId,
  );
  assert(
    "newer chunked JWT wins over a stale unchunked leftover on the same project",
    mixedWholeAndChunks?.id === ACCOUNT_B.authUserId,
  );
  assert(
    "cleanup expires the stale whole cookie and keeps the current chunks",
    mixedDiscard.includes("sb-example-auth-token") &&
      !mixedDiscard.includes("sb-example-auth-token.0") &&
      !mixedDiscard.includes("sb-example-auth-token.1"),
  );

  const expiredWrites = expireNamedCookies(["sb-otherproject-auth-token"]);
  const previousCookieEnv = process.env.NODE_ENV;
  Reflect.set(process.env, "NODE_ENV", "production");
  const productionClears = expireNamedCookies(["sb-otherproject-auth-token"]);
  Reflect.set(process.env, "NODE_ENV", previousCookieEnv);
  assert(
    "stale auth cookie cleanup uses path=/, HttpOnly, and SameSite=Lax",
    expiredWrites[0]?.value === "" &&
      expiredWrites[0]?.options?.path === "/" &&
      expiredWrites[0]?.options?.httpOnly === true &&
      expiredWrites[0]?.options?.sameSite === "lax" &&
      expiredWrites[0]?.options?.maxAge === 0,
  );
  assert(
    "stale auth cookie cleanup is Secure in production",
    productionClears[0]?.options?.secure === true,
  );

  const spoofed = new Headers({
    [AUTH_USER_ID_HEADER]: ACCOUNT_A.authUserId,
    [AUTH_STATUS_HEADER]: "authenticated",
    [PATHNAME_HEADER]: "/dashboard",
    cookie: "unrelated=1",
  });
  applyTrustedAuthRequestHeaders(spoofed, {
    status: "anonymous",
    pathname: "/login",
  });
  assert(
    "a public request cannot keep a client-supplied x-takatak-auth-user-id",
    spoofed.get(AUTH_USER_ID_HEADER) === null &&
      spoofed.get(AUTH_STATUS_HEADER) === "anonymous" &&
      spoofed.get(PATHNAME_HEADER) === "/login" &&
      spoofed.get("cookie") === "unrelated=1",
  );
  applyTrustedAuthRequestHeaders(spoofed, {
    status: "authenticated",
    pathname: "/dashboard",
    userId: ACCOUNT_B.authUserId,
  });
  assert(
    "proxy overwrites the internal identity header with the trusted user id",
    spoofed.get(AUTH_USER_ID_HEADER) === ACCOUNT_B.authUserId,
  );
  const responseHeaders = new Headers({
    [AUTH_USER_ID_HEADER]: ACCOUNT_A.authUserId,
    [AUTH_STATUS_HEADER]: "authenticated",
    "cache-control": "private, no-store",
  });
  stripInternalAuthHeaders(responseHeaders);
  assert(
    "internal identity headers are never exposed as response headers",
    responseHeaders.get(AUTH_USER_ID_HEADER) === null &&
      responseHeaders.get(AUTH_STATUS_HEADER) === null &&
      responseHeaders.get("cache-control") === "private, no-store",
  );

  assert(
    "workspace cookie bound to Account A cannot be used as Account B",
    parseBoundClientCookie(
      bindActiveClientCookie(ACCOUNT_A.authUserId, ACCOUNT_A.clientId),
      ACCOUNT_B.authUserId,
    ) === null,
  );
  assert(
    "workspace cookie bound to Account B is usable only by Account B",
    parseBoundClientCookie(
      bindActiveClientCookie(ACCOUNT_B.authUserId, ACCOUNT_B.clientId),
      ACCOUNT_B.authUserId,
    ) === ACCOUNT_B.clientId,
  );
  assert(
    "identity cookie from Account A blocks Account B from a legacy workspace cookie",
    parseBoundClientCookie(
      ACCOUNT_A.clientId,
      ACCOUNT_B.authUserId,
      ACCOUNT_A.authUserId,
    ) === null,
  );

  const noFallback = computeTenantAccess(
    accessInput({
      profile: null,
      memberships: [membership(ACCOUNT_A.clientId)],
      requestedClientId: ACCOUNT_A.clientId,
    }),
  );
  assert(
    "no fallback query returns another user when the profile is missing",
    noFallback.mode === "denied" && noFallback.reason === "profile_missing",
  );

  {
    const { readFileSync } = await import("node:fs");
    const tenantSource = readFileSync(
      new URL("../src/lib/security/tenant-access.ts", import.meta.url),
      "utf8",
    );
    const proxySource = readFileSync(
      new URL("../src/proxy.ts", import.meta.url),
      "utf8",
    );
    const layoutSource = readFileSync(
      new URL("../src/app/dashboard/layout.tsx", import.meta.url),
      "utf8",
    );
    const nextConfigSource = readFileSync(
      new URL("../next.config.ts", import.meta.url),
      "utf8",
    );
    assert(
      "dashboard profile data resolves by authenticated user ID",
      tenantSource.includes("authUserId: user.id") &&
        tenantSource.includes("findUnique"),
    );
    assert(
      "tenant access does not use unbounded profile findFirst",
      !tenantSource.includes("profile.findFirst("),
    );
    assert(
      "proxy never rewrites identity cookies back to a leftover local JWT",
      !proxySource.includes("identitySessionCookies(localUser") &&
        proxySource.includes("applyTrustedAuthRequestHeaders") &&
        proxySource.includes("stripInternalAuthHeaders") &&
        proxySource.includes("writes.length === 0"),
    );
    const sessionServerSource = readFileSync(
      new URL("../src/lib/auth/supabase-server.ts", import.meta.url),
      "utf8",
    );
    assert(
      "a spoofed x-takatak-auth-user-id without a matching local JWT cannot authenticate",
      sessionServerSource.includes("claimedUserId && !localUser") &&
        sessionServerSource.includes("return null"),
    );
    const loginSource = readFileSync(
      new URL("../src/components/auth/login-form.tsx", import.meta.url),
      "utf8",
    );
    const otpSource = readFileSync(
      new URL("../src/components/auth/otp-form.tsx", import.meta.url),
      "utf8",
    );
    const signoutSource = readFileSync(
      new URL("../src/app/auth/signout/route.ts", import.meta.url),
      "utf8",
    );
    assert(
      "logout clears OTP sessionStorage and redirects with signed_out",
      loginSource.includes('searchParams.get("signed_out")') &&
        loginSource.includes('sessionStorage.removeItem("verifyEmail")') &&
        signoutSource.includes("signed_out=1"),
    );
    assert(
      "OTP form does not reuse leftover sessionStorage.verifyEmail after logout",
      !otpSource.includes('sessionStorage.getItem("verifyEmail")'),
    );
    assert(
      "authenticated dashboard layout is dynamic and not statically cached",
      layoutSource.includes('dynamic = "force-dynamic"') &&
        layoutSource.includes("revalidate = 0"),
    );
    assert(
      "authenticated routes send private no-store cache headers",
      nextConfigSource.includes("private, no-store") &&
        nextConfigSource.includes("/dashboard/:path*"),
    );
    const actionsSource = readFileSync(
      new URL("../src/app/dashboard/select-client/actions.ts", import.meta.url),
      "utf8",
    );
    assert(
      "switching workspace requires a membership-validated client ID",
      actionsSource.includes("access.activeClientId !== clientId") &&
        actionsSource.includes("bindActiveClientCookie"),
    );
  }

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
