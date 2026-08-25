/**
 * Isolated verification for social connection subscription policy +
 * production-proof development bypass.
 *
 * Does not invent paid status. Does not accept browser preview values.
 */

import {
  evaluateClientSocialConnectionAccess,
  isProductionSocialRuntime,
  isTrustedSocialConnectionDevBypassEnabled,
} from "../src/lib/billing/client-subscription-access-policy";

type Row = { name: string; ok: boolean; detail: string };

const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name}: ${detail}`);
  }
}

function main() {
  check(
    "active subscription allowed without bypass",
    evaluateClientSocialConnectionAccess({
      status: "active",
      developmentBypass: false,
      nodeEnv: "production",
      vercelEnv: "production",
      serverDevBypassFlag: null,
    }).allowed === true,
    "active must remain allowed in production",
  );

  check(
    "trial subscription allowed without bypass",
    evaluateClientSocialConnectionAccess({
      status: "trial",
      developmentBypass: false,
      nodeEnv: "production",
      vercelEnv: "production",
      serverDevBypassFlag: null,
    }).via === "subscription",
    "trial must use subscription path",
  );

  for (const status of ["past_due", "canceled", "expired"] as const) {
    check(
      `${status} denied in production even with DB+env bypass`,
      evaluateClientSocialConnectionAccess({
        status,
        developmentBypass: true,
        nodeEnv: "production",
        vercelEnv: "production",
        serverDevBypassFlag: "true",
      }).allowed === false,
      "production must ignore trusted bypass flags",
    );
  }

  check(
    "NODE_ENV=production blocks bypass",
    evaluateClientSocialConnectionAccess({
      status: "expired",
      developmentBypass: true,
      nodeEnv: "production",
      vercelEnv: "preview",
      serverDevBypassFlag: "true",
    }).allowed === false,
    "NODE_ENV production alone must deny",
  );

  check(
    "VERCEL_ENV=production blocks bypass",
    evaluateClientSocialConnectionAccess({
      status: "expired",
      developmentBypass: true,
      nodeEnv: "development",
      vercelEnv: "production",
      serverDevBypassFlag: "true",
    }).allowed === false,
    "VERCEL_ENV production alone must deny",
  );

  check(
    "isProductionSocialRuntime covers both signals",
    isProductionSocialRuntime("production", null) &&
      isProductionSocialRuntime("development", "production") &&
      !isProductionSocialRuntime("development", "preview"),
    "runtime helper mismatch",
  );

  check(
    "non-production runtime allows OAuth without paid status",
    evaluateClientSocialConnectionAccess({
      status: "expired",
      developmentBypass: false,
      nodeEnv: "development",
      vercelEnv: null,
      serverDevBypassFlag: null,
    }).via === "trusted_dev_bypass",
    "server NODE_ENV is the trusted signal (not ?preview=)",
  );

  check(
    "browser preview is not an access input",
    !isTrustedSocialConnectionDevBypassEnabled({
      developmentBypass: false,
      nodeEnv: "production",
      vercelEnv: "production",
      serverDevBypassFlag: null,
    }),
    "production cannot be unlocked by any client preview value",
  );

  check(
    "SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION forces checks in non-prod",
    evaluateClientSocialConnectionAccess({
      status: "expired",
      developmentBypass: false,
      nodeEnv: "development",
      vercelEnv: null,
      serverDevBypassFlag: null,
      requireSubscriptionFlag: "true",
    }).allowed === false,
    "require flag must deny expired without explicit bypass",
  );

  // Direct require-flag check on trusted helper
  check(
    "require-subscription flag disables default non-prod bypass",
    !isTrustedSocialConnectionDevBypassEnabled({
      developmentBypass: false,
      nodeEnv: "development",
      vercelEnv: null,
      serverDevBypassFlag: null,
      requireSubscriptionFlag: "true",
    }),
    "SOCIAL_CONNECTION_REQUIRE_SUBSCRIPTION=true must require real subscription or explicit bypass",
  );

  check(
    "explicit DB bypass still works when require-subscription is on",
    isTrustedSocialConnectionDevBypassEnabled({
      developmentBypass: true,
      nodeEnv: "development",
      vercelEnv: null,
      serverDevBypassFlag: null,
      requireSubscriptionFlag: "true",
    }),
    "DB developmentBypass should still unlock outside production",
  );

  console.log("Social connection access policy verification");
  console.log("===========================================");
  for (const row of rows) {
    console.log(`${row.ok ? "PASS" : "FAIL"}  ${row.name}`);
    console.log(`      ${row.detail}`);
  }
  console.log("");
  console.log(
    `Result: ${rows.every((r) => r.ok) ? "ALL PASS" : "FAILED"} (${rows.length} checks)`,
  );
}

try {
  main();
} catch (error) {
  console.error(
    "FAIL",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
