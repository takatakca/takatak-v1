// Website security check (/dashboard/web-hosting/security): grading and
// guards. Pure checks plus source guards; no network. Run: npm run qa:website-security
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { allowWebsiteCheck, WEBSITE_CHECKS_PER_WINDOW } from "../src/lib/web-hosting/check-limit";
import { domainFrom } from "../src/lib/web-hosting/dns-check";
import { gradeDns } from "../src/lib/web-hosting/dns-grade";
import { gradeRedirects } from "../src/lib/web-hosting/redirect-grade";
import { gradeSecurity } from "../src/lib/web-hosting/security-grade";

const strong = gradeSecurity({
  host: "example.ca",
  httpsOk: true,
  httpRedirectsToHttps: true,
  headers: {
    "strict-transport-security": "max-age=63072000; includeSubDomains",
    "content-security-policy": "default-src 'self'; frame-ancestors 'none'",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=()",
    server: "cloudflare",
  },
  certificate: { trusted: true, daysLeft: 70, issuer: "Let's Encrypt" },
});
assert.equal(strong.score, 100);
assert.ok(strong.checks.every((c) => c.status === "pass"));
assert.equal(strong.checks.length, 10);

const weak = gradeSecurity({
  host: "old.example.ca",
  httpsOk: false,
  httpRedirectsToHttps: false,
  headers: { server: "Apache/2.4.29 (Ubuntu)", "x-powered-by": "PHP/7.2.1" },
  certificate: null,
});
assert.equal(weak.score, 10, "only the half-points of the five warnings remain");
const status = (key: string) => weak.checks.find((c) => c.key === key)?.status;
assert.equal(status("https"), "fail");
assert.equal(status("certificate"), "fail");
assert.equal(status("redirect"), "fail");
assert.equal(status("hsts"), "fail");
assert.equal(status("frames"), "fail");
assert.equal(status("banner"), "warn", "a version in Server or X-Powered-By is flagged");
assert.ok(weak.score < 20, `a bare http site scores low (${weak.score})`);

// Certificate edge cases and HSTS duration.
const expiring = gradeSecurity({ host: "x.ca", httpsOk: true, httpRedirectsToHttps: true, headers: { "strict-transport-security": "max-age=86400", "x-frame-options": "SAMEORIGIN" }, certificate: { trusted: true, daysLeft: 5, issuer: null } });
assert.equal(expiring.checks.find((c) => c.key === "certificate")?.status, "warn");
assert.equal(expiring.checks.find((c) => c.key === "hsts")?.status, "warn", "HSTS under 6 months is a warning");
assert.equal(expiring.checks.find((c) => c.key === "frames")?.status, "pass", "X-Frame-Options SAMEORIGIN protects against framing");
const untrusted = gradeSecurity({ host: "x.ca", httpsOk: true, httpRedirectsToHttps: null, headers: {}, certificate: { trusted: false, daysLeft: 300, issuer: null } });
assert.equal(untrusted.checks.find((c) => c.key === "certificate")?.status, "fail");
assert.equal(untrusted.checks.find((c) => c.key === "redirect")?.status, "warn", "an unreachable http:// is unknown, not failed");

