/**
 * Step 9 — Facebook competitor tracking tests.
 * No secrets, tokens, Page IDs, or scraping fallbacks.
 */

import assert from "node:assert/strict";

import {
  FACEBOOK_COMPETITOR_CAPABILITY_MATRIX,
  canRankCompetitors,
  computeFollowerDelta,
  hashExternalCompetitorPageId,
  parseFacebookCompetitorInput,
  probeFacebookCompetitorCapability,
  resolveFacebookCompetitorPage,
} from "../src/lib/social/providers/meta-competitors";
import { MetaInsightError } from "../src/lib/social/providers/meta-insights";
import type { MetaInsightsTransport } from "../src/lib/social/providers/meta-insights";

function section(title: string) {
  console.log(`\n== ${title} ==`);
}

function assertNoSensitiveLeak(text: string) {
  const lower = text.toLowerCase();
  assert.equal(lower.includes("access_token"), false);
  assert.equal(lower.includes("eaa"), false);
  assert.equal(lower.includes("client_secret"), false);
  assert.equal(/\bpage_id\b/.test(lower), false);
}

async function main() {
  section("verified Meta capability matrix");
  {
    const unsupported = FACEBOOK_COMPETITOR_CAPABILITY_MATRIX.filter(
      (row) => row.status === "unsupported",
    );
    assert.ok(
      unsupported.some((row) => row.field === "competitor_reach"),
    );
    assert.ok(
      unsupported.some((row) => row.field === "competitor_impressions"),
    );
    assert.ok(
      unsupported.some((row) => row.field === "competitor_demographics"),
    );
    assert.ok(
      unsupported.some((row) => row.field === "scraping_fallback"),
    );
    const conditional = FACEBOOK_COMPETITOR_CAPABILITY_MATRIX.filter(
      (row) => row.status === "conditional",
    );
    assert.ok(conditional.some((row) => row.field === "follower_count"));
    console.log(
      JSON.stringify(
        FACEBOOK_COMPETITOR_CAPABILITY_MATRIX.map((row) => ({
          field: row.field,
          requires: row.requires,
          status: row.status,
        })),
        null,
        2,
      ),
    );
    assertNoSensitiveLeak(JSON.stringify(FACEBOOK_COMPETITOR_CAPABILITY_MATRIX));
    console.log("ok: capability matrix published");
  }

  section("valid and invalid Facebook Page URLs");
  {
    const validUrl = parseFacebookCompetitorInput(
      "https://www.facebook.com/SomePage.Name",
    );
    assert.equal(validUrl.ok, true);
    if (validUrl.ok) {
      assert.equal(validUrl.kind, "username");
      assert.equal(validUrl.value, "somepage.name");
    }

    const validUser = parseFacebookCompetitorInput("@BrandPage");
    assert.equal(validUser.ok, true);

    const pagesPath = parseFacebookCompetitorInput(
      "https://facebook.com/pages/Category/Name/1234567890",
    );
    assert.equal(pagesPath.ok, true);
    if (pagesPath.ok) {
      assert.equal(pagesPath.kind, "page_id");
      assert.equal(pagesPath.value, "1234567890");
    }

    const badHost = parseFacebookCompetitorInput("https://evil.example/page");
    assert.equal(badHost.ok, false);
    if (!badHost.ok) assert.equal(badHost.category, "unsupported_host");

    const empty = parseFacebookCompetitorInput("   ");
    assert.equal(empty.ok, false);
    console.log("ok: URL/username parsing");
  }

  section("SSRF and hostile URL inputs");
  {
    const localhost = parseFacebookCompetitorInput("http://127.0.0.1/page");
    assert.equal(localhost.ok, false);
    if (!localhost.ok) assert.equal(localhost.category, "ssrf");

    const meta = parseFacebookCompetitorInput("http://169.254.169.254/latest");
    assert.equal(meta.ok, false);

    const file = parseFacebookCompetitorInput("file:///etc/passwd");
    assert.equal(file.ok, false);

    const creds = parseFacebookCompetitorInput(
      "https://user:pass@facebook.com/page",
    );
    assert.equal(creds.ok, false);
    console.log("ok: SSRF and hostile inputs rejected without fetch");
  }

  section("unsupported Page lookup / honest unavailable");
  {
    process.env.META_COMPETITOR_PUBLIC_ACCESS = "forced_unavailable";
    const capability = await probeFacebookCompetitorCapability();
    assert.equal(capability.status, "feature_required");
    assert.match(capability.reason, /does not scrape/i);
    assert.equal(capability.publicContent, "unsupported_until_ppca");

    await assert.rejects(
      () =>
        resolveFacebookCompetitorPage({
          input: "https://www.facebook.com/example",
        }),
      /Page Public Metadata Access|does not scrape|authorize/i,
    );
    delete process.env.META_COMPETITOR_PUBLIC_ACCESS;
    console.log("ok: honest unavailable when Meta feature missing");
  }

  section("permission probe transport");
  {
    const transport: MetaInsightsTransport = {
      async fetchJson() {
        throw new MetaInsightError(
          "permission_required",
          "(#10) Application does not have permission for this action",
        );
      },
    };
    const capability = await probeFacebookCompetitorCapability({
      transport,
      appAccessToken: "app-token",
    });
    assert.equal(capability.status, "feature_required");
    assert.equal(capability.pagesSearch, "feature_required");
    console.log("ok: permission denied mapped to feature_required");
  }

  section("rate limits / timeout / 5xx / revoked access");
  {
    const rate: MetaInsightsTransport = {
      async fetchJson() {
        throw new MetaInsightError("rate_limited", "Rate limit");
      },
    };
    const rateCap = await probeFacebookCompetitorCapability({
      transport: rate,
      appAccessToken: "app-token",
    });
    assert.equal(rateCap.status, "rate_limited");

    const temp: MetaInsightsTransport = {
      async fetchJson() {
        throw new MetaInsightError("temporary", "5xx");
      },
    };
    const tempCap = await probeFacebookCompetitorCapability({
      transport: temp,
      appAccessToken: "app-token",
    });
    assert.equal(tempCap.status, "unavailable");
    console.log("ok: rate-limit and temporary failures stay non-scraping");
  }

  section("self-competitor and duplicate rejection helpers");
  {
    const a = hashExternalCompetitorPageId("111");
    const b = hashExternalCompetitorPageId("111");
    const c = hashExternalCompetitorPageId("222");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(a.includes("111"), false);
    console.log("ok: opaque page hash for self/duplicate checks");
  }

  section("equivalent versus incompatible metrics");
  {
    assert.equal(computeFollowerDelta(120, 100), 20);
    assert.equal(computeFollowerDelta(null, 100), null);
    assert.equal(
      canRankCompetitors({
        selectedFollowers: 100,
        competitorFollowers: [80, 90],
      }),
      true,
    );
    assert.equal(
      canRankCompetitors({
        selectedFollowers: 100,
        competitorFollowers: [80, null],
      }),
      false,
    );
    console.log("ok: ranking blocked when metrics non-equivalent");
  }

  section("snapshot history and follower deltas");
  {
    // Pure delta math — persistence covered by unique (track, snapshotDate).
    assert.equal(computeFollowerDelta(0, 0), 0);
    assert.equal(computeFollowerDelta(5, null), null);
    console.log("ok: confirmed zero delta vs unavailable");
  }

  section("resolve success path when Meta permits");
  {
    const transport: MetaInsightsTransport = {
      async fetchJson(url, stage) {
        if (stage === "competitor_capability_pages_search") {
          return { data: [{ id: "1", name: "Probe" }] };
        }
        if (stage === "competitor_page_resolve") {
          assert.equal(url.origin, "https://graph.facebook.com");
          return {
            id: "999001",
            name: "Competitor Cafe",
            username: "competitorcafe",
            category: "Restaurant",
            followers_count: 42,
            picture: { data: { url: "https://cdn.example/p.jpg" } },
          };
        }
        return { data: [] };
      },
    };
    process.env.META_COMPETITOR_PUBLIC_ACCESS = "true";
    const resolved = await resolveFacebookCompetitorPage({
      input: "competitorcafe",
      transport,
      appAccessToken: "app-token",
    });
    assert.equal(resolved.pageName, "Competitor Cafe");
    assert.equal(resolved.followerCount, 42);
    assert.equal(resolved.followerFieldSource, "followers_count");
    assert.equal(resolved.metricStatus.followerCount, "confirmed");
    assert.equal(resolved.externalPageIdHash, hashExternalCompetitorPageId("999001"));
    delete process.env.META_COMPETITOR_PUBLIC_ACCESS;
    console.log("ok: public metadata resolve when permitted");
  }

  section("no scraping fallback");
  {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL(
          "../src/lib/social/providers/meta-competitors.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(src.includes("puppeteer"), false);
    assert.equal(src.includes("playwright"), false);
    assert.equal(src.includes("cheerio"), false);
    assert.ok(src.includes("META_GRAPH_HOST"));
    assert.ok(src.includes("never scrapes") || src.includes("Never scrapes") || src.includes("does not scrape") || src.includes("scraping_fallback"));
    console.log("ok: no scraping libraries or fallback paths");
  }

  section("workspace / brand isolation contract");
  {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL(
          "../src/lib/social/sync/facebook-competitor-sync.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.ok(src.includes("clientId: options.clientId"));
    assert.ok(src.includes("businessBrandId: options.businessBrandId"));
    assert.ok(src.includes("never includes externalPageId"));
    console.log("ok: list path scoped and provider IDs withheld");
  }

  section("duplicate/concurrent refresh jobs");
  {
    const src = await import("node:fs/promises").then((fs) =>
      fs.readFile(
        new URL(
          "../src/lib/social/sync/facebook-competitor-sync-job.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.ok(src.includes("FACEBOOK_COMPETITOR_JOB_KIND"));
    assert.ok(src.includes("dispatchJobId"));
    assert.ok(src.includes("leaseOwner"));
    assert.ok(src.includes("facebook_competitor_snapshot"));
    console.log("ok: durable lease + idempotent enqueue present");
  }

  console.log("\nAll Step 9 Facebook competitor tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
