/**
 * Isolated checks for Social entitlement gates (networks, posts,
 * analytics window, competitors, teams, API). No database. No Stripe.
 */

import { resolveSocialEntitlements } from "../src/lib/billing/social/entitlements";
import {
  analyticsHistoryCutoffDate,
  billingNetworkForConnectionProvider,
  clipAnalyticsDateRange,
  evaluateAddCompetitor,
  evaluateApiAccess,
  evaluateApprovals,
  evaluateCustomRoles,
  evaluateReports,
  evaluateSchedulePost,
  evaluateSocialNetworkConnect,
  evaluateTeamInvite,
  evaluateWorkspaceWriteAccess,
} from "../src/lib/billing/social/entitlement-gates-policy";

type Row = { name: string; ok: boolean; detail: string };

const rows: Row[] = [];

function check(name: string, ok: boolean, detail: string) {
  rows.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`${name}: ${detail}`);
  }
}

function main() {
  const free = resolveSocialEntitlements({ planCode: "social_free" });
  const starter = resolveSocialEntitlements({ planCode: "social_starter_5" });
  const starterX = resolveSocialEntitlements({
    planCode: "social_starter_5",
    addOns: { xAccountAllowance: 1 },
  });
  const advanced = resolveSocialEntitlements({
    planCode: "social_advanced_15",
  });

  check(
    "meta maps to facebook",
    billingNetworkForConnectionProvider("meta") === "facebook",
    "Facebook Login is billed as facebook",
  );

  check(
    "google maps to youtube",
    billingNetworkForConnectionProvider("google") === "youtube",
    "Google OAuth is billed as youtube (GBP is the same Free/paid family)",
  );

  check(
    "Free can connect Facebook",
    evaluateSocialNetworkConnect({
      provider: "meta",
      entitlements: free,
      connectedXCount: 0,
    }).allowed,
    "Free includes Facebook",
  );

  check(
    "Free can connect Google / YouTube",
    evaluateSocialNetworkConnect({
      provider: "google",
      entitlements: free,
      connectedXCount: 0,
    }).allowed,
    "YouTube is on Free",
  );

  check(
    "Free cannot connect LinkedIn",
    !evaluateSocialNetworkConnect({
      provider: "linkedin",
      entitlements: free,
      connectedXCount: 0,
    }).allowed,
    "LinkedIn is Starter+",
  );

  check(
    "Free cannot connect X",
    !evaluateSocialNetworkConnect({
      provider: "x",
      entitlements: free,
      connectedXCount: 0,
    }).allowed,
    "X is an add-on on Starter+",
  );

  check(
    "Starter can connect LinkedIn",
    evaluateSocialNetworkConnect({
      provider: "linkedin",
      entitlements: starter,
      connectedXCount: 0,
    }).allowed,
    "Starter includes LinkedIn",
  );

  check(
    "Starter cannot connect X without add-on",
    !evaluateSocialNetworkConnect({
      provider: "x",
      entitlements: starter,
      connectedXCount: 0,
    }).allowed,
    "X needs a paid slot",
  );

  check(
    "Starter X add-on allows the first slot",
    evaluateSocialNetworkConnect({
      provider: "x",
      entitlements: starterX,
      connectedXCount: 0,
    }).allowed,
    "one paid X slot should connect",
  );

  check(
    "Starter X add-on denies a second new connection",
    !evaluateSocialNetworkConnect({
      provider: "x",
      entitlements: starterX,
      connectedXCount: 1,
    }).allowed,
    "slot cap must block another X account",
  );

  check(
    "X reconnect does not consume an extra slot",
    evaluateSocialNetworkConnect({
      provider: "x",
      entitlements: starterX,
      connectedXCount: 1,
      reconnect: true,
    }).allowed,
    "reauthorization_required is not a billing error",
  );

  check(
    "unknown provider is denied",
    !evaluateSocialNetworkConnect({
      provider: "not-a-network",
      entitlements: advanced,
      connectedXCount: 0,
    }).allowed,
    "unknown providers must not slip through",
  );

  check(
    "Free allows 20 posts then blocks",
    evaluateSchedulePost({ entitlements: free, usedThisMonth: 19 }).allowed &&
      !evaluateSchedulePost({ entitlements: free, usedThisMonth: 20 }).allowed,
    "the 21st post in the month must be refused",
  );

  check(
    "Starter publishing is unlimited",
    evaluateSchedulePost({ entitlements: starter, usedThisMonth: 500 }).allowed,
    "null monthly cap is fair use",
  );

  const cutoff = analyticsHistoryCutoffDate(30, new Date("2026-08-29T12:00:00.000Z"));
  check(
    "Free analytics window is 30 days",
    cutoff === "2026-07-31",
    `expected 2026-07-31, got ${cutoff}`,
  );

  const clipped = clipAnalyticsDateRange(
    {
      start: "2026-06-01",
      end: "2026-08-28",
      compareStart: "2026-03-01",
      compareEnd: "2026-05-31",
    },
    30,
    new Date("2026-08-29T12:00:00.000Z"),
  );
  check(
    "last_90 clips to 30 days on Free",
    clipped.clipped &&
      clipped.start === "2026-07-31" &&
      clipped.compareStart === null &&
      clipped.compareEnd === null,
    "older compare ranges must drop when they sit before the cutoff",
  );

  check(
    "paid analytics are not clipped",
    !clipAnalyticsDateRange(
      {
        start: "2026-06-01",
        end: "2026-08-28",
        compareStart: null,
        compareEnd: null,
      },
      null,
    ).clipped,
    "Starter/Advanced history is unrestricted",
  );

  check(
    "Free competitor cap is 5",
    evaluateAddCompetitor({ entitlements: free, activeCount: 4 }).allowed &&
      !evaluateAddCompetitor({ entitlements: free, activeCount: 5 }).allowed,
    "the 6th competitor on Free must be refused",
  );

  check(
    "blocked workspaces cannot write",
    !evaluateWorkspaceWriteAccess("blocked").allowed &&
      evaluateWorkspaceWriteAccess("free").allowed &&
      evaluateWorkspaceWriteAccess("paid").allowed,
    "suspended/incomplete/paused stay locked",
  );

  check(
    "Free locks teams, roles, approvals, API, reports",
    !evaluateTeamInvite(free).allowed &&
      !evaluateCustomRoles(free).allowed &&
      !evaluateApprovals(free).allowed &&
      !evaluateApiAccess(free).allowed &&
      !evaluateReports(free).allowed,
    "Free is a single-user plan",
  );

  check(
    "Starter reports without teams",
    evaluateReports(starter).allowed &&
      !evaluateTeamInvite(starter).allowed &&
      !evaluateCustomRoles(starter).allowed &&
      !evaluateApprovals(starter).allowed &&
      !evaluateApiAccess(starter).allowed,
    "Starter has reports; Advanced has teams/API",
  );

  check(
    "Advanced unlocks teams, approvals, API",
    evaluateTeamInvite(advanced).allowed &&
      evaluateCustomRoles(advanced).allowed &&
      evaluateApprovals(advanced).allowed &&
      evaluateApiAccess(advanced).allowed,
    "Advanced includes collaboration and API",
  );

  console.log("Social entitlement gate verification");
  console.log("====================================");
  for (const row of rows) {
    console.log(`PASS  ${row.name}`);
    console.log(`      ${row.detail}`);
  }
  console.log("");
  console.log(`Result: ALL PASS (${rows.length} checks)`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
