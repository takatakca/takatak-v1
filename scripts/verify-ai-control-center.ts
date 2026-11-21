// AI Control Center (/dashboard/admin/ai): one owner screen for every AI.
// Guards: platform admins only, keys never decrypted or shown, and every
// setting it tells the owner to change is one the code really reads.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync("src/app/dashboard/admin/ai/page.tsx", "utf8");
const lib = readFileSync("src/lib/admin/ai-control.ts", "utf8");
const config = readFileSync("src/lib/dashboard/dashboard-config.ts", "utf8");
const tower = readFileSync("src/app/dashboard/admin/page.tsx", "utf8");

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

check("the screen is for platform owners and admins only", () => {
  assert.match(page, /await requireAdminAccess\(\)/);
  assert.match(lib, /^import "server-only";/m);
});

// Code only: comments may say "never decrypted".
const libCode = lib.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

check("keys are never decrypted, resolved or rendered", () => {
  for (const forbidden of [/resolveProviderKey/, /decrypt/i, /apiKey/]) {
    assert.doesNotMatch(libCode, forbidden);
  }
  assert.doesNotMatch(page, /apiKey|process\.env/);
  // Only the last four characters (keyHint) ever reach the page.
  assert.match(page, /keyHint/);
});

check("each setting named on the screen is read by the code", () => {
  const named = [...lib.matchAll(/"([A-Z][A-Z0-9_]{6,})"/g)].map((m) => m[1]);
  const sources = [
    "src/lib/ai/generation/config.ts",
    "src/lib/takbot/trial.ts",
    "src/lib/billing/ai-credits/stripe.ts",
    "src/lib/growth/ai-engine.ts",
    "src/lib/ai-providers/store.ts",
    "src/lib/growth/connectors.ts",
  ]
    .map((file) => {
      try {
        return readFileSync(file, "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
  const unknown = named.filter((name) => !sources.includes(name) && !/^AI_STUDIO_(OPENAI|ANTHROPIC)_MODEL$/.test(name));
  assert.deepEqual(unknown, [], `settings named but not read anywhere: ${unknown.join(", ")}`);
});

check("the Control Tower and the admin menu lead to it", () => {
  assert.match(tower, /href: "\/dashboard\/admin\/ai"/);
  assert.match(config, /label: "AI Control Center", href: "\/dashboard\/admin\/ai"/);
  assert.doesNotMatch(tower, /"Foundation"|Phase 13/);
});

console.log(`${passed} AI Control Center checks passed`);
