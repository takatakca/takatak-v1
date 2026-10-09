// Public website SEO and HTTPS checks (TK-015, TK-016). Pure, no network.
// Run: npm run qa:website-seo
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { httpsRedirectTarget } from "../src/lib/security/https-redirect";
import { websiteStructuredData } from "../src/lib/website/structured-data";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const WEBSITE = "src/app/(website)";

// Indexable pages listed in src/app/sitemap.ts, mapped to their page file.
const STATIC_PAGES: Record<string, string> = {
  "/": "page.tsx",
  "/marketplace": "marketplace/page.tsx",
  "/marketplace/search": "marketplace/search/page.tsx",
  "/marketplace/post-project": "marketplace/post-project/page.tsx",
  "/domain": "domain/page.tsx",
  "/hosting": "hosting/page.tsx",
  "/deals": "deals/page.tsx",
  "/pricing": "pricing/page.tsx",
  "/services": "services/page.tsx",
  "/privacy-manager": "privacy-manager/page.tsx",
  "/search": "search/page.tsx",
};
const DYNAMIC_PAGES: Record<string, string> = {
  "/services/${service.slug}": "services/[slug]/page.tsx",
  "/marketplace/category/${category.slug}": "marketplace/category/[slug]/page.tsx",
  "/marketplace/gigs/${pkg.id}": "marketplace/gigs/[id]/page.tsx",
};

function headers(values: Record<string, string>) {
  return new Headers(values);
}

console.log("Website SEO / HTTPS checks");

check("plain-HTTP visits to takatak.ca are sent to HTTPS with path and query", () => {
  const target = httpsRedirectTarget({
    headers: headers({ host: "takatak.ca", "x-forwarded-proto": "http" }),
    pathname: "/pricing",
    search: "?plan=pro",
    production: true,
  });
  assert.equal(target, "https://takatak.ca/pricing?plan=pro");
  assert.equal(
    httpsRedirectTarget({
      headers: headers({ host: "WWW.TAKATAK.CA:80", "x-forwarded-proto": "HTTP" }),
      pathname: "/",
      search: "",
      production: true,
    }),
    "https://www.takatak.ca/",
  );
});

check("HTTPS, local, unknown hosts, probes and certificate checks never redirect", () => {
  const base = { pathname: "/", search: "", production: true };
  assert.equal(httpsRedirectTarget({ ...base, headers: headers({ host: "takatak.ca", "x-forwarded-proto": "https" }) }), null);
  assert.equal(httpsRedirectTarget({ ...base, headers: headers({ host: "takatak.ca" }) }), null);
  assert.equal(httpsRedirectTarget({ ...base, headers: headers({ host: "localhost:3000", "x-forwarded-proto": "http" }) }), null);
  assert.equal(httpsRedirectTarget({ ...base, headers: headers({ host: "evil.example", "x-forwarded-proto": "http" }) }), null);
  assert.equal(
    httpsRedirectTarget({ ...base, production: false, headers: headers({ host: "takatak.ca", "x-forwarded-proto": "http" }) }),
    null,
  );
  for (const pathname of ["/api/health", "/api/health/db", "/.well-known/acme-challenge/x"]) {
    assert.equal(
      httpsRedirectTarget({ ...base, pathname, headers: headers({ host: "takatak.ca", "x-forwarded-proto": "http" }) }),
      null,
      pathname,
    );
  }
});

check("proxy applies the HTTPS redirect first, with a permanent 308", () => {
  const proxy = readFileSync("src/proxy.ts", "utf8");
  const redirectAt = proxy.indexOf("httpsRedirectTarget({");
  assert.ok(redirectAt > 0);
  assert.ok(redirectAt < proxy.indexOf("getSupabaseEnv()"));
  assert.match(proxy, /NextResponse\.redirect\(secureUrl, 308\)/);
});

check("homepage title fits search results (≤ 65 characters)", () => {
  const home = readFileSync(`${WEBSITE}/page.tsx`, "utf8");
  const title = home.match(/title: \{ absolute: "([^"]+)" \}/)?.[1];
  assert.ok(title, "absolute homepage title");
  assert.ok(title.length >= 15 && title.length <= 65, `${title.length} characters`);
  const layout = readFileSync(`${WEBSITE}/layout.tsx`, "utf8");
  const fallback = layout.match(/default: "([^"]+)"/)?.[1];
  assert.ok(fallback && fallback.length <= 65);
});

check("every indexable page declares its canonical URL", () => {
  for (const [route, file] of Object.entries(STATIC_PAGES)) {
    const source = readFileSync(`${WEBSITE}/${file}`, "utf8");
    assert.ok(source.includes(`canonical: "${route}"`), `${route} in ${file}`);
  }
  for (const [route, file] of Object.entries(DYNAMIC_PAGES)) {
    const source = readFileSync(`${WEBSITE}/${file}`, "utf8");
    assert.ok(source.includes(`canonical: \`${route}\``), `${route} in ${file}`);
  }
});

check("sitemap pages and the canonical list stay in sync", () => {
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  const listed = [...sitemap.matchAll(/^\s+"(\/[^"]*|)",$/gm)].map((m) => m[1] || "/");
  assert.deepEqual([...listed].sort(), Object.keys(STATIC_PAGES).sort());
});

check("page titles do not repeat the brand added by the title template", () => {
  for (const file of [...Object.values(STATIC_PAGES), ...Object.values(DYNAMIC_PAGES)]) {
    if (file === "page.tsx") continue;
    const source = readFileSync(`${WEBSITE}/${file}`, "utf8");
    assert.doesNotMatch(source, /title:\s*[`"][^`"]*— TAKATAK/, file);
  }
});

check("a shared og:image is generated for the public website", () => {
  const file = `${WEBSITE}/opengraph-image.tsx`;
  assert.ok(existsSync(file));
  const source = readFileSync(file, "utf8");
  assert.match(source, /export const size = \{ width: 1200, height: 630 \}/);
  assert.match(source, /export const alt = /);
});

check("homepage JSON-LD describes the organization and site, and cannot break out of its script tag", () => {
  const json = websiteStructuredData("https://takatak.ca/");
  assert.equal(json.includes("<"), false);
  const data = JSON.parse(json);
  const types = data["@graph"].map((node: { "@type": string }) => node["@type"]);
  assert.deepEqual(types, ["Organization", "WebSite"]);
  assert.equal(data["@graph"][0].url, "https://takatak.ca");
  assert.match(data["@graph"][1].potentialAction.target.urlTemplate, /^https:\/\/takatak\.ca\/search\?q=/);
  const home = readFileSync(`${WEBSITE}/page.tsx`, "utf8");
  assert.match(home, /type="application\/ld\+json"/);
  assert.match(home, /websiteStructuredData\(getApplicationOrigin\(\)\)/);
});

console.log(`\n${passed} website SEO checks passed.`);
