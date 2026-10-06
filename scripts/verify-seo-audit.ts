// SEO site audit — SSRF guard, HTML extraction, rules, crawler and service
// checks. Uses only local fakes (no internet). Run: npm run qa:seo-audit
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { hostMatcher, MAX_PAGES, normalizeHost, runAudit, type Fetcher } from "../src/lib/seo/audit";
import { evaluateSite, scoreIssues, type PageFacts, type SiteFacts } from "../src/lib/seo/checks";
import { extractSignals, extractSitemapUrls, parseRobots } from "../src/lib/seo/html";
import { guardedLookup, isPublicAddress, parseAuditUrl, safeFetch, SafeFetchError, type FetchedPage } from "../src/lib/seo/safe-fetch";
import { DAILY_AUDIT_LIMIT, listWorkspaceSites, startSeoAudit } from "../src/lib/seo/service";

let passed = 0;
async function check(name: string, run: () => void | Promise<void>) {
  await run();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const GOOD_HTML = `<!doctype html><html lang="fr"><head>
<title>Boulangerie Exemple — Pain artisanal à Montréal</title>
<meta name="description" content="Pain au levain, viennoiseries et gâteaux faits chaque matin dans notre boulangerie de Montréal.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://boulangerie.example/">
<meta property="og:title" content="Boulangerie Exemple"><meta property="og:image" content="https://boulangerie.example/og.jpg">
<script type="application/ld+json">{"@type":"Bakery"}</script>
</head><body><h1>Boulangerie Exemple</h1><img src="a.jpg" alt="Pain"><img src="b.jpg" alt="">
<a href="/menu">Menu</a><a href="https://www.boulangerie.example/contact">Contact</a>
<a href="https://other.example/">Other</a><a href="/photo.jpg">Photo</a><a href="mailto:a@b.c">Mail</a>
<!-- <h1>commented</h1> --><script>var x = "<h1>in script</h1>";</script></body></html>`;

const BAD_HTML = `<html><head><meta name="robots" content="noindex,nofollow"></head>
<body><h1>A</h1><h1>B</h1><img src="x.png"><img src="y.png" alt="ok"></body></html>`;

function page(url: string, body: string, init: Partial<FetchedPage> = {}): FetchedPage {
  return {
    requestedUrl: url, finalUrl: url, status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
    body, bytes: Buffer.byteLength(body), truncated: false, elapsedMs: 120, redirects: [],
    ...init,
  };
}

function fakeWeb(routes: Record<string, FetchedPage | "error">): { fetcher: Fetcher; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    fetcher: async (url, allowHost) => {
      calls.push(url);
      assert.ok(allowHost(new URL(url).hostname), `fetcher asked for foreign host ${url}`);
      const route = routes[url];
      if (!route || route === "error") throw new SafeFetchError("network_error");
      return route;
    },
  };
}

