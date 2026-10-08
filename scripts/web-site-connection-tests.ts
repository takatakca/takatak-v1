/**
 * Website connection checks.
 * Covers public https normalization and homepage tag matching.
 * Never prints verification tokens.
 */
import { ServiceError } from "../src/lib/services/service-error";
import {
  isBlockedWebsiteIp,
  normalizePublicWebsiteUrl,
} from "../src/lib/social/connections/web-site-url";
import {
  buildSiteVerificationMetaTag,
  pageContainsVerificationToken,
} from "../src/lib/social/connections/web-site-html";

type Status = "PASS" | "FAIL";
type Result = { name: string; status: Status; evidence: string };

const results: Result[] = [];
const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";

function check(name: string, run: () => string) {
  try {
    results.push({ name, status: "PASS", evidence: run() });
  } catch (error) {
    results.push({
      name,
      status: "FAIL",
      evidence: error instanceof Error ? error.message : "unknown",
    });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function rejection(value: string): string {
  try {
    normalizePublicWebsiteUrl(value);
  } catch (error) {
    if (error instanceof ServiceError) return error.message;
    throw error;
  }
  throw new Error("expected rejection");
}

check("normalizes a public homepage to https origin", () => {
  const site = normalizePublicWebsiteUrl("https://Example.com/about?q=1#top");
  assert(site.siteUrl === "https://example.com/", site.siteUrl);
  assert(site.host === "example.com", site.host);
  return "origin only";
});

check("accepts a bare domain as https", () => {
  const site = normalizePublicWebsiteUrl("www.example.com");
  assert(site.siteUrl === "https://www.example.com/", site.siteUrl);
  return "bare domain";
});

check("rejects http, credentials, localhost, and private addresses", () => {
  assert(
    rejection("http://example.com") === "Use https for the website address.",
    "http",
  );
  assert(rejection("https://user:pass@example.com").includes("public https"), "credentials");
  assert(rejection("https://localhost/").includes("public https"), "localhost");
  assert(rejection("https://127.0.0.1/").includes("public https"), "loopback");
  assert(rejection("https://10.1.2.3/").includes("public https"), "private");
  assert(rejection("https://192.168.0.8/").includes("public https"), "lan");
  assert(
    rejection("https://169.254.169.254/").includes("public https"),
    "metadata",
  );
  return "rejected unsafe addresses";
});

check("classifies blocked and public IPs", () => {
  assert(isBlockedWebsiteIp("127.0.0.1"), "loopback");
  assert(isBlockedWebsiteIp("::1"), "ipv6 loopback");
  assert(isBlockedWebsiteIp("::ffff:10.0.0.1"), "mapped private");
  assert(!isBlockedWebsiteIp("1.1.1.1"), "public");
  assert(!isBlockedWebsiteIp("2606:4700:4700::1111"), "public v6");
  return "ip classification";
});

check("matches the homepage verification tag and ignores comments", () => {
  const tag = buildSiteVerificationMetaTag(TOKEN);
  const html = `<html><head><!-- ${tag} --><meta content="${TOKEN}" name="takatak-site-verification"></head></html>`;
  assert(pageContainsVerificationToken(html, TOKEN), "live tag");
  assert(
    !pageContainsVerificationToken(`<!-- ${tag} -->`, TOKEN),
    "comment only",
  );
  assert(
    !pageContainsVerificationToken(html, `${TOKEN.slice(0, -1)}Z`),
    "wrong token",
  );
  return "tag match";
});

const failed = results.filter((result) => result.status === "FAIL");
for (const result of results) {
  console.log(`${result.status} ${result.name} — ${result.evidence}`);
}

if (failed.length > 0) {
  process.exit(1);
}
