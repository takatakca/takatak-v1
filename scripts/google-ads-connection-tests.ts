/**
 * Google Ads connection tests.
 * Synthetic payloads only. Never prints tokens, codes, or account ids.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { billingNetworkForConnectionProvider } from "../src/lib/billing/social/entitlement-gates-policy";
import { pickSelectedGoogleAdsAccountStrict } from "../src/lib/social/connections/social-canonical-identity";
import {
  assertGoogleAdsReadScope,
  mapGoogleAdsClientFromRecord,
  mapGoogleAdsCustomerFromRecord,
  selectableGoogleAdAccount,
} from "../src/lib/social/providers/google-ads-accounts";
import {
  GOOGLE_ADS_API_VERSION_DEFAULT,
  GOOGLE_ADS_OAUTH_CALLBACK_PATH,
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

check("OAuth start requests Google Ads read access only", () => {
  assert(
    (GOOGLE_ADS_OAUTH_START_SCOPES as readonly string[]).includes(
      GOOGLE_ADS_OAUTH_SCOPE,
    ),
    "adwords scope",
  );
  const blocked = [
    ...GOOGLE_OAUTH_YOUTUBE_SCOPES.filter(
      (scope) => scope !== "openid" && scope !== "email" && scope !== "profile",
    ),
    ...GOOGLE_OAUTH_BUSINESS_SCOPES.filter(
      (scope) => scope !== "openid" && scope !== "email" && scope !== "profile",
    ),
  ];
  for (const scope of blocked) {
    assert(
      !(GOOGLE_ADS_OAUTH_START_SCOPES as readonly string[]).includes(scope),
      scope,
    );
  }
  assert(
    GOOGLE_ADS_OAUTH_CALLBACK_PATH === "/api/social/callback/google-ads",
    "ads callback",
  );
  assert(
    GOOGLE_OAUTH_CALLBACK_PATH === "/api/social/callback/google",
    "youtube callback",
  );
  assert(GOOGLE_ADS_API_VERSION_DEFAULT === "v23", "api version");
  assert(
    billingNetworkForConnectionProvider("google_ads") === "youtube",
    "billing network",
  );
  return "adwords scope only; YouTube and Business Profile stay on their own connections";
});

check("Mapper keeps enabled ad accounts and drops closed or manager rows", () => {
  const mapped = mapGoogleAdsCustomerFromRecord({
    customer: {
      id: "1234567890",
      descriptiveName: "Montreal Bakery",
      currencyCode: "CAD",
      timeZone: "America/Toronto",
      manager: false,
      status: "ENABLED",
      testAccount: false,
    },
  });
  const selectable = mapped ? selectableGoogleAdAccount(mapped) : null;
  assert(selectable?.displayName === "Montreal Bakery", "name");
  assert(selectable?.currency === "CAD", "currency");
  assert(selectable?.timezone === "America/Toronto", "timezone");
  assert(selectable?.externalAccountId === "1234567890", "id");

  const manager = mapGoogleAdsCustomerFromRecord({
    customer: {
      resourceName: "customers/1234567890",
      descriptiveName: "Agency",
      currencyCode: "USD",
      timeZone: "America/New_York",
      manager: true,
      status: "ENABLED",
    },
  });
  assert(manager?.manager === true, "manager flag");
  assert(selectableGoogleAdAccount(manager!) === null, "manager not selectable");

  const canceled = mapGoogleAdsCustomerFromRecord({
    customer: {
      id: "1234567890",
      descriptiveName: "Closed",
      manager: false,
      status: "CANCELED",
    },
  });
  assert(canceled === null, "canceled");

  const foreign = mapGoogleAdsCustomerFromRecord({
    customer: {
      id: "not-an-account",
      descriptiveName: "Nope",
      manager: false,
      status: "ENABLED",
    },
  });
  assert(foreign === null, "bad id");

  const unnamed = mapGoogleAdsCustomerFromRecord({
    customer: {
      id: "1234567890",
      descriptiveName: "123-456-7890",
      currencyCode: "nope",
      manager: false,
      status: "ENABLED",
    },
  });
  assert(unnamed?.displayName === "Google Ads account", "fallback name");
  assert(unnamed?.currency === "CAD", "fallback currency");
  return "enabled accounts map; canceled, manager, and malformed rows are not selectable";
});

check("Client rows skip hidden, manager, and the manager itself", () => {
  const client = mapGoogleAdsClientFromRecord({
    customerClient: {
      id: "2345678901",
      descriptiveName: "Client shop",
      currencyCode: "CAD",
      timeZone: "America/Toronto",
      manager: false,
      status: "ENABLED",
      hidden: false,
      level: "1",
    },
  });
  assert(client?.displayName === "Client shop", "client");

  const hidden = mapGoogleAdsClientFromRecord({
    customerClient: {
      id: "2345678901",
      descriptiveName: "Hidden",
      manager: false,
      status: "ENABLED",
      hidden: true,
      level: "1",
    },
  });
  assert(hidden === null, "hidden");

  const self = mapGoogleAdsClientFromRecord({
    customerClient: {
      id: "2345678901",
      descriptiveName: "Manager",
      manager: true,
      status: "ENABLED",
      level: "0",
    },
  });
  assert(self === null, "manager level");
  return "direct enabled clients map; hidden and manager rows are dropped";
});

check("Missing Google Ads scope is rejected", () => {
  let rejected = false;
  try {
    assertGoogleAdsReadScope(["openid", "email"]);
  } catch {
    rejected = true;
  }
  assert(rejected, "missing adwords");
  assertGoogleAdsReadScope([GOOGLE_ADS_OAUTH_SCOPE]);
  return "the adwords scope is required before ad accounts are stored";
});

check("Selected Google Ads picker is strict", () => {
  const ready = pickSelectedGoogleAdsAccountStrict([
    {
      id: "a",
      platform: "google_ads",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
  ]);
  assert(ready.kind === "ready", "ready");

  const pending = pickSelectedGoogleAdsAccountStrict([
    {
      id: "a",
      platform: "google_ads",
      status: "pending_connection",
      accessStatus: "available",
      providerConnectionId: "c1",
    },
  ]);
  assert(pending.kind === "missing", "pending is not connected");

  const ambiguous = pickSelectedGoogleAdsAccountStrict([
    {
      id: "a",
      platform: "google_ads",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
    {
      id: "b",
      platform: "google_ads",
      status: "connected",
      accessStatus: "selected",
      providerConnectionId: "c1",
    },
  ]);
  assert(ambiguous.kind === "ambiguous", "ambiguous");
  return "one selected ad account is ready; pending and duplicates are not";
});

check("Token exchange uses the Google Ads redirect and developer token header", () => {
  const source = readSource("src/lib/social/providers/google-ads-accounts.ts");
  const oauth = readSource("src/lib/social/providers/google-ads-oauth.ts");
  assert(source.includes("getGoogleAdsOAuthRedirectUri"), "ads redirect");
  assert(
    !source.includes("getGoogleOAuthRedirectUri"),
    "youtube redirect must stay off this exchange",
  );
  assert(source.includes('"developer-token"'), "developer token header");
  assert(!source.includes("developer-token="), "token stays out of the query");
  assert(source.includes("login-customer-id"), "manager header");
  assert(oauth.includes("include_granted_scopes") === false, "no incremental youtube scopes");
  assert(!source.includes("console.log"), "no console log");
  assert(!oauth.includes("console.log"), "no oauth console log");
  return "code exchange uses the Google Ads callback, and the developer token is a header";
});

const failed = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status} ${result.name} — ${result.evidence}`);
}
if (failed.length > 0) {
  process.exit(1);
}
