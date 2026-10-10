// Business phone (VoIP) dashboard shell safeguards.
// Pure logic + static source checks. No database, no network.
// Run: npm run qa:voip-dashboard
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { NAV_ITEMS, NAV_SECTIONS } from "../src/lib/dashboard/dashboard-config";
import { getVoipConnectionStatus, isHttpsUrl } from "../src/lib/voip/voip-status";

function pass(label: string): void {
  console.log(`PASS  ${label}`);
}

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

// ── Status function ───────────────────────────────────────────
const URL_OK = "https://api.mimt.example";
const KEY = "test-key-not-real";

assert.equal(getVoipConnectionStatus({}).state, "not_configured");
assert.equal(getVoipConnectionStatus({}).label, "MIMT not connected");
pass("no env → not_configured, labelled \"MIMT not connected\"");

assert.equal(getVoipConnectionStatus({ MIMT_API_URL: URL_OK }).state, "not_configured");
assert.equal(getVoipConnectionStatus({ MIMT_API_URL: URL_OK, MIMT_API_KEY: "   " }).state, "not_configured");
pass("missing or blank key → not_configured");

assert.equal(getVoipConnectionStatus({ MIMT_API_KEY: KEY }).state, "not_configured");
pass("missing URL → not_configured");

for (const bad of ["http://api.mimt.example", "ftp://api.mimt.example", "api.mimt.example", "https://", "not a url"]) {
  assert.equal(getVoipConnectionStatus({ MIMT_API_URL: bad, MIMT_API_KEY: KEY }).state, "not_configured", bad);
  assert.equal(isHttpsUrl(bad), false, bad);
}
assert.match(getVoipConnectionStatus({ MIMT_API_URL: "http://api.mimt.example", MIMT_API_KEY: KEY }).detail, /https/);
pass("http (and other non-https) URLs rejected → not_configured");

const configured = getVoipConnectionStatus({ MIMT_API_URL: URL_OK, MIMT_API_KEY: KEY });
assert.equal(configured.state, "configured_untested");
assert.equal(getVoipConnectionStatus({ MIMT_API_URL: " " + URL_OK + " ", MIMT_API_KEY: KEY }).state, "configured_untested");
pass("https URL + key → configured_untested");

const allowed = new Set(["not_configured", "configured_untested"]);
const combos: Record<string, string | undefined>[] = [
  {},
  { MIMT_API_URL: URL_OK, MIMT_API_KEY: KEY },
  { MIMT_API_URL: URL_OK, MIMT_API_KEY: KEY, MIMT_VERIFIED: "true", MIMT_STATUS: "verified_production" },
  { MIMT_API_URL: "http://x", MIMT_API_KEY: KEY },
];
for (const env of combos) {
  const s = getVoipConnectionStatus(env);
  assert.ok(allowed.has(s.state), `unexpected state ${s.state}`);
  assert.doesNotMatch(s.label + " " + s.detail, /\b(verified|connected successfully)\b/i);
  assert.ok(!s.detail.includes(KEY), "detail must never echo the key");
}
pass("never returns a verified/connected state and never echoes the key");

const statusSource = read("src/lib/voip/voip-status.ts");
assert.doesNotMatch(statusSource, /\bfetch\s*\(|from\s+["'](node:)?(http|https|net)["']|axios/);
assert.doesNotMatch(statusSource, /state:\s*["'](verified_staging|verified_production|error)["']/);
pass("status module makes no network calls and has no code path returning verified/error");

// ── Page copy ─────────────────────────────────────────────────
const pagePath = "src/app/dashboard/voip/page.tsx";
const page = read(pagePath);

assert.ok(!page.includes("$"), "page must not contain '$' (no prices)");
assert.doesNotMatch(page, /\b\d+[.,]\d{2}\b|\bper month\b|\/\s?mo\b|\bCAD\b/i);
pass("page has no prices");

assert.doesNotMatch(page, /unlimited/i);
assert.doesNotMatch(page, /911/);
pass("page has no \"unlimited\" and no 911 claims");

for (const brand of [/twilio/i, /\bBell\b/, /vid[ée]otron/i, /\brogers\b/i, /fongo/i, /telus/i, /\bfido\b/i]) {
  assert.doesNotMatch(page, brand, `telecom brand in page: ${brand}`);
}
pass("page names no telecom brands");

assert.doesNotMatch(page, /\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/);
assert.doesNotMatch(page, /\+1\s?\d/);
assert.doesNotMatch(page, /demo|mock|sample|fake/i);
pass("page has no phone numbers and no demo data");

for (const title of [
  "Phone numbers",
  "Call history",
  "Voicemail",
  "Call transfers & forwarding",
  "Business hours / auto-attendant",
  "Usage",
]) {
  assert.ok(page.includes(`title: "${title}"`), `missing section ${title}`);
}
assert.ok(page.includes("No data until MIMT is connected"));
pass("all six sections render the honest empty state");

assert.ok(page.includes("getVoipConnectionStatus()"));
assert.ok(page.includes('href="/services/voip"') && page.includes("Join the waitlist"));
assert.ok(page.includes("Talk to sales") && page.includes("SUPPORT_EMAIL"));
assert.ok(page.includes("Coming soon"));
assert.doesNotMatch(page, /<button|onClick|"use client"|getPrisma|fetch\(/);
pass("status banner, waitlist + sales CTAs, disabled quick actions; server component, no data access");

// ── Sidebar ───────────────────────────────────────────────────
const entries = NAV_ITEMS.filter((i) => i.href === "/dashboard/voip");
assert.equal(entries.length, 1);
assert.equal(entries[0].label, "Business phone");
const servicesGroup = NAV_SECTIONS.find((s) => s.title === "Services");
assert.ok(servicesGroup?.items.some((i) => i.href === "/dashboard/voip"));
pass("sidebar has one \"Business phone\" entry in the Services group");

console.log("\nAll VoIP dashboard checks passed.");
