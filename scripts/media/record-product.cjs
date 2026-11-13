/*
 * Records short product tours of the real TAKATAK app (TAK bot studio and the
 * client dashboard) for the homepage, then encodes them with ffmpeg.
 *
 *   node scripts/media/record-product.cjs http://localhost:3000
 *
 * Needs a running app (npm run dev) and ffmpeg. Writes public/media/product/
 * {takbot-fr,takbot-en,dashboard}.mp4 and .jpg posters. Developer-only
 * overlays are hidden; nothing on the page is edited or invented.
 */
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const BASE = process.argv[2] || "http://localhost:3000";
const OUT = path.join(__dirname, "..", "..", "public", "media", "product");
const W = 1440;
const H = 900;

const HIDE = `
  nextjs-portal, [data-nextjs-toast], #__next-build-watcher { display: none !important; }
  .tk-promo-bar, [data-promo-invite], [aria-label="Talk to TAKATAK"], [data-chat-launcher] { display: none !important; }
`;

async function tour(browser, name, locale, steps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `tour-${name}-`));
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale, recordVideo: { dir, size: { width: W, height: H } } });
  const page = await ctx.newPage();
  await steps(page);
  const video = page.video();
  await ctx.close();
  return video.path();
}

function hideDevBits(page) {
  return page.addStyleTag({ content: HIDE }).then(() =>
    page.evaluate(() => {
      // The dev-only "Authentication is not configured" strip in the dashboard.
      for (const el of document.querySelectorAll("div,p")) {
        const t = el.textContent || "";
        if (/Authentication is not configured|Mock foundation data/.test(t) && el.children.length <= 2 && t.length < 140) el.style.display = "none";
      }
      // Floating chat launcher and promo pop-ups are not part of the product screen.
      for (const el of document.querySelectorAll("button,a,div")) {
        const t = (el.textContent || "").trim();
        if (/^(Talk to TAKATAK|Parler à TAKATAK)$/.test(t)) el.style.display = "none";
      }
    }),
  );
}

async function typeSlow(page, locator, text) {
  await locator.click();
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(28);
  }
}

async function takbot(page, lang) {
  await page.goto(`${BASE}/takbot`, { waitUntil: "networkidle" });
  await hideDevBits(page);
  // Film the tool itself: the page headline above it is left out of the frame.
  await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    if (!h1) return;
    for (const el of [h1.previousElementSibling, h1, h1.nextElementSibling]) if (el) el.style.visibility = "hidden";
  });
  const box = page.locator("textarea").first();
  await box.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(900);
  const write = page.getByRole("button", { name: lang === "fr" ? /^Rédiger$|^Écrire$/ : /^Write$/ }).first();
  if (await write.count()) await write.click().catch(() => {});
  await page.waitForTimeout(500);
  await typeSlow(page, box, lang === "fr" ? "Écris 3 publications Instagram pour notre nouveau menu d'automne" : "Write 3 Instagram posts for our new fall menu");
  await page.waitForTimeout(600);
  const engine = page.getByRole("button", { name: /Engine|Moteur/ }).first();
  if (await engine.count()) {
    await engine.click().catch(() => {});
    await page.waitForTimeout(1600);
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(500);
  for (const label of lang === "fr" ? [/^Recherche$/, /^Image$/] : [/^Research$/, /^Image$/]) {
    const b = page.getByRole("button", { name: label }).first();
    if (await b.count()) {
      await b.click().catch(() => {});
      await page.waitForTimeout(900);
    }
  }
  const write2 = page.getByRole("button", { name: lang === "fr" ? /^Rédiger$/ : /^Write$/ }).first();
  if (await write2.count()) await write2.click().catch(() => {});
  await page.waitForTimeout(1400);
}

async function dashboard(page) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await hideDevBits(page);
  await page.waitForTimeout(1200);
  for (const label of ["Social Media", "Reviews"]) {
    const item = page.getByRole("link", { name: label }).first();
    if (await item.count()) {
      await item.hover().catch(() => {});
      await page.waitForTimeout(450);
    }
  }
  await page.getByRole("link", { name: "Growth Hub" }).first().click();
  await page.waitForLoadState("networkidle");
  await hideDevBits(page);
  await page.waitForTimeout(1600);
  await page.mouse.move(800, 520);
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(1600);
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(1600);
}

function encode(src, name, crop, width = 1280) {
  const mp4 = path.join(OUT, `${name}.mp4`);
  const vf = [crop ? `crop=${crop}` : null, `scale=${width}:-2`, "fps=30"].filter(Boolean).join(",");
  // Skip the first second (page load), keep it short and light.
  execFileSync("ffmpeg", ["-y", "-ss", "1.2", "-i", src, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4], { stdio: "ignore" });
  execFileSync("ffmpeg", ["-y", "-ss", "3.5", "-i", mp4, "-frames:v", "1", "-q:v", "4", path.join(OUT, `${name}.jpg`)], { stdio: "ignore" });
  console.log(name, (fs.statSync(mp4).size / 1024).toFixed(0), "KB");
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const fr = await tour(browser, "takbot-fr", "fr-CA", (p) => takbot(p, "fr"));
  const en = await tour(browser, "takbot-en", "en-CA", (p) => takbot(p, "en"));
  const dash = await tour(browser, "dashboard", "en-CA", dashboard);
  await browser.close();
  // TAK bot: just the studio (prompt, modes, engine list), 880×560 around it.
  encode(fr, "takbot-fr", "880:560:280:130", 880);
  encode(en, "takbot-en", "880:560:280:130", 880);
  encode(dash, "dashboard", null);
})();
