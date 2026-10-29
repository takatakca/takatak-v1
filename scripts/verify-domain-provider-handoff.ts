// Run: npx tsx scripts/verify-domain-provider-handoff.ts
// Pure provider-handoff tests; no credentials, DNS provider calls, or network.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  domainProviderHandoff,
  MOCHAHOST_CLIENT_AREA_URL,
} from "../src/lib/web-hosting/domain-provider-handoff";

assert.equal(MOCHAHOST_CLIENT_AREA_URL, "https://clients.mochahost.com/");
for (const provider of ["MochaHost", "mocha host", "mocha-host", "mocha_host", "MOCHAHOST"]) {
  assert.deepEqual(domainProviderHandoff(provider), {
    label: "MochaHost Client Area",
    url: MOCHAHOST_CLIENT_AREA_URL,
    supportsAutomaticLogin: false,
    controlsVerified: false,
  });
}
for (const unsafe of [
  null, undefined, "", "godaddy", "internal_demo",
  "https://clients.mochahost.com.evil.example",
  "mochahost.evil.example", "mochahost?next=https://evil.example",
  "https://evil.example", "javascript:alert(1)",
]) {
  assert.equal(domainProviderHandoff(unsafe), null);
}
const page = fs.readFileSync("src/app/dashboard/web-hosting/domain-portal/page.tsx", "utf8");
assert.ok(page.includes("getDomainAssetsData()"), "Uses tenant-scoped domain data");
assert.ok(page.includes("getDnsRecordsData()"), "DNS record display uses data scope");
assert.ok(page.includes('d.registrar !== "internal_demo"'), "Hides demonstration domains");
assert.ok(page.includes("MOCHAHOST_CLIENT_AREA_URL"), "Uses audited exact destination");
assert.ok(page.includes('rel="noopener noreferrer"'), "External tabs are isolated");
assert.equal(/<input[^>]*(type="password"|name="password")/.test(page), false, "Never clone provider password input");
assert.equal(page.includes("fetch(MOCHAHOST_CLIENT_AREA_URL"), false, "No credential proxy");
assert.equal(page.includes("dnsRecord.update("), false, "No fake DNS editing route");
const shell = fs.readFileSync("src/components/web-hosting/web-domain-shell.tsx", "utf8");
assert.ok(shell.includes("/dashboard/web-hosting/domain-portal"), "Visible from existing Web & Domain workspace");
console.log("Domain-provider handoff policy: all scoped, allowlisted and no-password tests passed.");
