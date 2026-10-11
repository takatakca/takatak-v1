// TK-014: public prices follow ProductPrice when a CAD plan exists.
// Run: npm run qa:catalog-prices
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { pricing } from "../src/lib/website/pricing";
import {
  marketplaceAddonCode,
  marketplaceTierCode,
  presentCatalogPricing,
  pricePackageFromCatalog,
  PUBLIC_CATALOG_CODE,
} from "../src/lib/website/catalog-prices";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

check("missing catalog rows keep the published prices", () => {
  const view = presentCatalogPricing([]);
  assert.equal(view.pricing.hosting[0].amount, pricing.hosting[0].amount);
  assert.equal(view.featuredPrices.find((item) => item.key === "hosting")?.from, pricing.hosting[0].amount);
  assert.equal(view.pricingGroups.find((group) => group.key === "hosting")?.tiers[0].amount, pricing.hosting[0].amount);
});

check("a CAD ProductPrice replaces that plan only", () => {
  const view = presentCatalogPricing([
    { planCode: "hosting.portfolio", unitAmountMinor: 1234, currency: "CAD" },
    { planCode: "domain.domain-register", unitAmountMinor: 2500, currency: "CAD" },
    { planCode: "hosting.bronze", unitAmountMinor: 999, currency: "USD" },
    { planCode: "websites.starter", unitAmountMinor: -1, currency: "CAD" },
  ]);
  assert.equal(view.pricing.hosting[0].amount, 12.34);
  assert.equal(view.pricing.hosting[1].amount, pricing.hosting[1].amount);
  assert.equal(view.pricing.domain.register.amount, 25);
  assert.equal(view.pricing.websites[0].amount, pricing.websites[0].amount);
  assert.equal(view.featuredPrices.find((item) => item.key === "hosting")?.from, 12.34);
  assert.equal(view.pricingGroups.find((group) => group.key === "domains")?.tiers[0].amount, 25);
  assert.equal(Number(pricing.hosting[0].amount) === 12.34, false);
});

check("marketplace tiers and add-ons use the same cents", () => {
  const pkg = pricePackageFromCatalog(
    {
      id: "logo-kit",
      tiers: [
        { name: "Basic", priceCents: 1000 },
        { name: "Standard", priceCents: 2000 },
      ],
      addons: [{ label: "Extra revision", priceCents: 500 }],
    },
    [
      { planCode: marketplaceTierCode("logo-kit", "Basic"), unitAmountMinor: 4500, currency: "CAD" },
      { planCode: marketplaceAddonCode("logo-kit", "Extra revision"), unitAmountMinor: 700, currency: "CAD" },
    ],
  );
  assert.equal(pkg.tiers[0].priceCents, 4500);
  assert.equal(pkg.tiers[1].priceCents, 2000);
  assert.equal(pkg.addons[0].priceCents, 700);
});

check("the public site reads the takatak_public catalog", () => {
  const layout = readFileSync("src/app/(website)/layout.tsx", "utf8");
  const loader = readFileSync("src/lib/website/load-public-catalog.ts", "utf8");
  const pricingPage = readFileSync("src/components/website/pages/pricing-page-content.tsx", "utf8");
  const gig = readFileSync("src/app/(website)/marketplace/gigs/[id]/page.tsx", "utf8");
  assert.equal(PUBLIC_CATALOG_CODE, "takatak_public");
  assert.match(layout, /loadPublicCatalogRows/);
  assert.match(loader, /productPrice\.findMany/);
  assert.match(loader, /PUBLIC_CATALOG_CODE/);
  assert.match(pricingPage, /usePublicPricing/);
  assert.match(gig, /pricePackageFromCatalog/);
});

console.log(`\n${passed} catalog price checks passed.`);
