// Ephemeral application-flow proofs against local Supabase + Prisma.
import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";

import { POST as registerPost } from "../src/app/api/auth/register/route";
import { sendEmailOtp, verifyEmailOtp } from "../src/lib/auth/otp/service";
import { readMemoryOtp } from "../src/lib/auth/otp/memory-store";
import { expireAuthCookies, workspaceCookieClears } from "../src/lib/auth/workspace-session-cookies";
import { getPrisma } from "../src/lib/db/prisma";
import { getRuntimeInfo } from "../src/lib/security/runtime-mode";
import { computeTenantAccess } from "../src/lib/security/tenant-access";
import type { RoleKey } from "../src/lib/security/roles";
import { assertProfileCanManageSocialAccounts } from "../src/lib/social/connections/social-connection-auth";

const FORBIDDEN = "pcjfahhlozsseqqevimi";
const SEED_PATH =
  process.env.EPHEMERAL_SEED_PATH?.trim() || "/tmp/takatak-ephemeral-seed.json";

let failed = 0;
function assert(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL ${name}${detail ? ` ${detail}` : ""}`);
}

type SeedFile = {
  a: {
    email: string;
    password: string;
    authUserId: string;
    profileId: string;
    clientId: string;
  };
  b: {
    email: string;
    password: string;
    authUserId: string;
    profileId: string;
    clientId: string;
  };
  c: { email: string; authUserId: string; profileId: string };
  disabled: { email: string; profileId: string };
};

async function passwordGrant(email: string, password: string): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("local Auth URL/anon key missing");
  }
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, grant_type: "password" }),
  });
  const text = await response.text();
  let body: { access_token?: string; error_description?: string; msg?: string } = {};
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    body = {};
  }
  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_description ||
        body.msg ||
        `password grant failed (${response.status}) ${text.slice(0, 180)}`,
    );
  }
  return body.access_token;
}

function jwtSub(token: string): string {
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8"),
  ) as { sub?: string };
  if (!payload.sub) throw new Error("Auth JWT missing sub");
  return payload.sub;
}

async function membershipsFor(profileId: string) {
  const prisma = getPrisma();
  if (!prisma) throw new Error("prisma missing");
  const rows = await prisma.clientMembership.findMany({
    where: { profileId },
    include: { client: { select: { status: true } } },
  });
  return rows.map((row) => ({
    clientId: row.clientId,
    clientStatus: row.client.status,
    role: row.role as RoleKey,
    status: row.status,
    customPermissions: row.customPermissions,
    deniedPermissions: row.deniedPermissions,
  }));
}

async function main() {
  const haystack = JSON.stringify(process.env);
  assert("app-flow is not using hosted project ref", !haystack.includes(FORBIDDEN));
  assert(
    "OTP memory adapter is enabled (no real email)",
    process.env.OTP_EMAIL_ADAPTER === "memory",
  );

  const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedFile;
  const prisma = getPrisma();
  if (!prisma) throw new Error("DATABASE_URL required");
  const runtime = getRuntimeInfo();
  assert(
    "runtime is tenant-enforcing (not foundation demo)",
    runtime.foundationAllowed === false,
    runtime.mode,
  );

  const registerEmail = "account-register@example.test";
  const registerRequest = new NextRequest("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      firstName: "Reg",
      lastName: "Ister",
      email: registerEmail,
      phone: "+15555550199",
      password: "Ephemeral#R1aaaa",
      confirmPassword: "Ephemeral#R1aaaa",
      acceptedTerms: true,
    }),
    duplex: "half",
  } as RequestInit);
  let registerResponse: Response;
  try {
    registerResponse = await registerPost(registerRequest);
  } catch (error) {
    assert(
      "registration route runs against ephemeral Auth",
      false,
      error instanceof Error ? error.stack ?? error.message : String(error),
    );
    throw error;
  }
  const registerJson = (await registerResponse.json()) as { ok?: boolean; message?: string };
  assert(
    "registration creates a local Auth user + profile",
    registerResponse.status < 300 && registerJson.ok === true,
    `status=${registerResponse.status} ${registerJson.message ?? ""}`,
  );

  const registerOtp = readMemoryOtp(registerEmail);
  assert("registration OTP was captured by the memory adapter", Boolean(registerOtp));
  if (registerOtp) {
    const verified = await verifyEmailOtp(registerEmail, registerOtp);
    assert(
      "OTP verification creates a Supabase session",
      verified.ok === true && Array.isArray(verified.cookies) && verified.cookies.length > 0,
      verified.message,
    );
  }

  const loginA = await sendEmailOtp(seed.a.email);
  assert("login OTP reservation for A succeeds", loginA.ok === true, loginA.message);
  const otpA = readMemoryOtp(seed.a.email);
  assert("memory adapter stored A OTP", Boolean(otpA));
  if (otpA) {
    const verifiedA = await verifyEmailOtp(seed.a.email, otpA);
    assert("A OTP verification yields session cookies", verifiedA.ok === true, verifiedA.message);
    const sessionNames = (verifiedA.cookies ?? []).map((cookie) => cookie.name);
    const loggedOut = [
      ...expireAuthCookies(sessionNames),
      ...workspaceCookieClears(),
    ];
    assert("logout expires auth/workspace cookies", loggedOut.length > 0);
  }

  const tokenA = await passwordGrant(seed.a.email, seed.a.password);
  const tokenB = await passwordGrant(seed.b.email, seed.b.password);
  assert("A Auth JWT sub matches seeded authUserId", jwtSub(tokenA) === seed.a.authUserId);
  assert("B Auth JWT sub matches seeded authUserId", jwtSub(tokenB) === seed.b.authUserId);
  assert("A and B Auth subjects differ", jwtSub(tokenA) !== jwtSub(tokenB));

  const accessA = computeTenantAccess({
    runtime,
    authenticated: true,
    databaseAvailable: true,
    profile: { id: seed.a.profileId, role: "user", status: "active" },
    memberships: await membershipsFor(seed.a.profileId),
    requestedClientId: seed.a.clientId,
  });
  const accessB = computeTenantAccess({
    runtime,
    authenticated: true,
    databaseAvailable: true,
    profile: { id: seed.b.profileId, role: "user", status: "active" },
    memberships: await membershipsFor(seed.b.profileId),
    requestedClientId: seed.b.clientId,
  });
  const accessAasB = computeTenantAccess({
    runtime,
    authenticated: true,
    databaseAvailable: true,
    profile: { id: seed.a.profileId, role: "user", status: "active" },
    memberships: await membershipsFor(seed.a.profileId),
    requestedClientId: seed.b.clientId,
  });
  const accessC = computeTenantAccess({
    runtime,
    authenticated: true,
    databaseAvailable: true,
    profile: { id: seed.c.profileId, role: "user", status: "active" },
    memberships: await membershipsFor(seed.c.profileId),
    requestedClientId: seed.a.clientId,
  });
  const accessDisabled = computeTenantAccess({
    runtime,
    authenticated: true,
    databaseAvailable: true,
    profile: { id: seed.disabled.profileId, role: "user", status: "disabled" },
    memberships: await membershipsFor(seed.disabled.profileId),
    requestedClientId: null,
  });

  assert(
    "dashboard identity A is scoped to Workspace A",
    accessA.mode === "client_scoped" &&
      accessA.mode === "client_scoped" &&
      "activeClientId" in accessA &&
      accessA.activeClientId === seed.a.clientId,
    JSON.stringify(accessA),
  );
  assert(
    "dashboard identity B is scoped to Workspace B",
    accessB.mode === "client_scoped" &&
      "activeClientId" in accessB &&
      accessB.activeClientId === seed.b.clientId,
  );
  assert(
    "workspace selection cannot switch A onto Workspace B",
    accessAasB.mode === "denied",
    JSON.stringify(accessAasB),
  );
  assert("C has no workspace data", accessC.mode === "denied", JSON.stringify(accessC));
  assert(
    "disabled profile fails closed",
    accessDisabled.mode === "denied" &&
      accessDisabled.mode === "denied" &&
      "reason" in accessDisabled &&
      accessDisabled.reason === "profile_disabled",
  );

  await assertProfileCanManageSocialAccounts(prisma, {
    clientId: seed.a.clientId,
    profileId: seed.a.profileId,
  });
  assert("A can authorize social connections in Workspace A", true);

  let bStolen = false;
  try {
    await assertProfileCanManageSocialAccounts(prisma, {
      clientId: seed.b.clientId,
      profileId: seed.a.profileId,
    });
    bStolen = true;
  } catch {
    bStolen = false;
  }
  assert("A cannot authorize social connections in Workspace B", bStolen === false);

  if (failed > 0) {
    console.error(`\nAPP FLOW: ${failed} FAILURE(S)`);
    process.exit(1);
  }
  console.log("\nAPP FLOW: ALL PASSED");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error("[app-flow] crashed:", message);
  process.exit(1);
});
