/**
 * YouTube / Google connection tests.
 * Source and mapping checks only. Never prints tokens, codes, or IDs.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  pickSelectedYoutubeAccountStrict,
} from "../src/lib/social/connections/social-canonical-identity";
import {
  GOOGLE_OAUTH_CALLBACK_PATH,
  GOOGLE_OAUTH_START_SCOPES,
  GOOGLE_OAUTH_YOUTUBE_SCOPES,
} from "../src/lib/social/providers/google-oauth";
import { SOCIAL_PROVIDER_REGISTRY } from "../src/lib/social/providers/registry";

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches `key: "value"`, `key: 'value'` or `key: \`value\`` so a source
 * check does not depend on the file's quote style.
 */
function quotedProperty(key: string, value: string): RegExp {
  return new RegExp(
    escapeRegExp(key) + ":\\s*([\"'`])" + escapeRegExp(value) + "\\1",
  );
}

check("Google provider is implemented for YouTube", () => {
  const google = SOCIAL_PROVIDER_REGISTRY.google;
  assert(google.implemented === true, "implemented");
  assert(google.connectable === true, "connectable");
  assert(google.platforms.includes("youtube"), "youtube platform");
  // Google Business Profile has its own provider (own card, own OAuth
  // purpose); it is no longer a second platform of the YouTube provider.
  const googleBusiness = SOCIAL_PROVIDER_REGISTRY.google_business;
  assert(
    googleBusiness.platforms.includes("google_business") &&
      googleBusiness.implemented === true,
    "gbp platform kept",
  );
  assert(google.authorizationType === "oauth2_pkce", "pkce");
  return "google ready_for_authorization when env is set";
});

check("YouTube start scopes do not include Business Profile", () => {
  assert(
    GOOGLE_OAUTH_START_SCOPES.includes(
      "https://www.googleapis.com/auth/youtube.readonly",
    ),
    "youtube.readonly",
  );
  assert(
    GOOGLE_OAUTH_YOUTUBE_SCOPES.includes(
      "https://www.googleapis.com/auth/yt-analytics-monetary.readonly",
    ),
    "yt-analytics-monetary.readonly",
  );
  assert(
    !GOOGLE_OAUTH_START_SCOPES.some((scope) =>
      scope.includes("business.manage"),
    ),
    "business.manage must wait for GBP approval",
  );
  return "YouTube scopes only";
});

check("Google callback path matches the registered redirect", () => {
  assert(
    GOOGLE_OAUTH_CALLBACK_PATH === "/api/social/callback/google",
    "callback path",
  );
  return GOOGLE_OAUTH_CALLBACK_PATH;
});

check("Google OAuth and callback files exist", () => {
  const files = [
    "src/lib/social/providers/google-oauth.ts",
    "src/lib/social/providers/google-token.ts",
    "src/lib/social/providers/google-youtube.ts",
    "src/lib/social/connections/google-oauth-callback.ts",
    "src/app/api/social/callback/google/route.ts",
    "src/app/api/social/callback/google/handoff/route.ts",
    "src/app/api/social/connections/[connectionId]/youtube/route.ts",
    "src/components/social/platforms/youtube-connect-page.tsx",
  ];
  for (const file of files) {
    assert(existsSync(resolve(process.cwd(), file)), file);
  }
  return `${files.length} files`;
});

check("Start OAuth builds a Google authorization URL", () => {
  const source = readSource(
    "src/lib/social/connections/social-connection-service.ts",
  );
  assert(source.includes("buildGoogleAuthorizationUrl"), "builder wired");
  assert(source.includes('options.provider === "google"'), "google branch");
  return "google start wired";
});

check("Manage connections keeps YouTube primary and GBP on its own card", () => {
  const source = readSource(
    "src/components/social/connections/manage-connections-modal.tsx",
  );
  assert(quotedProperty("google", "youtube").test(source), "youtube is primary google card");
  assert(source.includes("planned: true"), "planned cards exist");
  // GBP used to be a planned card; it is now connected with its own
  // google_business provider.
  const gbpAt = source.search(quotedProperty("key", "google-business"));
  assert(gbpAt >= 0, "gbp card");
  const gbpCard = source.slice(gbpAt, source.indexOf("}", gbpAt));
  assert(quotedProperty("provider", "google_business").test(gbpCard), "gbp provider");
  assert(!/planned:\s*true/.test(gbpCard), "gbp card is connectable");
  return "YouTube connects; GBP has its own card";
});

check("YouTube uniqueness migration exists", () => {
  const file =
    "prisma/migrations/20260828000000_youtube_channel_uniqueness/migration.sql";
  assert(existsSync(resolve(process.cwd(), file)), file);
  const sql = readSource(file);
  assert(sql.includes("sa_one_connected_youtube_channel_per_client_key"), "client");
  assert(sql.includes("sa_one_connected_youtube_per_connection_key"), "connection");
  return "youtube uniqueness";
});

check("Canonical YouTube picker is strict", () => {
  const ready = pickSelectedYoutubeAccountStrict([
    {
      id: "a",
      platform: "youtube",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
  ], "c1");
  assert(ready.kind === "ready", "one selected");

  const ambiguous = pickSelectedYoutubeAccountStrict([
    {
      id: "a",
      platform: "youtube",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
    {
      id: "b",
      platform: "youtube",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
  ], "c1");
  assert(ambiguous.kind === "ambiguous", "two selected");
  return "strict youtube identity";
});

check("Google token exchange uses PKCE verifier", () => {
  const source = readSource("src/lib/social/providers/google-token.ts");
  assert(source.includes("code_verifier"), "pkce verifier");
  assert(source.includes("refresh_token"), "refresh token stored");
  assert(source.includes("openidconnect.googleapis.com"), "userinfo");
  return "offline Google token";
});

const failed = results.filter((row) => row.status === "FAIL");
for (const row of results) {
  console.log(`${row.status}  ${row.name}  ${row.evidence}`);
}

if (failed.length > 0) {
  process.exit(1);
}
