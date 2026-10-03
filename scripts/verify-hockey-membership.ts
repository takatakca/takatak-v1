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
import {
  interpretHockeyStripeSubscription,
  mapHockeyStripeStatus,
} from "../src/lib/billing/hockey/stripe-webhook-policy";

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
  "smart_departure",
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


assert.equal(mapHockeyStripeStatus("active"), "active");
assert.equal(mapHockeyStripeStatus("past_due"), "past_due");
assert.equal(mapHockeyStripeStatus("trialing"), "skip");
assert.equal(mapHockeyStripeStatus("incomplete"), "skip");
assert.equal(mapHockeyStripeStatus("unpaid"), "expired");

const webhookDecision = interpretHockeyStripeSubscription(
  {
    id: "sub_hockey_test",
    status: "active",
    customer: "cus_hockey_test",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: "price_hockey_member_test" },
          current_period_start: 1_800_000_000,
          current_period_end: 1_800_604_800,
        },
      ],
    },
    metadata: {
      billingDomain: "hockey_membership",
      planCode: "hockey_member_weekly_10",
    },
  },
  {
    price_hockey_member_test: {
      planCode: "hockey_member_weekly_10",
    },
  },
);
assert.equal(webhookDecision.action, "apply");
if (webhookDecision.action === "apply") {
  assert.equal(webhookDecision.patch.status, "active");
  assert.equal(webhookDecision.patch.planCode, "hockey_member_weekly_10");
  assert.equal(webhookDecision.patch.planName, "AHMV Member");
  assert.equal(webhookDecision.patch.externalCustomerId, "cus_hockey_test");
  assert.equal(webhookDecision.patch.externalSubscriptionId, "sub_hockey_test");
}

const vipWebhookDecision = interpretHockeyStripeSubscription(
  {
    id: "sub_vip_test",
    status: "active",
    customer: "cus_vip_test",
    items: { data: [{ price: { id: "price_vip_test" } }] },
    metadata: { planCode: "hockey_vip_weekly_30" },
  },
  {},
);
assert.equal(vipWebhookDecision.action, "skip");
