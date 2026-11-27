import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  HOCKEY_MEMBER_PRICE_ENV,
  resolveHockeyCheckoutLive,
  resolveHockeyMembershipAccess,
  resolveHockeyStripePriceId,
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

// AHMV Member price: the owner's server variable wins over the catalog's Stripe price.
assert.equal(HOCKEY_MEMBER_PRICE_ENV, "STRIPE_PRICE_HOCKEY_MEMBER_WEEKLY_10");
const member = { planCode: "parent_essential", legacyCode: "hockey_member_weekly_10", catalogProvider: "stripe" };
assert.equal(
  resolveHockeyStripePriceId({ ...member, catalogPriceId: "price_catalogTest01", memberPriceId: "price_liveMember01" }),
  "price_liveMember01",
);
assert.equal(
  resolveHockeyStripePriceId({ ...member, catalogPriceId: "price_catalogTest01", memberPriceId: "" }),
  "price_catalogTest01",
);
assert.equal(
  resolveHockeyStripePriceId({ ...member, catalogPriceId: null, memberPriceId: "price_liveMember01" }),
  "price_liveMember01",
);
assert.equal(
  resolveHockeyStripePriceId({ ...member, catalogPriceId: "price_catalogTest01", memberPriceId: "not-a-price" }),
  null,
  "a malformed server variable fails closed",
);
assert.equal(
  resolveHockeyStripePriceId({ planCode: "hockey_member_weekly_10", legacyCode: null, catalogProvider: null, catalogPriceId: null, memberPriceId: " price_liveMember01 " }),
  "price_liveMember01",
);
assert.equal(
  resolveHockeyStripePriceId({ ...member, catalogProvider: "manual", catalogPriceId: "price_catalogTest01", memberPriceId: "" }),
  null,
  "only a Stripe catalog price is used",
);
// AHMV VIP (CAD 30/week) is planned and not for sale: never a price, even if one is configured.
for (const vip of [
  { planCode: "parent_premium", legacyCode: "hockey_vip_weekly_30" },
  { planCode: "hockey_vip_weekly_30", legacyCode: null },
]) {
  assert.equal(
    resolveHockeyStripePriceId({ ...vip, catalogProvider: "stripe", catalogPriceId: "price_vipCatalog01", memberPriceId: "price_liveMember01" }),
    null,
  );
}
// Checkout and the webhook price map both read the server variable.
const catalogService = readFileSync("src/lib/billing/hockey/product-catalog-service.ts", "utf8");
assert.match(catalogService, /getHockeyMemberPriceId\(\)/);
assert.match(readFileSync("src/lib/billing/hockey/stripe-service.ts", "utf8"), /line_items: \[\{ price: plan\.stripePriceId, quantity: 1 \}\]/);

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
