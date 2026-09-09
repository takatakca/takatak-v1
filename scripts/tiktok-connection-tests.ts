/**
 * TikTok Login Kit connection tests.
 * Synthetic payloads only. Never prints tokens, codes, or IDs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { pickSelectedTikTokAccountStrict } from "../src/lib/social/connections/social-canonical-identity";
import { mapTikTokIdentityFromRecord } from "../src/lib/social/providers/tiktok-token";
import { TIKTOK_OAUTH_START_SCOPES } from "../src/lib/social/providers/tiktok-oauth";

type Status = "PASS" | "FAIL";
type Result = { name: string; status: Status; evidence: string };

const results: Result[] = [];

function check(name: string, run: () => string) {
  try {
    results.push({ name, status: "PASS", evidence: run() });
  } catch (error) {
    results.push({
      name, status: "FAIL",
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

check("OAuth start requests Login Kit identity scopes", () => {
  assert(
    TIKTOK_OAUTH_START_SCOPES.includes("user.info.basic"),
    "user.info.basic",
  );
  assert(
    TIKTOK_OAUTH_START_SCOPES.includes("user.info.profile"),
    "user.info.profile",
  );
  assert(
    !(TIKTOK_OAUTH_START_SCOPES as readonly string[]).includes("video.publish"),
    "no publish scope",
  );
  return "user.info.basic + user.info.profile; publishing not requested";
});

check("Mapper reads TikTok open_id identity", () => {
  const mapped = mapTikTokIdentityFromRecord({
    open_id: "should-not-print",
    username: "bakery.mtl",
    display_name: "Montreal Bakery",
    avatar_url: "https://p16-sign-va.tiktokcdn.com/pic.jpg",
  });
  assert(mapped?.handle === "bakery.mtl", "handle");
  assert(mapped?.displayName === "Montreal Bakery", "name");
  assert(mapped?.profileImageUrl?.includes("tiktokcdn.com"), "picture");
  assert(mapped?.externalSubjectId === "should-not-print", "open_id");
  const missing = mapTikTokIdentityFromRecord({
    display_name: "No id",
  });
  assert(missing === null, "empty");
  return "username/name mapped; missing open_id is rejected";
});

check("Selected TikTok picker is strict", () => {
  const ready = pickSelectedTikTokAccountStrict([
    {
      id: "a",
      platform: "tiktok",
      status: "connected",
      accessStatus: "selected",
      displayName: "Bakery",
    },
  ]);
  assert(ready.kind === "ready", "ready");
  const ambiguous = pickSelectedTikTokAccountStrict([
    {
      id: "a",
      platform: "tiktok",
      status: "connected",
      accessStatus: "selected",
    },
    {
      id: "b",
      platform: "tiktok",
      status: "connected",
      accessStatus: "selected",
    },
  ]);
  assert(ambiguous.kind === "ambiguous", "ambiguous");
  return "strict selected TikTok identity";
});

check("TikTok personal card starts independent Login Kit", () => {
  const modal = readSource(
    "src/components/social/connections/manage-connections-modal.tsx",
  );
  assert(modal.includes('key: "tiktok-personal"'), "personal card");
  assert(modal.includes('provider: "tiktok"'), "tiktok provider");
  const businessCard = modal.slice(modal.indexOf('key: "tiktok-business"'));
  assert(businessCard.includes("planned: true"), "business planned");
  const registry = readSource("src/lib/social/providers/registry.ts");
  const tiktokBlock = registry.slice(registry.indexOf("tiktok:"));
  assert(tiktokBlock.includes("implemented: true"), "registry implemented");
  assert(tiktokBlock.includes("connectable: true"), "registry connectable");
  return "personal Login Kit is the implemented TikTok card";
});

check("TikTok Login Kit callbacks exist", () => {
  const files = [
    "src/lib/social/providers/tiktok-oauth.ts",
    "src/lib/social/providers/tiktok-token.ts",
    "src/app/api/social/callback/tiktok/route.ts",
    "src/app/api/social/callback/tiktok/handoff/route.ts",
    "src/lib/social/connections/tiktok-dashboard-resolve.ts",
    "src/components/social/platforms/tiktok-connect-page.tsx",
    "prisma/migrations/20260828020000_tiktok_account_uniqueness/migration.sql",
  ];
  for (const file of files) {
    assert(existsSync(resolve(process.cwd(), file)), file);
  }
  const oauth = readSource("src/lib/social/providers/tiktok-oauth.ts");
  assert(oauth.includes("tiktok.com"), "tiktok host");
  assert(oauth.includes("v2/auth/authorize"), "authorize path");
  assert(oauth.includes("client_key"), "client_key");
  const token = readSource("src/lib/social/providers/tiktok-token.ts");
  assert(token.includes("open.tiktokapis.com"), "token host");
  assert(token.includes("v2/oauth/token"), "token path");
  assert(token.includes("v2/user/info"), "user info");
  return "direct TikTok login routes";
});

check("TikTok page starts independent Login Kit", () => {
  const page = readSource(
    "src/components/social/platforms/tiktok-connect-page.tsx",
  );
  assert(page.includes('provider: "tiktok"'), "independent start");
  assert(page.includes("Connect TikTok"), "connect CTA");
  const start = readSource("src/lib/social/connections/social-connection-service.ts");
  assert(start.includes("buildTikTokAuthorizationUrl"), "authorization builder");
  return "independent TikTok login";
});

check("Uniqueness migration exists", () => {
  const path =
    "prisma/migrations/20260828020000_tiktok_account_uniqueness/migration.sql";
  assert(existsSync(resolve(process.cwd(), path)), "file");
  const sql = readSource(path);
  assert(sql.includes("sa_one_connected_tiktok_account_per_client_key"), "client");
  assert(sql.includes("sa_one_connected_tiktok_per_connection_key"), "connection");
  return "partial unique indexes";
});

const failed = results.filter((row) => row.status === "FAIL");

for (const row of results) {
  console.log(`${row.status}  ${row.name} — ${row.evidence}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} TikTok connection check(s) failed.`);
  process.exit(1);
}

console.log(`\n${results.length} TikTok connection checks passed.`);
