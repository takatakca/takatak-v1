import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { maxCpcSpendBeforeClick } from "../src/lib/ads/cpc-budget-policy";

function check(): void {
  assert.equal(maxCpcSpendBeforeClick(1000, 100), 900);
  assert.equal(maxCpcSpendBeforeClick(100, 100), 0);
  assert.equal(maxCpcSpendBeforeClick(101, 1), 100);
  assert.equal(maxCpcSpendBeforeClick(99, 100), null);
  assert.equal(maxCpcSpendBeforeClick(0, 1), null);
  assert.equal(maxCpcSpendBeforeClick(-10, 1), null);
  assert.equal(maxCpcSpendBeforeClick(100, null), null);
  assert.equal(maxCpcSpendBeforeClick(100, 0), null);
  assert.equal(maxCpcSpendBeforeClick(100, -1), null);
  assert.equal(maxCpcSpendBeforeClick(100.5, 1), null);
  assert.equal(maxCpcSpendBeforeClick(100, Number.POSITIVE_INFINITY), null);
  assert.equal(maxCpcSpendBeforeClick(Number.MAX_SAFE_INTEGER + 1, 1), null);

  const source = fs.readFileSync(
    path.join(process.cwd(), "src/lib/ads/ad-server.ts"),
    "utf8",
  );
  const cpcSection = source.split('campaign.pricingModel === "cpc"')[1] ?? "";
  assert.ok(cpcSection.includes("maxCpcSpendBeforeClick("));
  assert.ok(cpcSection.includes("tx.adCampaign.updateMany({"));
  assert.ok(cpcSection.includes("spentCents: { lte: maximumStartingSpend }"));
  assert.ok(cpcSection.includes("increment: campaign.bidCents!"));
  assert.equal(
    cpcSection.includes("tx.adCampaign.update({"),
    false,
  );

  console.log("PASS CPC cannot increase spend when the full bid exceeds remaining budget");
}

check();
