#!/usr/bin/env node
// Store screenshots (phone, tablet, computer, TV) of PUBLIC pages only: no client data.
// Start the site first (npm run dev -- --port 3000), then:
//   node scripts/pwa/store-screenshots.cjs [http://127.0.0.1:3000]
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = process.argv[2] || "http://127.0.0.1:3000";
const out = path.join(process.cwd(), "docs/store-assets/screenshots");
mkdirSync(out, { recursive: true });
const pages = [["1-accueil", "/"], ["2-services", "/services"], ["3-tarifs", "/pricing"], ["4-contact", "/contact"]];
const devices = [
  ["apple-iphone-6.9", { width: 440, height: 956 }, 3, ""],
  ["apple-ipad-13", { width: 1032, height: 1376 }, 2, ""],
  ["android-tablet-10", { width: 1280, height: 800 }, 2, ""],
  ["desktop-1920x1080", { width: 1920, height: 1080 }, 1, ""],
  ["tv-1920x1080", { width: 1920, height: 1080 }, 1, "tv=1"],
];

(async () => {
  const browser = await chromium.launch();
  for (const [device, viewport, deviceScaleFactor, query] of devices) {
    const context = await browser.newContext({ viewport, deviceScaleFactor });
    for (const [name, url] of pages) {
      const page = await context.newPage();
      await page.goto(`${base}${url}${query ? `?${query}` : ""}`, { waitUntil: "networkidle", timeout: 180000 });
      await page.waitForTimeout(2000);
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
      await page.screenshot({ path: path.join(out, `${device}-${name}.png`) });
      await page.close();
    }
    await context.close();
  }
  await browser.close();
  console.log(`Screenshots written to ${path.relative(process.cwd(), out)}`);
})();