// Guards: every connection goes to a resolved public address; nothing is stored; signed-in users only.
const check = readFileSync("src/lib/web-hosting/security-check.ts", "utf8");
assert.match(check, /^import "server-only";/);
assert.equal((check.match(/requestPinned\(/g) ?? []).length, 2);
assert.equal((check.match(/resolvePublicAddress\(/g) ?? []).length, 3, "each request (https hops, http, certificate) resolves a public address first");
assert.match(check, /host: pinned\.address, port: 443, servername: host/, "the certificate check connects to the pinned public address");
assert.match(check, /normalizeAuditUrl\(/);
assert.doesNotMatch(check, /prisma|getPrisma|\.create\(/, "the check stores nothing");
const action = readFileSync("src/app/dashboard/web-hosting/security/actions.ts", "utf8");
assert.match(action, /hasEffectivePermission\(access, "view_dashboard"\)/);
assert.doesNotMatch(readFileSync("src/lib/dashboard/dashboard-config.ts", "utf8"), /"\/dashboard\/web-hosting\/security",\n/, "the security screen is no longer staff-only");

// DNS and email check (/dashboard/web-hosting/dns).
assert.equal(domainFrom("https://www.Example.ca/menu"), "example.ca");
assert.equal(domainFrom("shop.example.ca"), "shop.example.ca");
for (const bad of ["", "localhost", "intranet.local", "10.0.0.1", "exa mple.ca", "x".repeat(400)]) assert.equal(domainFrom(bad), null, bad);
const healthy = gradeDns({
  domain: "example.ca",
  a: ["203.0.113.10"],
  aaaa: [],
  wwwResolves: true,
  ns: ["ns1.host.ca", "ns2.host.ca"],
  mx: [{ exchange: "mx.mail.ca", priority: 10 }],
  txt: ["v=spf1 include:_spf.mail.ca ~all", "google-site-verification=abc"],
  dmarc: ["v=DMARC1; p=quarantine; rua=mailto:dmarc@example.ca"],
});
assert.ok(healthy.checks.every((c) => c.status === "pass"), JSON.stringify(healthy.checks));
assert.ok(healthy.records.some((r) => r.type === "MX" && r.value === "10 mx.mail.ca"));
const broken = gradeDns({
  domain: "example.ca",
  a: [],
  aaaa: [],
  wwwResolves: false,
  ns: ["ns1.host.ca"],
  mx: [{ exchange: "mx.mail.ca", priority: 10 }],
  txt: ["v=spf1 +all", "v=spf1 include:x ~all"],
  dmarc: [],
});
const dns = (key: string) => broken.checks.find((c) => c.key === key)?.status;
assert.equal(dns("website"), "fail");
assert.equal(dns("www"), "warn");
assert.equal(dns("ns"), "warn");
assert.equal(dns("spf"), "fail", "two SPF records are rejected by mail servers");
assert.equal(dns("dmarc"), "fail", "a domain that receives mail without DMARC can be spoofed");
const watch = gradeDns({ domain: "x.ca", a: ["203.0.113.1"], aaaa: [], wwwResolves: true, ns: ["a", "b"], mx: [], txt: ["v=spf1 ?all"], dmarc: ["v=DMARC1; p=none"] });
assert.equal(watch.checks.find((c) => c.key === "spf")?.status, "warn", "an SPF without ~all or -all is too permissive");
assert.equal(watch.checks.find((c) => c.key === "dmarc")?.status, "warn", "p=none only watches");
assert.equal(watch.checks.find((c) => c.key === "mx")?.status, "warn");
const dnsCheck = readFileSync("src/lib/web-hosting/dns-check.ts", "utf8");
assert.match(dnsCheck, /^import "server-only";/);
assert.doesNotMatch(dnsCheck, /prisma|getPrisma|\.create\(|fetch\(/, "the DNS check only reads public DNS and stores nothing");
assert.match(readFileSync("src/app/dashboard/web-hosting/dns/actions.ts", "utf8"), /hasEffectivePermission\(access, "view_dashboard"\)/);
assert.doesNotMatch(readFileSync("src/lib/dashboard/dashboard-config.ts", "utf8"), /"\/dashboard\/web-hosting\/dns",\n/, "the DNS screen is no longer staff-only");

// Redirect checker (/dashboard/web-hosting/redirects).
const clean = gradeRedirects("http://example.ca/", [
  { url: "http://example.ca/", status: 301, location: "https://example.ca/" },
  { url: "https://example.ca/", status: 200, location: null },
], null);
assert.equal(clean.finalUrl, "https://example.ca/");
assert.ok(clean.findings.every((f) => f.status === "pass"), JSON.stringify(clean.findings));
const messy = gradeRedirects("http://example.ca/old", [
  { url: "http://example.ca/old", status: 302, location: "https://example.ca/old" },
  { url: "https://example.ca/old", status: 301, location: "http://www.example.ca/old" },
  { url: "http://www.example.ca/old", status: 301, location: "https://www.example.ca/new" },
  { url: "https://www.example.ca/new", status: 404, location: null },
], null);
const finding = (key: string) => messy.findings.find((f) => f.key === key)?.status;
assert.equal(finding("final"), "fail", "a chain ending on a 404 is broken");
assert.equal(finding("count"), "warn", "three redirects is too many");
assert.equal(finding("temporary"), "warn", "a 302 on a permanent move is flagged");
assert.equal(finding("downgrade"), "fail", "https back to http is flagged");
assert.equal(gradeRedirects("https://x.ca/", [{ url: "https://x.ca/", status: 301, location: "https://x.ca/" }], "loop").findings[0].key, "loop");
const follower = readFileSync("src/lib/web-hosting/redirect-check.ts", "utf8");
assert.match(follower, /^import "server-only";/);
assert.ok(follower.indexOf("resolvePublicAddress(current)") < follower.indexOf("requestPinned(current"), "each hop resolves a public address before connecting");
assert.match(follower, /current = normalizeAuditUrl\(next\.toString\(\)\)/, "every next hop passes the same URL guard");
assert.doesNotMatch(follower, /prisma|getPrisma|\.create\(/, "the redirect check stores nothing");
assert.match(readFileSync("src/app/dashboard/web-hosting/redirects/actions.ts", "utf8"), /hasEffectivePermission\(access, "view_dashboard"\)/);

// Abuse brake: each person gets a limited number of checks per window, shared by the three tools.
for (let i = 0; i < WEBSITE_CHECKS_PER_WINDOW; i += 1) assert.ok(allowWebsiteCheck("profile-a"));
assert.equal(allowWebsiteCheck("profile-a"), false, "the check after the limit is refused");
assert.ok(allowWebsiteCheck("profile-b"), "another person is not affected");
for (const tool of ["security", "dns", "redirects"]) {
  const source = readFileSync(`src/app/dashboard/web-hosting/${tool}/actions.ts`, "utf8");
  assert.ok(source.indexOf("hasEffectivePermission(") < source.indexOf("allowWebsiteCheck(profileDetails.id)"), `${tool}: signed in first, then the brake`);
  assert.ok(source.indexOf("allowWebsiteCheck(profileDetails.id)") < source.indexOf("return run"), `${tool}: the brake runs before any network call`);
}

console.log("website security: ok (grading, certificate, HSTS, framing, guards, DNS and email, redirects, abuse brake)");
