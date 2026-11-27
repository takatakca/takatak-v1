#!/usr/bin/env node
/**
 * Opens public takatak.ca pages in a real Chromium, in French and in English,
 * and fails when a page breaks in the browser: a script file that does not
 * load, an uncaught page error, or the "Something went wrong" error screen.
 * A plain HTTP probe cannot see these, because the server still answers 200.
 * Read-only: no sign-in, no form is submitted.
 *
 * Usage: node scripts/public-browser-smoke.cjs [base URL]
 * Needs the "playwright" package and its Chromium next to this file
 * (the workflow installs them in a temporary folder).
 */
const { chromium } = require("playwright");

const BASE = (process.argv[2] || process.env.SMOKE_BASE_URL || "https://takatak.ca").replace(/\/+$/, "");
const PAGES = [
  "/",
  "/?lang=fr",
  "/seo",
  "/clover",
  "/foodhub",
  "/hosting",
  "/domain",
  "/takbot",
  "/pricing",
  "/about",
  "/marketplace",
  // Pages with a variable segment in their address ([slug], [category], [gig]).
  "/services/websites",
  "/services/voip",
  "/services/reviews",
  "/marketplace/category/logo_design",
  "/marketplace/gigs/logo-design",
];
const LOCALES = ["fr-CA", "en-CA"];
const ERROR_SCREEN = /something went wrong|une erreur est survenue/i;

async function checkPage(context, path) {
  const page = await context.newPage();
  const problems = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.startsWith(`${BASE}/_next/static/`) && response.status() >= 400) {
      problems.push(`asset ${response.status()}: ${url.slice(BASE.length)}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`page error: ${String(error.message).slice(0, 200)}`));
  let status = 0;
  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 45_000 });
    status = response ? response.status() : 0;
    await page.waitForTimeout(1_000);
  } catch (error) {
    problems.push(`load: ${String(error.message).split("\n")[0].slice(0, 200)}`);
  }
  const view = await page
    .evaluate(() => ({
      lang: document.documentElement.lang,
      h1: ((document.querySelector("h1") || {}).innerText || "").trim().slice(0, 80),
    }))
    .catch(() => ({ lang: "", h1: "" }));
  if (status && status >= 400) problems.push(`HTTP ${status}`);
  if (ERROR_SCREEN.test(view.h1)) problems.push(`error screen: "${view.h1}"`);
  await page.close();
  return { path, status, lang: view.lang, h1: view.h1, problems };
}

async function main() {
  const browser = await chromium.launch();
  let failures = 0;
  try {
    for (const locale of LOCALES) {
      const context = await browser.newContext({ locale });
      for (const path of PAGES) {
        const result = await checkPage(context, path);
        const ok = result.problems.length === 0;
        if (!ok) failures += 1;
        console.log(`${ok ? "ok  " : "FAIL"} ${locale} ${path} · HTTP ${result.status} · html lang=${result.lang} · h1="${result.h1}"`);
        for (const problem of result.problems.slice(0, 5)) console.log(`       ${problem}`);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${failures ? `${failures} page view(s) broken` : "every page loaded in the browser"} (${PAGES.length * LOCALES.length} views, ${BASE})`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
