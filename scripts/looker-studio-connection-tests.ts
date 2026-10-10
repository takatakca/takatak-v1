/**
 * Looker Studio connection tests.
 * Synthetic payloads only. Never prints tokens, codes, or report ids.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { billingNetworkForConnectionProvider } from "../src/lib/billing/social/entitlement-gates-policy";
import { pickSelectedLookerStudioAccountStrict } from "../src/lib/social/connections/social-canonical-identity";
import {
  orderSidebarAccounts,
  supplementalSidebarAccounts,
} from "../src/lib/social/connections/social-sidebar-accounts";
import {
  assertLookerStudioReadScope,
  lookerStudioReportUrl,
  mapLookerStudioAssetFromRecord,
  parseLookerStudioAssetId,
} from "../src/lib/social/providers/looker-studio-accounts";
import {
  LOOKER_STUDIO_OAUTH_CALLBACK_PATH,
  LOOKER_STUDIO_OAUTH_SCOPE,
  LOOKER_STUDIO_OAUTH_START_SCOPES,
} from "../src/lib/social/providers/looker-studio-oauth";
import {
  GOOGLE_ADS_OAUTH_SCOPE,
  GOOGLE_ADS_OAUTH_START_SCOPES,
} from "../src/lib/social/providers/google-ads-oauth";
import {
  GOOGLE_OAUTH_BUSINESS_SCOPES,
  GOOGLE_OAUTH_CALLBACK_PATH,
  GOOGLE_OAUTH_YOUTUBE_SCOPES,
} from "../src/lib/social/providers/google-oauth";

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

check("OAuth start requests Looker Studio read access only", () => {
  assert(
    (LOOKER_STUDIO_OAUTH_START_SCOPES as readonly string[]).includes(
      LOOKER_STUDIO_OAUTH_SCOPE,
    ),
    "readonly scope",
  );
  const blocked = [
    ...GOOGLE_OAUTH_YOUTUBE_SCOPES.filter(
      (scope) => scope !== "openid" && scope !== "email" && scope !== "profile",
    ),
    ...GOOGLE_OAUTH_BUSINESS_SCOPES.filter(
      (scope) => scope !== "openid" && scope !== "email" && scope !== "profile",
    ),
    GOOGLE_ADS_OAUTH_SCOPE,
    "https://www.googleapis.com/auth/datastudio",
  ];
  for (const scope of blocked) {
    assert(
      !(LOOKER_STUDIO_OAUTH_START_SCOPES as readonly string[]).includes(scope),
      scope,
    );
  }
  assert(
    !(GOOGLE_ADS_OAUTH_START_SCOPES as readonly string[]).includes(
      LOOKER_STUDIO_OAUTH_SCOPE,
    ),
    "ads start stays off looker",
  );
  assert(
    LOOKER_STUDIO_OAUTH_CALLBACK_PATH === "/api/social/callback/looker-studio",
    "looker callback",
  );
  assert(
    GOOGLE_OAUTH_CALLBACK_PATH === "/api/social/callback/google",
    "youtube callback",
  );
  assert(
    billingNetworkForConnectionProvider("looker_studio") === "youtube",
    "billing network",
  );
  return "readonly Looker scope only; YouTube, Business Profile, and Ads stay separate";
});

check("Mapper keeps reports and drops trash, data sources, and bad ids", () => {
  const mapped = mapLookerStudioAssetFromRecord({
    name: "assets/Abcd1234_report",
    title: "Weekly social",
    assetType: "REPORT",
    owner: "owner@example.com",
    trashed: false,
  });
  assert(mapped?.displayName === "Weekly social", "name");
  assert(mapped?.owner === "owner@example.com", "owner");
  assert(mapped?.externalAccountId === "Abcd1234_report", "id");
  assert(
    mapped?.reportUrl ===
      "https://lookerstudio.google.com/reporting/Abcd1234_report",
    "url",
  );

  const trashed = mapLookerStudioAssetFromRecord({
    name: "Abcd1234_report",
    title: "Trash",
    assetType: "REPORT",
    trashed: true,
  });
  assert(trashed === null, "trashed");

  const source = mapLookerStudioAssetFromRecord({
    name: "Abcd1234_source",
    title: "Source",
    assetType: "DATA_SOURCE",
  });
  assert(source === null, "data source");

  const foreign = mapLookerStudioAssetFromRecord({
    name: "../etc/passwd",
    title: "Nope",
    assetType: "REPORT",
  });
  assert(foreign === null, "bad id");
  assert(parseLookerStudioAssetId("assets/Abcd1234") === "Abcd1234", "strip");
  assert(lookerStudioReportUrl("not id") === null, "bad url");

  const unnamed = mapLookerStudioAssetFromRecord({
    name: "Abcd1234",
    title: "   ",
    assetType: "REPORT",
    owner: "not-an-email",
  });
  assert(unnamed?.displayName === "Looker Studio report", "fallback name");
  assert(unnamed?.owner === "Google account", "fallback owner");
  return "reports map to a Looker Studio URL; trash, data sources, and malformed ids are dropped";
});

check("Missing Looker Studio scope is rejected", () => {
  let rejected = false;
  try {
    assertLookerStudioReadScope(["openid", "email"]);
  } catch {
    rejected = true;
  }
  assert(rejected, "missing datastudio");
  assertLookerStudioReadScope([LOOKER_STUDIO_OAUTH_SCOPE]);
  assertLookerStudioReadScope([
    "https://www.googleapis.com/auth/datastudio",
  ]);
  return "a Looker Studio read scope is required before reports are stored";
});

check("Selected Looker Studio picker is strict", () => {
  const ready = pickSelectedLookerStudioAccountStrict([
    {
      id: "a",
      platform: "looker_studio",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
  ]);
  assert(ready.kind === "ready", "ready");

  const pending = pickSelectedLookerStudioAccountStrict([
    {
      id: "a",
      platform: "looker_studio",
      status: "pending_connection",
      accessStatus: "available",
      providerConnectionId: "c1",
    },
  ]);
  assert(pending.kind === "missing", "pending is not connected");

  const ambiguous = pickSelectedLookerStudioAccountStrict([
    {
      id: "a",
      platform: "looker_studio",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
    {
      id: "b",
      platform: "looker_studio",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
  ]);
  assert(ambiguous.kind === "ambiguous", "ambiguous");
  return "one selected report is ready; pending and duplicates are not";
});

check("Token exchange uses the Looker Studio redirect and report search host", () => {
  const source = readSource("src/lib/social/providers/looker-studio-accounts.ts");
  const oauth = readSource("src/lib/social/providers/looker-studio-oauth.ts");
  assert(source.includes("getLookerStudioOAuthRedirectUri"), "looker redirect");
  assert(
    !source.includes("getGoogleOAuthRedirectUri"),
    "youtube redirect must stay off this exchange",
  );
  assert(
    !source.includes("getGoogleAdsOAuthRedirectUri"),
    "ads redirect must stay off this exchange",
  );
  assert(oauth.includes("datastudio.googleapis.com"), "report search host");
  assert(source.includes("LOOKER_STUDIO_API_HOST"), "search uses that host");
  assert(source.includes("assetTypes"), "report search");
  assert(!source.includes("DATA_SOURCE"), "reports only");
  assert(oauth.includes("include_granted_scopes") === false, "no incremental scopes");
  assert(!oauth.includes(GOOGLE_ADS_OAUTH_SCOPE), "no ads scope");
  assert(!source.includes("console.log"), "no console log");
  assert(!oauth.includes("console.log"), "no oauth console log");
  const migration = readSource(
    "prisma/migrations/20261001110000_looker_studio_uniqueness/migration.sql",
  );
  assert(
    migration.includes("sa_one_connected_looker_studio_report_per_client_key"),
    "client uniqueness",
  );
  assert(
    migration.includes("sa_one_connected_looker_studio_per_connection_key"),
    "connection uniqueness",
  );
  return "code exchange uses the Looker Studio callback and lists reports only";
});

check("A live connection is listed and a disconnect is removed", () => {
  const rows = supplementalSidebarAccounts(
    [
      {
        id: "conn-looker",
        status: "authorized",
        displayName: "Reports",
        platforms: ["looker_studio"],
      },
      {
        id: "conn-business",
        status: "connected",
        displayName: "Shop",
        platforms: ["google_business"],
      },
      {
        id: "conn-pending",
        status: "pending_authorization",
        displayName: null,
        platforms: ["google_ads"],
      },
      {
        id: "conn-gone",
        status: "disconnected",
        displayName: "Old report",
        platforms: ["web"],
      },
      {
        id: "conn-cleared",
        status: "not_connected",
        displayName: "Blog",
        platforms: ["blog"],
      },
    ],
    new Set(["twitch"]),
  );
  const platforms = rows.map((row) => row.platform);
  assert(platforms.includes("looker_studio"), "authorized looker");
  assert(platforms.includes("google_business"), "connected business profile");
  assert(!platforms.includes("google_ads"), "pending stays hidden");
  assert(!platforms.includes("web"), "disconnect removes the row");
  assert(!platforms.includes("blog"), "not connected stays hidden");
  assert(!platforms.includes("twitch"), "existing row is not duplicated");

  const ordered = orderSidebarAccounts(
    [
      { platform: "looker_studio" },
      { platform: "instagram" },
      { platform: "twitch" },
    ],
    ["instagram", "facebook", "tiktok", "youtube", "linkedin"],
  );
  assert(ordered[0]?.platform === "instagram", "starter stays first");
  assert(ordered[1]?.platform === "looker_studio", "other networks follow");
  return "every live network is listed once; disconnect and pending are omitted";
});

const failed = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status} ${result.name} — ${result.evidence}`);
}
if (failed.length > 0) {
  process.exit(1);
}
