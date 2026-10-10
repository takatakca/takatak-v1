/**
 * Twitch OAuth 2.0 connection tests.
 * Synthetic payloads only. Never prints tokens, codes, or IDs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { pickSelectedTwitchAccountStrict } from "../src/lib/social/connections/social-canonical-identity";
import { isTwitchHostedImageUrl } from "../src/lib/social/media/remote-image";
import { mapTwitchIdentityFromRecord } from "../src/lib/social/providers/twitch-token";
import { TWITCH_OAUTH_START_SCOPES } from "../src/lib/social/providers/twitch-oauth";

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

check("OAuth start requests channel identity scopes with PKCE", () => {
  assert(TWITCH_OAUTH_START_SCOPES.includes("user:read:email"), "email");
  assert(
    TWITCH_OAUTH_START_SCOPES.includes("moderator:read:followers"),
    "followers",
  );
  assert(
    TWITCH_OAUTH_START_SCOPES.includes("channel:read:subscriptions"),
    "subscriptions",
  );
  const blocked = [
    "chat:edit",
    "chat:read",
    "channel:manage:broadcast",
    "channel:read:stream_key",
  ];
  for (const scope of blocked) {
    assert(
      !(TWITCH_OAUTH_START_SCOPES as readonly string[]).includes(scope),
      scope,
    );
  }
  return "identity and audience read scopes; chat and stream key are not requested";
});

check("Mapper reads Twitch channel identity", () => {
  const mapped = mapTwitchIdentityFromRecord({
    id: "should-not-print",
    login: "bakery_live",
    display_name: "Montreal Bakery",
    profile_image_url:
      "https://static-cdn.jtvnw.net/jtv_user_pictures/pic.png",
  });
  assert(mapped?.handle === "bakery_live", "handle");
  assert(mapped?.displayName === "Montreal Bakery", "name");
  assert(mapped?.profileImageUrl?.includes("static-cdn.jtvnw.net"), "picture");
  assert(mapped?.externalSubjectId === "should-not-print", "id");
  const foreign = mapTwitchIdentityFromRecord({
    id: "should-not-print",
    login: "bakery_live",
    display_name: "Montreal Bakery",
    profile_image_url: "https://evil.example/pic.png",
  });
  assert(foreign?.profileImageUrl === null, "foreign picture dropped");
  const missing = mapTwitchIdentityFromRecord({
    display_name: "No id",
  });
  assert(missing === null, "empty");
  assert(
    isTwitchHostedImageUrl(
      "https://static-cdn.jtvnw.net/user-default-pictures-uv/pic.png",
    ),
    "cdn host",
  );
  return "login/display_name mapped; foreign pictures and missing ids are rejected";
});

check("Selected Twitch picker is strict", () => {
  const ready = pickSelectedTwitchAccountStrict([
    {
      id: "a",
      platform: "twitch",
      status: "connected",
      accessStatus: "selected",
      displayName: "Bakery",
    },
  ]);
  assert(ready.kind === "ready", "ready");
  const ambiguous = pickSelectedTwitchAccountStrict([
    {
      id: "a",
      platform: "twitch",
      status: "connected",
      accessStatus: "selected",
    },
    {
      id: "b",
      platform: "twitch",
      status: "connected",
      accessStatus: "selected",
    },
  ]);
  assert(ambiguous.kind === "ambiguous", "ambiguous");
  return "strict selected Twitch identity";
});

check("Twitch card starts independent OAuth 2.0", () => {
  const modal = readSource(
    "src/components/social/connections/manage-connections-modal.tsx",
  );
  assert(modal.includes('key: "twitch"'), "twitch card");
  assert(modal.includes('provider: "twitch"'), "twitch provider");
  assert(modal.includes("pickSelectedTwitchAccount"), "strict picker");
  const registry = readSource("src/lib/social/providers/registry.ts");
  const twitchBlock = registry.slice(registry.indexOf("twitch:"));
  assert(twitchBlock.includes("implemented: true"), "registry implemented");
  assert(twitchBlock.includes("connectable: true"), "registry connectable");
  assert(twitchBlock.includes("oauth2_pkce"), "pkce");
  return "Twitch OAuth 2.0 is the implemented connection card";
});

check("Twitch OAuth callbacks exist", () => {
  const files = [
    "src/lib/social/providers/twitch-oauth.ts",
    "src/lib/social/providers/twitch-token.ts",
    "src/app/api/social/callback/twitch/route.ts",
    "src/app/api/social/callback/twitch/handoff/route.ts",
    "src/lib/social/connections/twitch-dashboard-resolve.ts",
    "src/components/social/platforms/twitch-connect-page.tsx",
    "prisma/migrations/20261001050000_twitch_account_uniqueness/migration.sql",
  ];
  for (const file of files) {
    assert(existsSync(resolve(process.cwd(), file)), file);
  }
  const oauth = readSource("src/lib/social/providers/twitch-oauth.ts");
  assert(oauth.includes("id.twitch.tv"), "twitch host");
  assert(oauth.includes("oauth2/authorize"), "authorize path");
  assert(oauth.includes("code_challenge"), "pkce challenge");
  assert(oauth.includes("code_challenge_method"), "s256");
  const token = readSource("src/lib/social/providers/twitch-token.ts");
  assert(token.includes("id.twitch.tv"), "token host");
  assert(token.includes("oauth2/token"), "token path");
  assert(token.includes("helix/users"), "user info");
  assert(token.includes("code_verifier"), "pkce verifier");
  assert(token.includes("Client-Id"), "helix client id");
  return "direct Twitch login routes";
});

check("Twitch page starts independent OAuth", () => {
  const page = readSource(
    "src/components/social/platforms/twitch-connect-page.tsx",
  );
  assert(page.includes('provider: "twitch"'), "independent start");
  assert(page.includes("Connect Twitch"), "connect CTA");
  const start = readSource(
    "src/lib/social/connections/social-connection-service.ts",
  );
  assert(start.includes("buildTwitchAuthorizationUrl"), "authorization builder");
  return "independent Twitch login";
});

check("Uniqueness migration exists", () => {
  const path =
    "prisma/migrations/20261001050000_twitch_account_uniqueness/migration.sql";
  assert(existsSync(resolve(process.cwd(), path)), "file");
  const sql = readSource(path);
  assert(
    sql.includes("sa_one_connected_twitch_account_per_client_key"),
    "client",
  );
  assert(sql.includes("sa_one_connected_twitch_per_connection_key"), "connection");
  return "partial unique indexes";
});

const failed = results.filter((row) => row.status === "FAIL");

for (const row of results) {
  console.log(`${row.status}  ${row.name} — ${row.evidence}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} Twitch connection check(s) failed.`);
  process.exit(1);
}

console.log(`\n${results.length} Twitch connection checks passed.`);
