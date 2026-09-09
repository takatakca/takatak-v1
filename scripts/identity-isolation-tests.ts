import { readLocalSessionUser, resolveAuthUser } from "../src/lib/auth/session-user";
import {
  expireAuthCookies,
  identitySessionCookies,
  staleTenantCookieClears,
  workspaceCookieClears,
} from "../src/lib/auth/workspace-session-cookies";
import {
  AUTH_IDENTITY_COOKIE,
  brandSelectorCacheKey,
  cookieUserMatchesAccessToken,
  dashboardLoaderScopeKey,
  isHighRiskPath,
  localIdentityAgrees,
  mayUseCachedLocalSession,
  ordinaryUserCannotUsePlatformScope,
  sessionMatchesProfile,
  shouldSkipAuthLookup,
  staleActiveBrandCookie,
  staleActiveClientCookie,
} from "../src/lib/security/authenticated-identity";
import { clientWhere, resolveDataScope } from "../src/lib/security/data-scope";
import { computeTenantAccess, type TenantAccessInput } from "../src/lib/security/tenant-access";

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
}): { name: string; value: string } {
  const accessToken = encodeJwt({
    sub: input.authUserId,
    email: input.email,
    aud: "authenticated",
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  const payload: Record<string, unknown> = { access_token: accessToken };
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

async function main() {
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

  {
    const { readFileSync } = await import("node:fs");
    const tenantSource = readFileSync(
      new URL("../src/lib/security/tenant-access.ts", import.meta.url),
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
      "identity repair does not import untracked role-permissions",
      !tenantSource.includes("role-permissions"),
    );
  }

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
