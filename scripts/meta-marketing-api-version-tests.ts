import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { DEFAULT_META_MARKETING_API_VERSION, getMetaMarketingApiVersion } from "../src/lib/social/providers/meta-marketing-api-version";

assert.equal(DEFAULT_META_MARKETING_API_VERSION, "v25.0");
const prior = process.env.META_ADS_MARKETING_API_VERSION;
try {
  delete process.env.META_ADS_MARKETING_API_VERSION;
  assert.equal(getMetaMarketingApiVersion(), "v25.0", "default Marketing API version must be currently supported");
  process.env.META_ADS_MARKETING_API_VERSION = "v25.0";
  assert.equal(getMetaMarketingApiVersion(), "v25.0", "pinned version works");
  for (const invalid of ["v21.0", "v22.0", "v24.0", "v26.0", "https://evil.invalid", "../v25.0", ""]) {
    process.env.META_ADS_MARKETING_API_VERSION = invalid;
    if (invalid === "") {
      assert.equal(getMetaMarketingApiVersion(), "v25.0", "empty override uses supported default");
    } else {
      assert.throws(() => getMetaMarketingApiVersion(), /Unsupported Meta Marketing API version/);
    }
  }
} finally {
  if (prior === undefined) delete process.env.META_ADS_MARKETING_API_VERSION;
  else process.env.META_ADS_MARKETING_API_VERSION = prior;
}
for (const source of ["src/lib/social/providers/meta-ads-accounts.ts", "src/lib/social/providers/meta-ads-insights.ts"]) {
  const text = readFileSync(source, "utf8");
  assert(text.includes("getMetaMarketingApiVersion"), source + " must use separate supported Marketing API version");
  assert(!text.includes("getMetaGraphApiVersion"), source + " must not silently use expired Marketing v21 fallback");
}
const graph = readFileSync("src/lib/social/providers/meta-oauth.ts", "utf8");
assert(graph.includes('const DEFAULT_GRAPH_API_VERSION = "v21.0"'), "Graph API OAuth defaults preserved for Pages and Instagram");
const docs = readFileSync(".env.example", "utf8");
assert(docs.includes("META_ADS_MARKETING_API_VERSION=v25.0"), "operator version is documented");
console.log("PASS Meta Marketing v25 separation from Facebook/Instagram Graph OAuth, invalid override, account and insights pinning.");
