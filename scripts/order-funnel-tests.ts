import assert from "node:assert/strict";

import { pricing } from "../src/lib/website/pricing";
import {
  ADD_ONS,
  EMPTY_FUNNEL,
  STEPS,
  decodeQuote,
  encodeQuote,
  funnelTotals,
  planKeys,
  recommendedIndex,
  stepOffer,
  type FunnelState,
} from "../src/lib/website/order-funnel";

// Every step sells only catalog prices, and the owner's order of steps holds.
assert.deepEqual(STEPS, ["website", "hosting", "social", "marketing", "reviews", "phone", "credits"]);
const website = stepOffer("website");
assert.ok(website.kind === "tiers");
assert.deepEqual(website.tiers.map((t) => t.amount), pricing.websites.map((w) => w.amount));
const hosting = stepOffer("hosting");
assert.ok(hosting.kind === "tiers" && hosting.tiers.every((t) => t.cadence === "monthly"));
assert.equal(stepOffer("reviews").kind, "quote");
assert.equal(stepOffer("phone").kind, "waitlist", "the business phone is not launched: no price");
assert.equal(ADD_ONS.domain.tier().amount, pricing.domain.register.amount);

// Recommendation: business pick first, else the catalog's featured tier.
assert.ok(website.kind === "tiers");
assert.equal(recommendedIndex("website", website.tiers, "shop"), 3);
assert.equal(website.tiers[recommendedIndex("website", website.tiers, null)].featured, true);

// Totals: first payment vs recurring; quotes and wait lists add no money.
const state: FunnelState = {
  business: "restaurant",
  lines: {
    website: { kind: "price", tier: website.tiers[0] },
    hosting: hosting.kind === "tiers" ? { kind: "price", tier: hosting.tiers[1] } : undefined,
    domain: { kind: "price", tier: ADD_ONS.domain.tier() },
    reviews: { kind: "quote" },
    phone: { kind: "waitlist" },
  },
};
const totals = funnelTotals(state);
assert.equal(totals.count, 5);
assert.equal(totals.quotes, 1);
assert.equal(totals.monthly, pricing.hosting[1].amount);
assert.equal(totals.yearly, pricing.domain.register.amount);
assert.equal(totals.first, Math.round((pricing.websites[0].amount + pricing.hosting[1].amount + pricing.domain.register.amount) * 100) / 100);
assert.deepEqual(funnelTotals(EMPTY_FUNNEL), { first: 0, monthly: 0, yearly: 0, quotes: 0, count: 0 });
assert.deepEqual(planKeys(state), ["website", "domains", "hosting", "reviews", "voip"]);

// A saved quote round-trips by tier id; prices are re-read from the catalog, never from the link.
const back = decodeQuote(encodeQuote(state));
assert.ok(back);
assert.deepEqual(funnelTotals(back!), totals);
assert.equal(decodeQuote("not-base64!!"), null);

console.log("order funnel tests: OK");
