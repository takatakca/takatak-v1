import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { sc4nnerAuthorizeDecision } from "../src/lib/experiences/sc4nner-experience-access";
import {
  buildSc4nnerProvisionPayload,
  normalizeSc4nnerEmail,
  sc4nnerProvisionUrl,
} from "../src/lib/experiences/sc4nner-provisioning";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

// --- The authorization gate -------------------------------------------------
// Owner's order (2026-11-15): nobody authorizes SC4NNER without an
// identified TAKATAK account, and the account is shown before confirming.
assert.equal(
  sc4nnerAuthorizeDecision({ hasUser: false }),
  "login",
  "no session → login (which offers account creation), never authorize",
);
assert.equal(
  sc4nnerAuthorizeDecision({ hasUser: false, syncOutcome: "existing" }),
  "login",
  "no session stays login even with a sync outcome",
);
assert.equal(
  sc4nnerAuthorizeDecision({ hasUser: true, syncOutcome: "denied" }),
  "denied",
  "denied profile sync → denied",
);
assert.equal(
  sc4nnerAuthorizeDecision({ hasUser: true, syncOutcome: "unavailable" }),
  "unavailable",
  "unavailable identity service → unavailable",
);
assert.equal(
  sc4nnerAuthorizeDecision({ hasUser: true, syncOutcome: "error" }),
  "unavailable",
  "errored identity service → unavailable",
);
for (const outcome of ["existing", "created", "updated"] as const) {
  assert.equal(
    sc4nnerAuthorizeDecision({ hasUser: true, syncOutcome: outcome }),
    "confirm",
    `${outcome} profile sync → the identified account may confirm`,
  );
}

// --- Provisioning payload: each account provisions ITS OWN copy -------------
const payloadA = buildSc4nnerProvisionPayload({
  identityId: "identity-a",
  email: " a@example.com ",
  displayName: " Alice A ",
});
assert.deepEqual(payloadA, {
  masterIdentityId: "identity-a",
  email: "a@example.com",
  displayName: "Alice A",
  productCode: "sc4nner",
  entitlement: "sc4nner_free",
});
const payloadB = buildSc4nnerProvisionPayload({
  identityId: "identity-b",
  email: "b@example.com",
  displayName: "",
});
assert.equal(payloadB.masterIdentityId, "identity-b");
assert.equal(payloadB.email, "b@example.com");
assert.equal(
  "displayName" in payloadB,
  false,
  "empty display name is omitted, never sent blank",
);
assert.notEqual(
  payloadA.masterIdentityId,
  payloadB.masterIdentityId,
  "switching accounts changes the identity that gets provisioned",
);

// --- Provision URL derivation (no new environment variable) -----------------
assert.equal(
  sc4nnerProvisionUrl("https://sc4nner.takatak.ca/auth/callback"),
  "https://sc4nner.takatak.ca/api/provision",
);
assert.equal(
  sc4nnerProvisionUrl("https://sc4nner.takatak.ca/auth/callback?code=x"),
  "https://sc4nner.takatak.ca/api/provision",
  "query string never leaks into the provision address",
);
assert.equal(sc4nnerProvisionUrl("https://sc4nner.takatak.ca/other"), null);
assert.equal(sc4nnerProvisionUrl("not a url"), null);
assert.equal(
  sc4nnerProvisionUrl("https://user:pass@sc4nner.takatak.ca/auth/callback"),
  null,
  "credentials in the callback address are refused",
);

// --- Email normalization ------------------------------------------------------
assert.equal(normalizeSc4nnerEmail("  a@example.com "), "a@example.com");
assert.equal(normalizeSc4nnerEmail("pas-un-courriel"), null);
assert.equal(normalizeSc4nnerEmail(null), null);
assert.equal(normalizeSc4nnerEmail(undefined), null);
assert.equal(normalizeSc4nnerEmail(`${"a".repeat(250)}@example.com`), null);

// --- Route contracts (static, same style as the other bridge suites) --------
const launchRoute = read("src/app/api/experiences/sc4nner/launch/route.ts");
assert.equal(
  launchRoute.includes("createSc4nnerExperienceLaunch"),
  false,
  "GET launch issues NO code: authorization is a separate, explicit step",
);
assert.ok(
  launchRoute.includes("/experiences/sc4nner/authorize"),
  "GET launch sends the identified account to the authorize page",
);

