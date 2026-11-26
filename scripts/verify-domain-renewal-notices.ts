// Run: npm run qa:domain-renewals
// Pure read-only contract tests. No provider calls, customer data or migrations.
import assert from "node:assert/strict";
import fs from "node:fs";
import { getDomainRenewalNotices, type RenewalDomainRecord } from "../src/lib/web-hosting/domain-renewal-notices";

const today = new Date("2026-11-21T23:59:59.000Z");
const record = (overrides: Partial<RenewalDomainRecord> = {}): RenewalDomainRecord => ({
  domainName: "locactif.ca",
  expiresAt: "2026-12-14",
  autoRenew: false,
  status: "tracked",
  registrar: "upmind",
  ...overrides,
});
const check = (domains: RenewalDomainRecord[], source: "database" | "mock" | "unavailable" = "database", asOf = today) =>
  getDomainRenewalNotices({ domains, source, asOf });

assert.deepEqual(check([record()], "mock"), [], "Demo data must never produce notices");
assert.deepEqual(check([record()], "unavailable"), [], "Unavailable data must never produce notices");
assert.deepEqual(check([record({ registrar: "internal_demo" })]), [], "Internal demonstration domains excluded");
assert.deepEqual(check([record({ registrar: null })]), [], "Missing registrar is not a managed domain");
assert.deepEqual(check([record({ status: "cancelled" })]), [], "Cancelled domain excluded");
assert.deepEqual(check([record({ status: "expired" })]), [], "Expired status excluded");
assert.deepEqual(check([record({ status: "pending_connection" })]), [], "Unconnected domain excluded");
assert.deepEqual(check([record({ status: "planned" })]), [], "Planned domain excluded");
assert.deepEqual(check([record({ expiresAt: null })]), [], "Missing expiry never guessed");
assert.deepEqual(check([record({ expiresAt: "2026-02-30" })]), [], "Invalid day refused");
assert.deepEqual(check([record({ expiresAt: "2026-12-14T00:00:00Z" })]), [], "Only known calendar date allowed");
assert.deepEqual(check([record({ domainName: "bad.example/path" })]), [], "Unexpected domain syntax refused");
assert.deepEqual(check([record({ expiresAt: "2026-11-20" })]), [], "Past dates excluded");
assert.deepEqual(check([record({ expiresAt: "2026-12-22" })]), [], "31 days must not display");
assert.equal(check([record({ expiresAt: "2026-12-21" })])[0].daysRemaining, 30, "30-day boundary inclusive");
assert.equal(check([record({ expiresAt: "2026-11-21" })])[0].daysRemaining, 0, "Due today included");
assert.equal(check([record()])[0].daysRemaining, 23, "Calendar days based on UTC, independent of time-of-day");
assert.equal(check([record({ autoRenew: true })])[0].autoRenew, true, "Auto-renew state preserved, not overridden");

const sorted = check([
  record({ domainName: "later.ca", expiresAt: "2026-12-21" }),
  record({ domainName: "soon.ca", expiresAt: "2026-11-25", autoRenew: true }),
]);
assert.deepEqual(sorted.map((notice) => notice.domainName), ["soon.ca", "later.ca"], "Soonest renewal first");
assert.deepEqual(
  check([record({ domainName: "MIELAISSA.CA" }), record({ domainName: "mielaissa.ca" })]),
  [],
  "Conflicting duplicate domain records must not be chosen arbitrarily",
);
assert.deepEqual(
  check([record({ expiresAt: "2028-02-29" })], "database", new Date("2028-02-01T09:00:00Z"))
    .map((r) => r.daysRemaining),
  [28],
  "Leap-day dates must remain valid",
);
assert.deepEqual(check([record()], "database", new Date(NaN)), [], "Bad server time must fail closed");

const server = fs.readFileSync("src/app/dashboard/web-hosting/domains/page.tsx", "utf8");
const client = fs.readFileSync("src/components/web-hosting/domains-manager.tsx", "utf8");
const policy = fs.readFileSync("src/lib/web-hosting/domain-renewal-notices.ts", "utf8");

assert.ok(server.includes('process.env.TAKATAK_DOMAIN_RENEWAL_NOTICES_ENABLED === "true"'), "Explicit server-only opt-in");
assert.ok(server.includes("source: domains.source, domains: liveDomains"), "Real tenant-scoped source required");
assert.ok(server.includes('domain.registrar !== "internal_demo"'), "No demo domains in dashboard");
assert.ok(client.includes('href="/transfert"'), "Existing transfer intake reused");
assert.ok(client.includes("not live registrar confirmations"), "Must disclose recorded data limitations");
assert.ok(client.includes("No invoice, renewal, transfer, DNS, email or website change"), "Must not claim a side effect");
assert.equal(policy.includes("fetch("), false, "No provider network calls");
assert.equal(policy.includes("prisma."), false, "Pure policy must not write to database");

console.log("Domain renewal notices: boundaries, duplicates, tenant source, opt-in, and no-write checks passed.");