async function main() {
  console.log("SEO audit checks");

  await check("only globally routable addresses are allowed", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "142.250.72.14", "2606:4700:4700::1111", "2001:4860:4860::8888"]) {
      assert.equal(isPublicAddress(ip), true, ip);
    }
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254",
      "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", "192.0.2.10",
      "::1", "::", "fc00::1", "fd12::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1",
      "64:ff9b::10.0.0.1", "2001:db8::1", "not-an-ip",
    ]) {
      assert.equal(isPublicAddress(ip), false, ip);
    }
  });

  await check("audit URLs must be plain http(s) hostnames on default ports", () => {
    assert.equal(parseAuditUrl("https://example.ca/page#x").toString(), "https://example.ca/page");
    for (const bad of [
      "ftp://example.ca/", "file:///etc/passwd", "https://127.0.0.1/", "http://[::1]/",
      "https://example.ca:8443/", "https://user:pw@example.ca/", "https://intranet/",
      "https://printer.local/", "https://db.internal/", "not a url",
    ]) {
      assert.throws(() => parseAuditUrl(bad), SafeFetchError, bad);
    }
  });

  await check("DNS answers pointing to private networks are refused", async () => {
    const result = await new Promise<string>((resolve) => {
      guardedLookup("localhost", { all: true }, (error) => resolve(error ? error.message : "allowed"));
    });
    assert.equal(result, "blocked_address");
  });

  await check("the fetcher cannot reach a server on this machine", async () => {
    const server = createServer((_, res) => res.end("secret"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    try {
      await assert.rejects(
        safeFetch(`http://localhost:${port}/`, { allowHost: () => true }),
        SafeFetchError,
      );
      // Non-public names are refused before any DNS lookup or connection.
      await assert.rejects(safeFetch("http://localhost/", { allowHost: () => true }), (e: unknown) =>
        e instanceof SafeFetchError && e.code === "invalid_url");
    } finally {
      server.close();
    }
  });

  await check("page signals are extracted, ignoring scripts and comments", () => {
    const s = extractSignals(GOOD_HTML, "https://boulangerie.example/");
    assert.equal(s.title, "Boulangerie Exemple — Pain artisanal à Montréal");
    assert.ok(s.metaDescription?.startsWith("Pain au levain"));
    assert.equal(s.viewport, true);
    assert.equal(s.lang, "fr");
    assert.equal(s.h1Count, 1);
    assert.equal(s.imagesTotal, 2);
    assert.equal(s.imagesMissingAlt, 0);
    assert.equal(s.canonical, "https://boulangerie.example/");
    assert.equal(s.ogTitle && s.ogImage && s.structuredData, true);
    assert.deepEqual(s.internalLinks.sort(), [
      "https://boulangerie.example/menu",
      "https://www.boulangerie.example/contact",
    ]);
    assert.equal(extractSignals("<title>Today&#x27;s Deals &amp; more</title>", "https://x.example/").title, "Today's Deals & more");
    const bad = extractSignals(BAD_HTML, "https://bad.example/");
    assert.equal(bad.title, null);
    assert.equal(bad.metaRobots, "noindex,nofollow");
    assert.equal(bad.h1Count, 2);
    assert.equal(bad.imagesMissingAlt, 1);
  });

  await check("robots.txt and sitemaps are parsed safely", () => {
    const robots = parseRobots("User-agent: Googlebot\nDisallow: /private\n\nUser-agent: *\nDisallow: /\nSitemap: https://x.example/sitemap.xml\n");
    assert.equal(robots.blocksAll, true);
    assert.deepEqual(robots.sitemaps, ["https://x.example/sitemap.xml"]);
    assert.equal(parseRobots("User-agent: *\nDisallow:\n").blocksAll, false);
    assert.equal(parseRobots("User-agent: BadBot\nDisallow: /\n").blocksAll, false);
    const urls = extractSitemapUrls(
      "<urlset><url><loc>https://x.example/a</loc></url><url><loc>https://evil.example/b</loc></url><url><loc>https://www.x.example/c</loc></url></urlset>",
      "x.example",
    );
    assert.deepEqual(urls, ["https://x.example/a", "https://www.x.example/c"]);
  });

  await check("rules flag real problems and the score reflects them", () => {
    const site: SiteFacts = { httpsReachable: true, httpRedirectsToHttps: true, robotsFound: true, robotsBlocksAll: false, sitemapFound: true };
    const good: PageFacts = {
      url: "https://boulangerie.example/", isHome: true, status: 200, error: null, elapsedMs: 200, bytes: 20_000,
      xRobotsTag: null, signals: extractSignals(GOOD_HTML, "https://boulangerie.example/"),
    };
    const goodIssues = evaluateSite(site, [good]);
    assert.deepEqual(goodIssues, []);
    assert.equal(scoreIssues(goodIssues), 100);

    const badPage: PageFacts = { ...good, url: "https://bad.example/", elapsedMs: 3000, signals: extractSignals(BAD_HTML, "https://bad.example/") };
    const badSite: SiteFacts = { httpsReachable: true, httpRedirectsToHttps: false, robotsFound: false, robotsBlocksAll: false, sitemapFound: false };
    const keys = new Set(evaluateSite(badSite, [badPage]).map((i) => i.checkKey));
    for (const key of ["http_not_redirected", "robots_missing", "sitemap_missing", "noindex", "title_missing",
      "meta_description_missing", "h1_multiple", "viewport_missing", "images_missing_alt", "slow_response", "structured_data_missing"]) {
      assert.ok(keys.has(key), key);
    }
    const score = scoreIssues(evaluateSite(badSite, [badPage]));
    assert.ok(score >= 0 && score < 50, `score ${score}`);
  });

  await check("crawler stays on the site, follows sitemap, respects page cap", async () => {
    const routes: Record<string, FetchedPage | "error"> = {
      "https://boulangerie.example/": page("https://boulangerie.example/", GOOD_HTML),
      "http://boulangerie.example/": page("http://boulangerie.example/", "", { finalUrl: "https://boulangerie.example/" }),
      "https://boulangerie.example/robots.txt": page("https://boulangerie.example/robots.txt", "User-agent: *\nDisallow:\nSitemap: https://boulangerie.example/sitemap.xml", { headers: { "content-type": "text/plain" } }),
      "https://boulangerie.example/sitemap.xml": page("https://boulangerie.example/sitemap.xml",
        "<urlset>" + Array.from({ length: 30 }, (_, i) => `<url><loc>https://boulangerie.example/p${i}</loc></url>`).join("") + "</urlset>",
        { headers: { "content-type": "application/xml" } }),
    };
    for (let i = 0; i < 30; i += 1) {
      routes[`https://boulangerie.example/p${i}`] = page(`https://boulangerie.example/p${i}`, GOOD_HTML.replace("Pain artisanal", `Page ${i} artisanal`));
    }
    const web = fakeWeb(routes);
    const result = await runAudit("https://www.Boulangerie.example/", { fetcher: web.fetcher });
    assert.equal(result.host, "boulangerie.example");
    assert.equal(result.pages.length, MAX_PAGES);
    assert.equal(result.site.sitemapFound, true);
    assert.equal(result.site.httpRedirectsToHttps, true);
    assert.ok(web.calls.every((url) => new URL(url).hostname.endsWith("boulangerie.example")));
    assert.ok(!web.calls.some((url) => url.includes("other.example")));
    assert.ok(result.score >= 90, `score ${result.score}`);
  });

  await check("an unreachable site produces a critical result, not a crash", async () => {
    const web = fakeWeb({});
    const result = await runAudit("down.example", { fetcher: web.fetcher });
    assert.equal(result.site.httpsReachable, false);
    assert.ok(result.issues.some((i) => i.checkKey === "https_unavailable"));
    assert.ok(result.score < 80);
  });

  await check("host input is normalized and junk is rejected", () => {
    assert.equal(normalizeHost("HTTPS://WWW.Example.CA/path?x=1"), "example.ca");
    assert.equal(normalizeHost("example.ca"), "example.ca");
    for (const bad of ["", "localhost", "127.0.0.1", "exa mple.ca", "-bad.ca", "a".repeat(300) + ".ca"]) {
      assert.equal(normalizeHost(bad), null, bad);
    }
    const match = hostMatcher("example.ca");
    assert.equal(match("www.example.ca"), true);
    assert.equal(match("example.ca.evil.com"), false);
    assert.equal(match("evil-example.ca"), false);
  });

  // Minimal in-memory DB for the service.
  function fakeDb(state: { domains?: string[]; brands?: { name: string; website: string | null }[]; running?: number; today?: number }) {
    const audits: Record<string, unknown>[] = [];
    const issues: Record<string, unknown>[] = [];
    const db = {
      domainAsset: { findMany: async () => (state.domains ?? []).map((domainName) => ({ domainName })) },
      businessBrand: { findMany: async () => (state.brands ?? []).filter((b) => b.website) },
      seoAudit: {
        count: async ({ where }: { where: { status?: string } }) =>
          where.status === "running" ? state.running ?? 0 : state.today ?? 0,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const row = { ...data, id: `audit-${audits.length + 1}` };
          audits.push(row);
          return { id: row.id };
        },
        update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
          const row = audits.find((a) => a.id === where.id)!;
          Object.assign(row, data);
          return row;
        },
      },
      seoAuditIssue: {
        createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
          issues.push(...data);
          return { count: data.length };
        },
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    return { db: db as never, audits, issues };
  }

  await check("workspace sites come from its domains and brand websites only", async () => {
    const { db } = fakeDb({
      domains: ["Boulangerie.example", "www.boulangerie.example"],
      brands: [{ name: "Café", website: "https://cafe.example/menu" }, { name: "None", website: null }],
    });
    const sites = await listWorkspaceSites(db, "client-1");
    assert.deepEqual(sites.map((s) => s.host), ["boulangerie.example", "cafe.example"]);
  });

  await check("service refuses foreign sites, concurrent runs and the daily cap", async () => {
    const base = { clientId: "client-1", profileId: null, fetcher: fakeWeb({}).fetcher };
    assert.deepEqual(
      await startSeoAudit(fakeDb({ domains: ["boulangerie.example"] }).db, { ...base, host: "google.com" }),
      { ok: false, reason: "not_workspace_site" },
    );
    assert.deepEqual(
      await startSeoAudit(fakeDb({ domains: ["boulangerie.example"] }).db, { ...base, host: "localhost" }),
      { ok: false, reason: "invalid_host" },
    );
    assert.deepEqual(
      await startSeoAudit(fakeDb({ domains: ["boulangerie.example"], running: 1 }).db, { ...base, host: "boulangerie.example" }),
      { ok: false, reason: "busy" },
    );
    assert.deepEqual(
      await startSeoAudit(fakeDb({ domains: ["boulangerie.example"], today: DAILY_AUDIT_LIMIT }).db, { ...base, host: "boulangerie.example" }),
      { ok: false, reason: "daily_limit" },
    );
  });

  await check("a completed audit stores score and tenant-scoped issues", async () => {
    const fake = fakeDb({ domains: ["bad.example"] });
    const web = fakeWeb({ "https://bad.example/": page("https://bad.example/", BAD_HTML) });
    const result = await startSeoAudit(fake.db, { clientId: "client-1", profileId: "p1", host: "bad.example", fetcher: web.fetcher });
    assert.equal(result.ok && result.status, "completed");
    assert.equal(fake.audits[0].status, "completed");
    assert.equal(typeof fake.audits[0].score, "number");
    assert.ok(fake.issues.length > 0);
    assert.ok(fake.issues.every((issue) => issue.clientId === "client-1" && issue.auditId === "audit-1"));
  });

  await check("API route is permission-gated, origin-checked and bounded", () => {
    const route = readFileSync("src/app/api/seo/audits/route.ts", "utf8");
    assert.match(route, /requireWorkspaceApiPermission\("manage_brands"\)/);
    assert.match(route, /readJsonBody\(request, 2_048\)/);
    assert.match(route, /clientId: gate\.access\.activeClientId/);
    assert.doesNotMatch(route, /clientId:\s*body/);
  });

  console.log(`\n${passed} SEO audit checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