const confirmRoute = read(
  "src/app/api/experiences/sc4nner/launch/confirm/route.ts",
);
assert.ok(confirmRoute.includes("getSessionUser"), "confirm requires a session");
assert.ok(
  confirmRoute.includes("createSc4nnerExperienceLaunch"),
  "confirm is the only place a launch code is created",
);
assert.ok(
  confirmRoute.includes("provisionSc4nnerAccount"),
  "confirming triggers the provisioning of the shown account",
);
assert.ok(
  confirmRoute.includes("NextResponse.redirect(launch.callbackUrl"),
  "the journey ends back on SC4NNER: confirm redirects to the SC4NNER callback, never to a TAKATAK page",
);
assert.ok(
  confirmRoute.includes("isConsentPostAllowed"),
  "confirm is a same-origin form POST, like the OAuth consent decision",
);
assert.ok(
  confirmRoute.includes('"/login?next=" + encodeURIComponent(next), request.url), 303'),
  "an expired session restarts at /login with a GET (303), never replays the confirmation POST",
);
assert.ok(
  confirmRoute.includes('form?.get("account")'),
  "confirm reads the account the authorize page displayed",
);
assert.ok(
  confirmRoute.includes("/experiences/sc4nner/authorize?state="),
  "a confirmation whose session no longer matches the shown account returns to the authorize screen — no code is created",
);

const authenticatedIdentity = read("src/lib/security/authenticated-identity.ts");
assert.ok(
  authenticatedIdentity.includes('"/api/experiences/sc4nner"'),
  "the SC4NNER launch routes are high-risk paths: an Auth-verified identity is required before any code is issued",
);
assert.ok(
  authenticatedIdentity.includes('"/experiences/sc4nner"'),
  "the SC4NNER authorize page is a high-risk path: an Auth-verified identity is required before the account is shown",
);

const authorizePage = read("src/app/experiences/sc4nner/authorize/page.tsx");
assert.ok(
  authorizePage.includes("Changer de compte"),
  "the authorize page offers switching accounts before authorizing",
);
assert.ok(
  authorizePage.includes("/api/experiences/sc4nner/switch"),
  "switching goes through the sign-out route that returns to this flow",
);
assert.ok(
  authorizePage.includes("accountLabel"),
  "the authorize page displays the account that will authorize",
);
assert.ok(
  authorizePage.includes('name="account" value={user.id}'),
  "the authorize form carries the displayed account, so the confirmation is bound to it",
);
assert.ok(
  authorizePage.includes("Retour à SC4NNER"),
  "every authorize frame offers the way back: the user never ends on a TAKATAK page",
);

const switchRoute = read("src/app/api/experiences/sc4nner/switch/route.ts");
assert.ok(switchRoute.includes("signOut"), "switch signs the current account out");
assert.ok(
  switchRoute.includes("/api/experiences/sc4nner/launch?state="),
  "after signing in again, the flow resumes at the launch gate",
);

const accessLib = read("src/lib/experiences/sc4nner-experience-access.ts");
assert.ok(
  accessLib.includes("primaryEmail: true"),
  "the exchange reads the identity's primary email",
);
assert.ok(
  accessLib.includes("recordSc4nnerProviderLink"),
  "the exchange refreshes the provider record of ITS identity",
);

const provisioningLib = read("src/lib/experiences/sc4nner-provisioning.ts");
assert.ok(
  provisioningLib.includes("identityId_source"),
  "the provider record upserts on (identityId, source): one copy per account",
);
assert.ok(
  provisioningLib.includes('"/api/provision"'),
  "provisioning targets SC4NNER's /api/provision",
);

// --- Schema + migration -------------------------------------------------------
const schema = read("prisma/schema.prisma");
assert.ok(schema.includes("model ProviderAccount"), "ProviderAccount model exists");
assert.ok(
  schema.includes("@@unique([identityId, source])"),
  "one provider copy per identity per source",
);
assert.ok(schema.includes('@@map("provider_accounts")'), "table name is provider_accounts");

const migrationPath =
  "prisma/migrations/20261115120000_provider_accounts/migration.sql";
assert.ok(existsSync(join(root, migrationPath)), "the migration file exists");
const migration = read(migrationPath);
assert.ok(migration.includes('CREATE TABLE "provider_accounts"'));
assert.ok(
  migration.includes("ENABLE ROW LEVEL SECURITY"),
  "RLS is enabled, like every identity-adjacent table here",
);
assert.ok(
  migration.includes('REFERENCES "master_identities"'),
  "the provider copy hangs off the master identity, the only authority",
);

console.log("sc4nner-provisioning-tests: all assertions passed");
