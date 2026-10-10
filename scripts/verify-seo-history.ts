// TK-022: weekly re-audit selection, score history, and a white-label PDF.
// Run: npm run qa:seo-history
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  auditKey,
  dueUrls,
  isDue,
  latestByUrl,
  parseSeoScore,
  REAUDIT_AFTER_MS,
  snapshotMetadata,
  whiteLabelLines,
  type SeoScoreSnapshot,
} from "../src/lib/seo/score-history";
import { pdfEscape, textPdf } from "../src/lib/seo/text-pdf";

let passed = 0;

function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`ok ${name}`);
}

function row(partial: Partial<SeoScoreSnapshot> & Pick<SeoScoreSnapshot, "id" | "url" | "auditedAt">): SeoScoreSnapshot {
  return {
    score: 80,
    title: "Titre",
    checks: [],
    ...partial,
  };
}

check("urls group without a trailing slash", () => {
  assert.equal(auditKey("https://Example.com/menu/"), "https://example.com/menu");
  assert.equal(auditKey("https://example.com"), "https://example.com/");
});

check("only the newest score per site is kept", () => {
  const latest = latestByUrl([
    row({ id: "old", url: "https://example.com/menu/", auditedAt: "2026-10-01T00:00:00.000Z", score: 40 }),
    row({ id: "new", url: "https://example.com/menu", auditedAt: "2026-10-08T00:00:00.000Z", score: 90 }),
    row({ id: "other", url: "https://other.test/", auditedAt: "2026-10-02T00:00:00.000Z", score: 70 }),
  ]);
  assert.deepEqual(
    latest.map((item) => item.id),
    ["new", "other"],
  );
});

check("a site is due seven days after its latest score", () => {
  const now = new Date("2026-10-10T00:00:00.000Z");
  assert.equal(isDue("2026-10-03T00:00:00.000Z", now), true);
  assert.equal(isDue("2026-10-04T00:00:00.000Z", now), false);
  assert.equal(REAUDIT_AFTER_MS, 7 * 24 * 60 * 60 * 1000);
  const due = dueUrls(
    [
      row({ id: "a", url: "https://due.test/", auditedAt: "2026-10-01T00:00:00.000Z" }),
      row({ id: "b", url: "https://fresh.test/", auditedAt: "2026-10-09T00:00:00.000Z" }),
    ],
    now,
  );
  assert.deepEqual(due, ["https://due.test/"]);
  const oldestFirst = dueUrls(
    [1, 2, 3, 4].map((day) =>
      row({ id: `d${day}`, url: `https://site${day}.test/`, auditedAt: `2026-09-0${day}T00:00:00.000Z` }),
    ),
    now,
  );
  assert.deepEqual(oldestFirst, ["https://site1.test/", "https://site2.test/", "https://site3.test/"]);
});

check("a stored summary drops the page HTML and rejects a bad score", () => {
  const metadata = snapshotMetadata({
    requestedUrl: "https://example.com/a/",
    score: 82,
    auditedAt: "2026-10-10T12:00:00.000Z",
    facts: { title: "Bonjour" },
    checks: [{ id: "title", label: "Title", status: "pass", detail: "Present" }],
  });
  assert.equal(metadata?.url, "https://example.com/a");
  assert.equal("html" in (metadata ?? {}), false);
  assert.equal(parseSeoScore("id-1", metadata)?.score, 82);
  assert.equal(parseSeoScore("id-2", { url: "https://example.com/", score: 101, auditedAt: "2026-10-10T00:00:00.000Z" }), null);
});

check("the PDF is a client document without the product name", () => {
  const lines = whiteLabelLines(
    row({
      id: "id-1",
      url: "https://boulangerie.test/",
      auditedAt: "2026-10-10T12:00:00.000Z",
      score: 82,
      title: "Boulangerie",
      checks: [{ id: "title", label: "Title", status: "warn", detail: "Court" }],
    }),
    "Boulangerie du coin",
  );
  const joined = lines.join("\n");
  assert.match(joined, /Préparé pour : Boulangerie du coin/);
  assert.match(joined, /Score : 82 \/ 100/);
  assert.match(joined, /À revoir/);
  assert.doesNotMatch(joined, /TAKATAK/);
  const pdf = textPdf(lines);
  assert.equal(pdf.subarray(0, 8).toString("latin1"), "%PDF-1.4");
  assert.match(pdf.toString("latin1"), /\\351/);
  assert.equal(pdfEscape("é"), "\\351");
});

check("history is scoped to the workspace and adds no migration", () => {
  const store = readFileSync("src/lib/seo/score-store.ts", "utf8");
  const action = readFileSync("src/app/dashboard/seo/actions.ts", "utf8");
  const route = readFileSync("src/app/dashboard/seo/history/pdf/route.ts", "utf8");
  assert.match(store, /clientId/);
  assert.match(store, /SEO_SCORE_ACTION/);
  assert.match(action, /access\.mode === "client_scoped"/);
  assert.match(action, /dueUrls/);
  assert.match(route, /access\.mode !== "client_scoped"/);
  assert.doesNotMatch(store, /prisma\/migrations|\$executeRaw/);
});

console.log(`\n${passed} seo history checks passed`);
