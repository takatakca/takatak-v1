/**
 * Meta Ads connection tests.
 * Synthetic payloads only. Never prints tokens, codes, or account ids.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { billingNetworkForConnectionProvider } from "../src/lib/billing/social/entitlement-gates-policy";
import { pickSelectedMetaAdsAccountStrict } from "../src/lib/social/connections/social-canonical-identity";
import {
  assertMetaAdsReadScope,
  mapMetaAdAccountFromRecord,
} from "../src/lib/social/providers/meta-ads-accounts";
import {
  META_ADS_OAUTH_CALLBACK_PATH,
  META_ADS_OAUTH_START_SCOPES,
} from "../src/lib/social/providers/meta-ads-oauth";
import {
  META_OAUTH_CALLBACK_PATH,
  META_OAUTH_PAGE_SCOPES,
} from "../src/lib/social/providers/meta-oauth";

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

check("OAuth start requests ad read access and not Page publishing", () => {
  assert(
    (META_ADS_OAUTH_START_SCOPES as readonly string[]).includes("ads_read"),
    "ads_read",
  );
  assert(
    (META_ADS_OAUTH_START_SCOPES as readonly string[]).includes(
      "business_management",
    ),
    "business_management",
  );
  const blocked = [
    "ads_management",
    "pages_manage_posts",
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_manage_insights",
  ];
  for (const scope of blocked) {
    assert(
      !(META_ADS_OAUTH_START_SCOPES as readonly string[]).includes(scope),
      scope,
    );
  }
  for (const scope of META_OAUTH_PAGE_SCOPES) {
    if (scope === "public_profile") continue;
    assert(
      !(META_ADS_OAUTH_START_SCOPES as readonly string[]).includes(scope),
      scope,
    );
  }
  assert(
    META_ADS_OAUTH_CALLBACK_PATH === "/api/social/callback/meta-ads",
    "ads callback",
  );
  assert(
    META_OAUTH_CALLBACK_PATH === "/api/social/callback/facebook",
    "page callback",
  );
  assert(
    billingNetworkForConnectionProvider("meta_ads") === "facebook",
    "billing network",
  );
  return "ads_read only; Page publishing stays on the Facebook connection";
});

check("Mapper keeps usable ad accounts and drops closed ones", () => {
  const mapped = mapMetaAdAccountFromRecord({
    id: "act_100",
    name: "Montreal Bakery",
    currency: "CAD",
    timezone_name: "America/Toronto",
    account_status: 1,
  });
  assert(mapped?.displayName === "Montreal Bakery", "name");
  assert(mapped?.currency === "CAD", "currency");
  assert(mapped?.timezone === "America/Toronto", "timezone");
  assert(mapped?.externalAccountId === "act_100", "id");

  const closed = mapMetaAdAccountFromRecord({
    id: "act_100",
    name: "Closed",
    account_status: 101,
  });
  assert(closed === null, "closed");

  const disabled = mapMetaAdAccountFromRecord({
    id: "act_100",
    name: "Disabled",
    account_status: 2,
  });
  assert(disabled === null, "disabled");

  const foreign = mapMetaAdAccountFromRecord({
    id: "not-an-ad-account",
    name: "Nope",
  });
  assert(foreign === null, "bad id");

  const unnamed = mapMetaAdAccountFromRecord({
    id: "act_100",
    name: "act_100",
    currency: "nope",
  });
  assert(unnamed?.displayName === "Meta ad account", "fallback name");
  assert(unnamed?.currency === "CAD", "fallback currency");
  return "active accounts map; closed, disabled, and malformed rows are dropped";
});

check("Missing ads_read is rejected", () => {
  let rejected = false;
  try {
    assertMetaAdsReadScope(["business_management"]);
  } catch {
    rejected = true;
  }
  assert(rejected, "missing ads_read");
  assertMetaAdsReadScope(["ads_read"]);
  return "ads_read is required before ad accounts are stored";
});

check("Selected Meta Ads picker is strict", () => {
  const ready = pickSelectedMetaAdsAccountStrict([
    {
      id: "a",
      platform: "meta_ads",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
  ]);
  assert(ready.kind === "ready", "ready");

  const pending = pickSelectedMetaAdsAccountStrict([
    {
      id: "a",
      platform: "meta_ads",
      status: "pending_connection",
      accessStatus: "available",
      providerConnectionId: "c1",
    },
  ]);
  assert(pending.kind === "missing", "pending is not connected");

  const ambiguous = pickSelectedMetaAdsAccountStrict([
    {
      id: "a",
      platform: "meta_ads",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
    {
      id: "b",
      platform: "meta_ads",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
  ]);
  assert(ambiguous.kind === "ambiguous", "ambiguous");
  return "one selected ad account is ready; pending and duplicates are not";
});

check("Token exchange uses the Meta Ads redirect", () => {
  const source = readSource("src/lib/social/providers/meta-ads-accounts.ts");
  assert(source.includes("getMetaAdsOAuthRedirectUri"), "ads redirect");
  assert(
    !source.includes("getMetaOAuthRedirectUri"),
    "page redirect must stay off this exchange",
  );
  assert(source.includes('Authorization: `Bearer ${accessToken}`'), "bearer");
  assert(!source.includes("console.log"), "no console log");
  return "code exchange uses the Meta Ads callback, not the Facebook Page callback";
});

const failed = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status} ${result.name} — ${result.evidence}`);
}
if (failed.length > 0) {
  process.exit(1);
}
