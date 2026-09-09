/**
 * X / Twitter OAuth 2.0 connection tests.
 * Synthetic payloads only. Never prints tokens, codes, or IDs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { pickSelectedXAccountStrict } from "../src/lib/social/connections/social-canonical-identity";
import { mapXIdentityFromRecord } from "../src/lib/social/providers/x-token";
import { X_OAUTH_START_SCOPES } from "../src/lib/social/providers/x-oauth";

type Status = "PASS" | "FAIL";
type Result = { name: string; status: Status; evidence: string };

const results: Result[] = [];

function check(name: string, run: () => string) {
  try {
    results.push({ name, status: "PASS", evidence: run() });
  } catch (error) {
    results.push({
      name,
      status: "FAIL",
      evidence: error instanceof Error ? error.message : "unknown",
    });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function readSource(relative: string): string {
  return readFileSync(resolve(process.cwd(), relative), "utf8");
}

check("OAuth start requests identity scopes with PKCE refresh", () => {
  assert(X_OAUTH_START_SCOPES.includes("tweet.read"), "tweet.read");
  assert(X_OAUTH_START_SCOPES.includes("users.read"), "users.read");
  assert(X_OAUTH_START_SCOPES.includes("offline.access"), "offline.access");
  assert(
    !(X_OAUTH_START_SCOPES as readonly string[]).includes("tweet.write"),
    "no publish scope",
  );
  return "tweet.read + users.read + offline.access; publishing not requested";
});

check("Mapper reads X user identity", () => {
  const mapped = mapXIdentityFromRecord({
    id: "should-not-print",
    username: "bakery_mtl",
    name: "Montreal Bakery",
    profile_image_url: "https://pbs.twimg.com/profile_images/pic.jpg",
  });
  assert(mapped?.handle === "bakery_mtl", "handle");
  assert(mapped?.displayName === "Montreal Bakery", "name");
  assert(mapped?.profileImageUrl?.includes("pbs.twimg.com"), "picture");
  assert(mapped?.externalSubjectId === "should-not-print", "id");
  const missing = mapXIdentityFromRecord({
    name: "No id",
  });
  assert(missing === null, "empty");
  return "username/name mapped; missing id is rejected";
});

check("Selected X picker is strict", () => {
  const ready = pickSelectedXAccountStrict([
    {
      id: "a",
      platform: "x",
      status: "connected",
      accessStatus: "selected",
      displayName: "Bakery",
    },
  ]);
  assert(ready.kind === "ready", "ready");
  const ambiguous = pickSelectedXAccountStrict([
    {
      id: "a",
      platform: "x",
      status: "connected",
      accessStatus: "selected",
    },
    {
      id: "b",
      platform: "x",
      status: "connected",
      accessStatus: "selected",
    },
  ]);
  assert(ambiguous.kind === "ambiguous", "ambiguous");
  return "strict selected X identity";
});

check("X card starts independent OAuth 2.0", () => {
  const modal = readSource(
    "src/components/social/connections/manage-connections-modal.tsx",
  );
  assert(modal.includes('key: "x"'), "x card");
  assert(modal.includes('provider: "x"'), "x provider");
  assert(modal.includes("pickSelectedXAccount"), "strict picker");
  const registry = readSource("src/lib/social/providers/registry.ts");
  const xBlock = registry.slice(registry.indexOf("x:"));
  assert(xBlock.includes("implemented: true"), "registry implemented");
  assert(xBlock.includes("connectable: true"), "registry connectable");
  assert(xBlock.includes("oauth2_pkce"), "pkce");
  return "X OAuth 2.0 is the implemented connection card";
});

check("X OAuth callbacks exist", () => {
  const files = [
    "src/lib/social/providers/x-oauth.ts",
    "src/lib/social/providers/x-token.ts",
    "src/app/api/social/callback/x/route.ts",
    "src/app/api/social/callback/x/handoff/route.ts",
    "src/lib/social/connections/x-dashboard-resolve.ts",
    "src/components/social/platforms/x-connect-page.tsx",
    "prisma/migrations/20260829070000_x_account_uniqueness/migration.sql",
  ];
  for (const file of files) {
    assert(existsSync(resolve(process.cwd(), file)), file);
  }
  const oauth = readSource("src/lib/social/providers/x-oauth.ts");
  assert(oauth.includes("twitter.com"), "twitter host");
  assert(oauth.includes("i/oauth2/authorize"), "authorize path");
  assert(oauth.includes("code_challenge"), "pkce challenge");
  assert(oauth.includes("code_challenge_method"), "s256");
  const token = readSource("src/lib/social/providers/x-token.ts");
  assert(token.includes("api.twitter.com"), "token host");
  assert(token.includes("2/oauth2/token"), "token path");
  assert(token.includes("2/users/me"), "user info");
  assert(token.includes("code_verifier"), "pkce verifier");
  return "direct X login routes";
});

check("X page starts independent OAuth", () => {
  const page = readSource(
    "src/components/social/platforms/x-connect-page.tsx",
  );
  assert(page.includes('provider: "x"'), "independent start");
  assert(page.includes("Connect X"), "connect CTA");
  const start = readSource(
    "src/lib/social/connections/social-connection-service.ts",
  );
  assert(start.includes("buildXAuthorizationUrl"), "authorization builder");
  return "independent X login";
});

check("Uniqueness migration exists", () => {
  const path =
    "prisma/migrations/20260829070000_x_account_uniqueness/migration.sql";
  assert(existsSync(resolve(process.cwd(), path)), "file");
  const sql = readSource(path);
  assert(sql.includes("sa_one_connected_x_account_per_client_key"), "client");
  assert(sql.includes("sa_one_connected_x_per_connection_key"), "connection");
  return "partial unique indexes";
});

const failed = results.filter((row) => row.status === "FAIL");

for (const row of results) {
  console.log(`${row.status}  ${row.name} — ${row.evidence}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} X connection check(s) failed.`);
  process.exit(1);
}

console.log(`\n${results.length} X connection checks passed.`);
