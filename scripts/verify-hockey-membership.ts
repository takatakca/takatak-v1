import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  resolveHockeyCheckoutLive,
  resolveHockeyMembershipAccess,
  validateHockeyCheckoutInput,
} from "../src/lib/billing/hockey/membership-policy";
import {
  interpretHockeyStripeSubscription,
  mapHockeyStripeStatus,
} from "../src/lib/billing/hockey/stripe-webhook-policy";

assert.equal(resolveHockeyMembershipAccess("active"), "paid");
assert.equal(resolveHockeyMembershipAccess("past_due"), "paid");
assert.equal(resolveHockeyMembershipAccess("grace_period"), "paid");
assert.equal(resolveHockeyMembershipAccess("incomplete"), "blocked");
assert.equal(resolveHockeyMembershipAccess("canceled"), "blocked");
assert.equal(resolveHockeyMembershipAccess("suspended"), "blocked");

assert.equal(
  validateHockeyCheckoutInput({ planCode: "parent_essential" }).success,
  true,
);
assert.equal(
  validateHockeyCheckoutInput({ planCode: "parent_premium" }).success,
  true,
);
assert.equal(
  validateHockeyCheckoutInput({ planCode: "../../admin" }).success,
  false,
);

assert.equal(
  resolveHockeyCheckoutLive({
    enabled: false,
    secretKey: "sk_test",
    webhookSecret: "whsec_test",
  }),
  false,
);
assert.equal(
  resolveHockeyCheckoutLive({
    enabled: true,
    secretKey: "",
    webhookSecret: "whsec_test",
  }),
  false,
);
assert.equal(
  resolveHockeyCheckoutLive({
    enabled: true,
    secretKey: "sk_test",
    webhookSecret: "whsec_test",
  }),
  true,
);

assert.equal(mapHockeyStripeStatus("active"), "active");
assert.equal(mapHockeyStripeStatus("past_due"), "past_due");
assert.equal(mapHockeyStripeStatus("trialing"), "skip");
assert.equal(mapHockeyStripeStatus("incomplete"), "skip");
assert.equal(mapHockeyStripeStatus("unpaid"), "expired");

const webhookDecision = interpretHockeyStripeSubscription(
  {
    id: "sub_ahmv_test",
    status: "active",
    customer: "cus_ahmv_test",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: "price_parent_essential_test" },
          current_period_start: 1_800_000_000,
          current_period_end: 1_802_678_400,
        },
      ],
    },
    metadata: {
      billingDomain: "hockey_membership",
      planCode: "forged_plan_should_not_grant_access",
    },
  },
  {
    price_parent_essential_test: {
      planCode: "parent_essential",
      planName: "AHMV Parent Essential",
    },
  },
);
assert.equal(webhookDecision.action, "apply");
if (webhookDecision.action === "apply") {
  assert.equal(webhookDecision.patch.status, "active");
  assert.equal(webhookDecision.patch.planCode, "parent_essential");
  assert.equal(webhookDecision.patch.planName, "AHMV Parent Essential");
  assert.equal(webhookDecision.patch.externalCustomerId, "cus_ahmv_test");
  assert.equal(webhookDecision.patch.externalSubscriptionId, "sub_ahmv_test");
}

const unknownPriceDecision = interpretHockeyStripeSubscription(
  {
    id: "sub_unknown",
    status: "active",
    customer: "cus_unknown",
    items: { data: [{ price: { id: "price_not_in_catalog" } }] },
    metadata: { planCode: "parent_essential" },
  },
  {},
);
assert.equal(unknownPriceDecision.action, "skip");

const forbiddenPricePatterns = [
  /displayWeeklyCad/,
  /Expected CAD 10\.00 billed weekly/,
  /unit_amount\s*===\s*1000/,
  /VITE_PARENT_PREMIUM_WEEKLY_PRICE_CAD/,
];

for (const path of [
  "src/lib/billing/hockey/types.ts",
  "src/lib/billing/hockey/plan-catalog.ts",
  "src/lib/billing/hockey/membership-policy.ts",
  "src/lib/billing/hockey/stripe-env.ts",
  "src/lib/billing/hockey/stripe-service.ts",
]) {
  const source = readFileSync(path, "utf8");
  for (const pattern of forbiddenPricePatterns) {
    assert.doesNotMatch(source, pattern, `${path} contains legacy hard-coded pricing: ${pattern}`);
  }
}

console.log("verify-hockey-membership: catalog-driven checks passed");
