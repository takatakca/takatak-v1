// Gate 3 client checks. No database and no live network.
// Run: node scripts/verify-mimt-gate3.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function pass(label) {
  console.log(`PASS  ${label}`);
}

const page = read("src/app/dashboard/voip/page.tsx");
assert.ok(!page.includes("$"), "page must not contain '$'");
assert.doesNotMatch(page, /911/);
assert.doesNotMatch(page, /demo|mock|sample|fake/i);
assert.doesNotMatch(page, /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
assert.doesNotMatch(page, /\+1\s?\d/);
assert.ok(page.includes("getVoipConnectionStatus()"));
assert.ok(page.includes("No data until MIMT is connected"));
assert.ok(page.includes("probeMimtOverview"));
assert.doesNotMatch(page, /<button|onClick|"use client"|getPrisma|fetch\(/);
pass("dashboard page still has no prices, brands, or direct fetch");

const statusSource = read("src/lib/voip/voip-status.ts");
assert.doesNotMatch(statusSource, /\bfetch\s*\(|from\s+["'](node:)?(http|https|net)["']|axios/);
assert.doesNotMatch(statusSource, /state:\s*["'](verified_staging|verified_production|error)["']/);
pass("voip-status.ts still makes no network call");

const clientSource = read("src/lib/voip/mimt-client.ts");
assert.match(clientSource, /x-mimt-api-key/);
assert.doesNotMatch(clientSource, /console\.(log|info|warn|error|debug)/);
assert.doesNotMatch(clientSource, /NEXT_PUBLIC_MIMT/);
assert.doesNotMatch(clientSource, /searchParams\.set\(\s*["'](?:key|api_key|token|password)/);
pass("client sends the key as a header and does not log it");

const tsPath = process.env.TYPESCRIPT_LIB
  ?? "C:/Users/Shehroz/src/mimtcaapp/node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/typescript.js";
const require = createRequire(import.meta.url);
const ts = require(tsPath);

const outDir = path.join(root, "scripts", ".gate3-out");
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const rel of ["src/lib/voip/voip-status.ts", "src/lib/voip/mimt-client.ts"]) {
  const source = fs.readFileSync(path.join(root, rel), "utf8");
  const result = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: rel,
  });
  const js = result.outputText.replaceAll('from "./voip-status"', 'from "./voip-status.mjs"');
  fs.writeFileSync(path.join(outDir, path.basename(rel).replace(/\.ts$/, ".mjs")), js);
}

const client = await import(pathToFileURL(path.join(outDir, "mimt-client.mjs")).href);
const status = await import(pathToFileURL(path.join(outDir, "voip-status.mjs")).href);

const URL_OK = "https://api.mimt.example";
const KEY = "gate3-test-key-not-a-secret";
assert.equal(status.getVoipConnectionStatus({ MIMT_API_URL: URL_OK, MIMT_API_KEY: KEY }).state, "configured_untested");
assert.equal(await client.probeMimtOverview({ globalUserId: "user_1", env: {} }), null);
pass("missing env does not call MIMT");

let called = 0;
const missed = await client.probeMimtOverview({
  globalUserId: "user_1",
  env: { MIMT_API_URL: "http://api.mimt.example", MIMT_API_KEY: KEY },
  fetchImpl: async () => {
    called += 1;
    throw new Error("should not fetch");
  },
});
assert.equal(missed, null);
assert.equal(called, 0);
pass("http address is refused before any request");

const seen = [];
const overview = await client.probeMimtOverview({
  globalUserId: "user_1",
  env: { MIMT_API_URL: URL_OK, MIMT_API_KEY: KEY },
  fetchImpl: async (url, init) => {
    seen.push({ href: String(url), header: init.headers["x-mimt-api-key"] });
    return new Response(JSON.stringify({
      global_user_id: "user_1",
      connected: true,
      numbers: [
        { phone_number_id: "pn_1", e164: "+15145550100", state: "active" },
        { phone_number_id: "../x", e164: "not-a-number", state: "active" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
  },
});
assert.equal(seen.length, 1);
assert.equal(seen[0].header, KEY);
assert.ok(!seen[0].href.includes(KEY));
assert.match(seen[0].href, /\/v1\/takatak\/overview\?global_user_id=user_1$/);
assert.deepEqual(overview.numbers, [{ phone_number_id: "pn_1", e164: "+15145550100", state: "active" }]);
pass("key stays in the header and bad numbers are dropped");

const refused = await client.probeMimtOverview({
  globalUserId: "user_1",
  env: { MIMT_API_URL: URL_OK, MIMT_API_KEY: KEY },
  fetchImpl: async () => new Response("no", { status: 401 }),
});
assert.equal(refused, null);
pass("a refused check leaves the overview empty");

fs.rmSync(outDir, { recursive: true, force: true });
console.log("\nAll Gate 3 checks passed.");
