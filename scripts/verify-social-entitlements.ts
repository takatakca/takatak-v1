/**
 * Isolated checks for the Social plan catalog and entitlement calculator.
 * No database. No Stripe. Exit 1 on mismatch.
 */

import {
  canConnectSocialNetwork,
  isUnlimitedPublishing,
  resolveSocialEntitlements,
} from "../src/lib/billing/social/entitlements";
import {
  SOCIAL_FREE_PLAN_CODE,
  SOCIAL_PLAN_CATALOG,
  isSocialPlanCode,
  starterPlanHighlights,
} from "../src/lib/billing/social/plan-catalog";
import { SOCIAL_PLAN_CODES } from "../src/lib/billing/social/types";

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
    "catalog covers every plan code",
    SOCIAL_PLAN_CODES.every((code) => Boolean(SOCIAL_PLAN_CATALOG[code])),
    "a plan code is missing from the catalog",
  );

  const free = resolveSocialEntitlements({});
  check(
    "missing planCode is Free",
    free.planCode === SOCIAL_FREE_PLAN_CODE && free.brandAllowance === 1,
    `got ${free.planCode} brands=${free.brandAllowance}`,
  );

  check(
    "unknown planCode is Free",
    resolveSocialEntitlements({ planCode: "not-a-plan" }).planCode ===
      SOCIAL_FREE_PLAN_CODE,
    "unknown codes must not invent a paid plan",
  );

  check(
    "Free posts and analytics window",
    free.monthlyPostAllowance === 20 && free.analyticsHistoryDays === 30,
    "Free must cap posts and history",
  );

  check(
    "Free cannot use LinkedIn or X",
    !canConnectSocialNetwork(free, "linkedin") &&
      !canConnectSocialNetwork(free, "x"),
    "LinkedIn and X are paid",
  );

  check(
    "Free can use Facebook",
    canConnectSocialNetwork(free, "facebook"),
    "Facebook belongs on Free",
  );

  check(
    "Free ignores X add-on",
    resolveSocialEntitlements({
      planCode: "social_free",
      addOns: { xAccountAllowance: 3, advancedAnalytics: true },
    }).xConnectionAllowance === 0 &&
      resolveSocialEntitlements({
        planCode: "social_free",
        addOns: { advancedAnalytics: true },
      }).advancedAnalytics === false,
    "add-ons must not apply on Free",
  );

  const starter = resolveSocialEntitlements({ planCode: "social_starter_5" });
  check(
    "Starter 5 allowance and LinkedIn",
    starter.brandAllowance === 5 &&
      canConnectSocialNetwork(starter, "linkedin") &&
      !canConnectSocialNetwork(starter, "x") &&
      isUnlimitedPublishing(starter) &&
      starter.teamManagement === false,
    "Starter is multi-brand, LinkedIn, no teams, no X until add-on",
  );

  const starterWithX = resolveSocialEntitlements({
    planCode: "social_starter_5",
    addOns: { xAccountAllowance: 2 },
  });
  check(
    "Starter X add-on unlocks X",
    canConnectSocialNetwork(starterWithX, "x") &&
      starterWithX.xConnectionAllowance === 2,
    "X is an add-on on Starter+",
  );

  const advanced = resolveSocialEntitlements({
    planCode: "social_advanced_25",
    addOns: { advancedAnalytics: true },
  });
  check(
    "Advanced 25 teams API analytics",
    advanced.brandAllowance === 25 &&
      advanced.teamManagement === true &&
      advanced.apiAccess === true &&
      advanced.advancedAnalytics === true,
    "Advanced includes teams and API; analytics add-on applies",
  );

  check(
    "Custom brand override only when 50+",
    resolveSocialEntitlements({
      planCode: "social_custom",
      customBrandAllowance: 80,
    }).brandAllowance === 80 &&
      resolveSocialEntitlements({
        planCode: "social_custom",
        customBrandAllowance: 10,
      }).brandAllowance === 50 &&
      resolveSocialEntitlements({
        planCode: "social_starter_5",
        customBrandAllowance: 80,
      }).brandAllowance === 5,
    "customBrandAllowance must not raise Starter or shrink Custom below 50",
  );

  check(
    "isSocialPlanCode",
    isSocialPlanCode("social_free") && !isSocialPlanCode("free"),
    "only catalog codes are valid",
  );

  const starterHighlights = starterPlanHighlights();
  check(
    "Starter highlights stay on catalog features",
    starterHighlights.includes("Unlimited monthly publications") &&
      starterHighlights.includes("LinkedIn connection") &&
      !starterHighlights.some((item) => /canva|google drive|whitelabel/i.test(item)),
    "pricing cards must not copy third-party features we do not sell",
  );

  console.log("Social entitlement catalog verification");
  console.log("======================================");
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
  console.error("FAIL", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
