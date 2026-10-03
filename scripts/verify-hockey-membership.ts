import assert from "node:assert/strict";

import {
  HOCKEY_MEMBERSHIP_CATALOG,
  isHockeySelfServePlanCode,
} from "../src/lib/billing/hockey/plan-catalog";
import {
  hockeyMembershipAllows,
  hockeyStripePriceEnvKey,
  resolveHockeyCheckoutLive,
  resolveHockeyMembershipAccess,
  validateHockeyCheckoutInput,
} from "../src/lib/billing/hockey/membership-policy";

const member = HOCKEY_MEMBERSHIP_CATALOG.hockey_member_weekly_10;
const vip = HOCKEY_MEMBERSHIP_CATALOG.hockey_vip_weekly_30;

assert.equal(member.displayWeeklyCad, 10);
assert.equal(member.selfServeEligible, true);
assert.equal(member.launchState, "pilot");
assert.equal(vip.displayWeeklyCad, 30);
assert.equal(vip.selfServeEligible, false);
assert.equal(vip.launchState, "planned");

assert.equal(isHockeySelfServePlanCode("hockey_member_weekly_10"), true);
assert.equal(isHockeySelfServePlanCode("hockey_vip_weekly_30"), false);
assert.equal(
  hockeyStripePriceEnvKey("hockey_member_weekly_10"),
  "STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10",
);

assert.equal(resolveHockeyMembershipAccess("active"), "paid");
assert.equal(resolveHockeyMembershipAccess("past_due"), "paid");
assert.equal(resolveHockeyMembershipAccess("grace_period"), "paid");
assert.equal(resolveHockeyMembershipAccess("incomplete"), "blocked");
assert.equal(resolveHockeyMembershipAccess("canceled"), "blocked");
assert.equal(resolveHockeyMembershipAccess("suspended"), "blocked");

for (const feature of [
  "ad_free",
  "ai_assistant",
  "game_reminders",
  "calendar_sync",
  "team_community",
  "parent_messaging",
  "parent_rideshare",
] as const) {
  assert.equal(
    hockeyMembershipAllows(
      { status: "active", planCode: "hockey_member_weekly_10" },
      feature,
    ),
    true,
  );
}

assert.equal(
  hockeyMembershipAllows(
    { status: "active", planCode: "hockey_member_weekly_10" },
    "tournament_travel",
  ),
  false,
);
assert.equal(
  hockeyMembershipAllows(
    { status: "canceled", planCode: "hockey_member_weekly_10" },
    "ai_assistant",
  ),
  false,
);

assert.equal(
  validateHockeyCheckoutInput({ planCode: "hockey_member_weekly_10" }).success,
  true,
);
const vipCheckout = validateHockeyCheckoutInput({
  planCode: "hockey_vip_weekly_30",
});
assert.equal(vipCheckout.success, false);
if (!vipCheckout.success) {
  assert.match(vipCheckout.fieldErrors.planCode ?? "", /not being sold yet/i);
}

assert.equal(
  resolveHockeyCheckoutLive({
    enabled: false,
    secretKey: "sk_test",
    webhookSecret: "whsec_test",
    priceId: "price_test",
  }),
  false,
);
assert.equal(
  resolveHockeyCheckoutLive({
    enabled: true,
    secretKey: "",
    webhookSecret: "whsec_test",
    priceId: "price_test",
  }),
  false,
);
assert.equal(
  resolveHockeyCheckoutLive({
    enabled: true,
    secretKey: "sk_test",
    webhookSecret: "whsec_test",
    priceId: "price_test",
  }),
  true,
);

console.log("verify-hockey-membership: all checks passed");
