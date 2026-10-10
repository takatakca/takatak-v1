// TK-013: promotion codes are accepted, priced and redeemed on the server.
// Run: npm run qa:promotions
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { quotePromo } from "../src/lib/promotions/catalog";
import {
  claimPromo,
  createMemoryPromoStore,
  previewPromo,
  redeemPromo,
} from "../src/lib/promotions/service";

let passed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  await fn();
  passed += 1;
  console.log(`ok ${name}`);
}

async function main() {
  await check("FIRST10 is 10 percent, unknown codes are not a discount", () => {
    const quoted = quotePromo(10_000, "FIRST10");
    assert.equal(quoted.discountCents, Math.round(10_000 * 0.1));
    assert.equal(quoted.totalCents, 9_000);
    assert.equal(quotePromo(10_000, "first10").code, "FIRST10");
    assert.equal(quotePromo(10_000, "FREE100").discountCents, 0);
    assert.equal(quotePromo(10_000, "FREE100").code, null);
    assert.equal(quotePromo(10_000, null).totalCents, 10_000);
  });

  await check("a code is claimed once and redeemed once per account", async () => {
    const store = createMemoryPromoStore();
    const first = await claimPromo(store, "profile-a", "first10");
    const again = await claimPromo(store, "profile-a", "FIRST10");
    assert.equal(first.ok && again.ok, true);
    if (!first.ok || !again.ok) return;
    assert.equal(again.promotion.id, first.promotion.id);
    assert.equal(again.promotion.status, "claimed");

    const preview = await previewPromo(store, "profile-a", "FIRST10", 2_500);
    assert.equal(preview.ok && preview.preview.discountCents, 250);
    assert.equal(preview.ok && preview.preview.accepted, true);

    assert.equal(await redeemPromo(store, "profile-a", "FIRST10", "AB12CD34"), "redeemed");
    assert.equal(await redeemPromo(store, "profile-a", "FIRST10", "AB12CD34"), "already_redeemed");
    const repeat = await claimPromo(store, "profile-a", "FIRST10");
    assert.equal(repeat.ok, false);
    if (!repeat.ok) assert.equal(repeat.code, "already_redeemed");

    const after = await previewPromo(store, "profile-a", "FIRST10", 2_500);
    assert.equal(after.ok && after.preview.discountCents, 0);
    assert.equal(after.ok && after.preview.accepted, false);

    const other = await previewPromo(store, "profile-b", "FIRST10", 2_500);
    assert.equal(other.ok && other.preview.discountCents, 250);

    const unknown = await previewPromo(store, null, "NOPE", 2_500);
    assert.equal(unknown.ok, false);
    const badAmount = await previewPromo(store, null, "FIRST10", 10.5);
    assert.equal(badAmount.ok, false);
  });

  await check("the browser asks the server before a code changes the price", () => {
    const client = readFileSync("src/lib/website/api-client.ts", "utf8");
    assert.doesNotMatch(client, /not_configured/);
    assert.match(client, /\/api\$\{path\}/);
    const detail = readFileSync("src/components/website/marketplace/gig-detail-client.tsx", "utf8");
    assert.match(detail, /previewPromoBackend/);
    assert.doesNotMatch(detail, /toUpperCase\(\) ===\s*"FIRST10"/);
    const pricing = readFileSync("src/lib/website-leads/package-pricing.ts", "utf8");
    assert.match(pricing, /quotePromo/);
    assert.doesNotMatch(pricing, /PROMOTIONS/);
    const intake = readFileSync("src/app/api/public/website-requests/route.ts", "utf8");
    assert.match(intake, /redeemPromo/);
  });

  console.log(`\n${passed} promotion checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
