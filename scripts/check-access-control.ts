// Phase 15A — Access-control matrix over the PURE decision function.
// No mocks of the logic under test: computeTenantAccess is the real code.
// Exit 1 on any mismatch.
import { computeTenantAccess, type TenantAccessInput } from "../src/lib/security/tenant-access";

const dev = { foundationAllowed: false, mode: "staging_configured" };
const devFoundation = { foundationAllowed: true, mode: "development_foundation" };
const prodBlocked = { foundationAllowed: false, mode: "production_blocked" };

function input(partial: Partial<TenantAccessInput>): TenantAccessInput {
  return {
    runtime: dev,
    authenticated: true,
    databaseAvailable: true,
    profile: null,
    memberships: [],
    requestedClientId: null,
    ...partial,
  };
}

const P = (role: string, status = "active") => ({ id: "p1", role: role as never, status });
const M = (
  ...ids: string[]
): TenantAccessInput["memberships"] =>
  ids.map((clientId) => ({
    clientId,
    clientStatus: "active",
    role: "viewer",
    status: "active",
    customPermissions: [],
    deniedPermissions: [],
  }));

const SUSPENDED_MEMBERSHIP: TenantAccessInput["memberships"] = [
  {
    clientId: "c1",
    clientStatus: "active",
    role: "viewer",
    status: "suspended",
    customPermissions: [],
    deniedPermissions: [],
  },
];

const cases: { name: string; input: TenantAccessInput; expect: (a: ReturnType<typeof computeTenantAccess>) => boolean }[] = [
  { name: "unauthenticated → denied not_authenticated", input: input({ authenticated: false }), expect: (a) => a.mode === "denied" && a.reason === "not_authenticated" },
  { name: "authed, no profile → denied profile_missing (NOT owner)", input: input({}), expect: (a) => a.mode === "denied" && a.reason === "profile_missing" },
  { name: "disabled profile → denied even with memberships", input: input({ profile: P("manager", "disabled"), memberships: M("c1") }), expect: (a) => a.mode === "denied" && a.reason === "profile_disabled" },
  { name: "viewer, zero memberships → denied membership_missing", input: input({ profile: P("viewer") }), expect: (a) => a.mode === "denied" && a.reason === "membership_missing" },
  { name: "manager, zero memberships → denied (no global leak)", input: input({ profile: P("manager") }), expect: (a) => a.mode === "denied" && a.reason === "membership_missing" },
  {
    name: "suspended membership → denied membership_suspended",
    input: input({
      profile: P("viewer"),
      memberships: SUSPENDED_MEMBERSHIP,
    }),
    expect: (access) =>
      access.mode === "denied" &&
      access.reason === "membership_suspended",
  },
  { name: "staff, one membership → client_scoped auto-active", input: input({ profile: P("staff"), memberships: M("c1") }), expect: (a) => a.mode === "client_scoped" && a.activeClientId === "c1" && a.allowedClientIds.length === 1 },
  { name: "viewer, two memberships, none requested → selection_required", input: input({ profile: P("viewer"), memberships: M("c1", "c2") }), expect: (a) => a.mode === "selection_required" },
  { name: "viewer, two memberships, valid request → scoped to it", input: input({ profile: P("viewer"), memberships: M("c1", "c2"), requestedClientId: "c2" }), expect: (a) => a.mode === "client_scoped" && a.activeClientId === "c2" },
  { name: "TAMPERED cookie: request non-member client → denied client_not_allowed", input: input({ profile: P("viewer"), memberships: M("c1"), requestedClientId: "cEvil" }), expect: (a) => a.mode === "denied" && a.reason === "client_not_allowed" },
  { name: "owner profile → platform_admin all", input: input({ profile: P("owner") }), expect: (a) => a.mode === "platform_admin" && a.allowedClientIds === "all" },
  { name: "admin profile → platform_admin", input: input({ profile: P("admin") }), expect: (a) => a.mode === "platform_admin" },
  { name: "admin but DISABLED → denied", input: input({ profile: P("admin", "disabled") }), expect: (a) => a.mode === "denied" && a.reason === "profile_disabled" },
  { name: "db unavailable → denied database_unavailable (no mock leak)", input: input({ databaseAvailable: false, profile: P("owner") }), expect: (a) => a.mode === "denied" && a.reason === "database_unavailable" },
  { name: "production blocked → denied production_foundation_blocked", input: input({ runtime: prodBlocked, authenticated: false }), expect: (a) => a.mode === "denied" && a.reason === "production_foundation_blocked" },
  { name: "dev foundation → foundation_demo with warning", input: input({ runtime: devFoundation, authenticated: false, databaseAvailable: false }), expect: (a) => a.mode === "foundation_demo" && a.warning.length > 0 },
];

let pass = 0;
for (const c of cases) {
  const result = computeTenantAccess(c.input);
  if (c.expect(result)) pass++;
  else console.error(`FAIL: ${c.name} → got ${JSON.stringify(result)}`);
}
console.log(`access-control matrix: ${pass}/${cases.length} pass`);
if (pass !== cases.length) process.exit(1);
