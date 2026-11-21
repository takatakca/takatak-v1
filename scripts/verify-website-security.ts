// Website security check (/dashboard/web-hosting/security): grading and
// guards. Pure checks plus source guards; no network. Run: npm run qa:website-security
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

console.log("website security: ok (grading, certificate, HSTS, framing, guards)");
