/*
 * Still pictures of real TAKATAK dashboard modules for the homepage product
 * cards. Needs a running app; developer-only overlays are hidden.
 *
 *   node scripts/media/capture-product-shots.cjs http://localhost:3000
 *
 * shot-academy.webp comes from the TAKATAK Academy app itself (repo
 * takatakca/ACADEMYTAKATAK, `npm run dev`): its home page, top 1440×750.
 */
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "..", "public", "media", "product");

const SHOTS = [
  // name, path, clip within a 1440×900 page (x, y, w, h)
  ["seo", "/dashboard/seo", { x: 280, y: 110, width: 1140, height: 640 }],
  ["reviews", "/dashboard/growth/reviews", { x: 280, y: 110, width: 1140, height: 700 }],
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  for (const [name, url, clip] of SHOTS) {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("div,p")) {
        const t = el.textContent || "";
        if (/Authentication is not configured|Mock foundation data/.test(t) && el.children.length <= 2 && t.length < 140) el.remove();
      }
    });
    await page.waitForTimeout(500);
    const png = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: png, clip });
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", png, "-vf", "scale=1400:-2", "-q:v", "80", path.join(OUT, `shot-${name}.webp`)]);
    execFileSync("rm", ["-f", png]);
    console.log("shot", name);
  }
  await browser.close();
})();
