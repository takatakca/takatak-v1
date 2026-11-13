import assert from "node:assert/strict";
import {
  productInput,
  movementInput,
  normalizeGtin,
} from "../src/lib/inventory/validation";
import { code39, ean13, csvCell } from "../src/lib/inventory/barcodes";
import {
  hasPermission,
  canAccessModule,
  type RoleKey,
} from "../src/lib/security/roles";
const id = "00000000-0000-4000-8000-000000000001";
const base = {
  businessBrandId: id,
  name: "Clover Honey",
  sku: "hny-cl-500",
  category: "Clover",
  size: "500 g",
  ingredients: "100% honey",
  gtin: "036000291452",
  priceCents: 1495,
  threshold: 10,
};
assert.equal(productInput(base).sku, "HNY-CL-500");
assert.equal(normalizeGtin(base.gtin), "0036000291452");
assert.equal(normalizeGtin("4006381333931"), "4006381333931");
assert.equal(normalizeGtin(""), null);
for (const value of ["123", "4006381333932", 4006381333931, "00000000000000"])
  assert.throws(() => normalizeGtin(value));
for (const change of [
  { priceCents: NaN },
  { priceCents: 1.5 },
  { threshold: -1 },
  { priceCents: 1000000001 },
  { name: "" },
  { sku: "<script>" },
  { businessBrandId: "invalid" },
  { ingredients: "x".repeat(2001) },
])
  assert.throws(() => productInput({ ...base, ...change }));
assert.throws(() => productInput(null));
const stock = {
  productId: id,
  requestId: id,
  delta: -2,
  reason: "Sale",
  lot: "LOT-1",
};
assert.equal(movementInput(stock).delta, -2);
for (const delta of [0, 1.5, Infinity, -1000000001, "2"])
  assert.throws(() => movementInput({ ...stock, delta }));
assert.throws(() => movementInput({ ...stock, requestId: "bad" }));
assert.throws(() => movementInput({ ...stock, reason: "" }));
assert.equal(csvCell('=HYPERLINK("evil")'), '"\'=HYPERLINK(""evil"")"');
assert.equal(csvCell("  +1"), '"\'  +1"');
assert.equal(csvCell("a,b"), '"a,b"');
// Independent GS1 EAN-13 encoding vector (4006381333931).
const encoded = ean13("4006381333931");
const bits = Array.from({ length: 95 }, (_, i) =>
  encoded.bars.some((b) => b.x === i + 11) ? "1" : "0",
).join("");
assert.equal(
  bits,
  "10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101",
);
assert.equal(encoded.width, 117);
assert.deepEqual(ean13("036000291452"), ean13("0036000291452"));
const internal = code39("HNY-1");
assert.equal(internal.bars.length, 35);
assert.equal(internal.bars[0].x, 20);
assert.ok(internal.width - internal.bars.at(-1)!.x >= 20);
assert.throws(() => code39("a*"));
for (const role of ["owner", "admin", "manager"] as RoleKey[])
  assert.equal(hasPermission(role, "manage_inventory"), true);
for (const role of ["editor", "staff", "viewer"] as RoleKey[]) {
  assert.equal(hasPermission(role, "manage_inventory"), false);
  assert.equal(canAccessModule(role, "/dashboard/inventory"), true);
}
assert.equal(canAccessModule(null, "/dashboard/inventory"), false);
console.log(
  "Inventory validation, GS1 encoding vector, Code39 structure, CSV safety and role checks passed.",
);
