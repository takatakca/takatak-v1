import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const writeRoutes = [
  "src/app/api/billing/hockey/checkout/route.ts",
  "src/app/api/billing/hockey/portal/route.ts",
  "src/app/api/billing/hockey/supporter-credit/redeem/route.ts",
  "src/app/api/hockey/calendar/google/start/route.ts",
  "src/app/api/hockey/calendar/google/disconnect/route.ts",
  "src/app/api/hockey/parent/preferences/route.ts",
];

for (const path of writeRoutes) {
  const source = readFileSync(path, "utf8");
  assert.match(source, /hasValidWriteOrigin/);
  assert.match(source, /403/);
}

const webhook = readFileSync(
  "src/app/api/billing/hockey/webhook/route.ts",
  "utf8",
);
assert.doesNotMatch(webhook, /hasValidWriteOrigin/);
assert.match(webhook, /stripe/i);

console.log("verify-hockey-write-origin: all checks passed");
