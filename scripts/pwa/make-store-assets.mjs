#!/usr/bin/env node
// Store listing images for every app store (Google Play, Apple, Microsoft, Amazon, Samsung, Huawei, TVs),
// built from the app icon (public/icons/icon-512.png) and BRAND.md colours. Output: docs/store-assets/.
//   node scripts/pwa/make-store-assets.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const dir = path.join(root, "docs/store-assets");
mkdirSync(dir, { recursive: true });
const icon = path.join(root, "public/icons/icon-512.png");
const navy = { r: 6, g: 13, b: 31, alpha: 1 };

async function iconAt(size, file) {
  // Store icons must be opaque (Apple rejects transparency).
  await sharp(icon).resize(size, size).flatten({ background: navy }).png({ compressionLevel: 9 }).toFile(path.join(dir, file));
}

function backdrop(width, height, { text = true } = {}) {
  const big = Math.round(Math.min(width * 0.09, height * 0.2));
  const iconSize = Math.round(Math.min(height * 0.42, width * 0.3));
  const textX = text ? Math.round(width * 0.08 + iconSize + width * 0.04) : 0;
  // The tagline (32 letters, spaced) must fit between the text start and the right margin.
  const small = Math.round(Math.min(big * 0.32, (width * 0.95 - textX) / (32 * 0.82)));
  return {
    iconSize,
    iconLeft: text ? Math.round(width * 0.08) : Math.round((width - iconSize) / 2),
    iconTop: Math.round((height - iconSize) / 2),
    svg: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <radialGradient id="g" cx="25%" cy="45%" r="75%"><stop offset="0" stop-color="#0B1B3D"/><stop offset="1" stop-color="#060D1F"/></radialGradient>
    <radialGradient id="h" cx="85%" cy="15%" r="45%"><stop offset="0" stop-color="#1F8BFF" stop-opacity="0.35"/><stop offset="1" stop-color="#1F8BFF" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#h)"/>
  ${text ? `<text x="${textX}" y="${Math.round(height / 2 - small * 0.2)}" font-family="Montserrat, 'DejaVu Sans', sans-serif" font-weight="800" font-size="${big}" fill="#F5F8FC" letter-spacing="${Math.round(big * 0.04)}">TAKATAK</text>
  <text x="${textX + 4}" y="${Math.round(height / 2 + small * 1.6)}" font-family="Montserrat, 'DejaVu Sans', sans-serif" font-weight="700" font-size="${small}" fill="#29C3FF" letter-spacing="${Math.round(small * 0.15)}">DIGITAL SOLUTIONS. REAL RESULTS.</text>` : ""}
</svg>`),
  };
}

async function banner(width, height, file, options) {
  const { svg, iconSize, iconLeft, iconTop } = backdrop(width, height, options);
  // Round cut-out of the icon so its square navy edge does not show on the gradient.
  const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize}" height="${iconSize}"><circle cx="${iconSize / 2}" cy="${iconSize / 2}" r="${iconSize * 0.4}" fill="#fff"/></svg>`);
  const art = await sharp(icon).resize(iconSize, iconSize).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  await sharp(svg).composite([{ input: art, left: iconLeft, top: iconTop }]).flatten({ background: navy }).png({ compressionLevel: 9 }).toFile(path.join(dir, file));
}

await iconAt(512, "google-play-icon-512.png");
await iconAt(1024, "apple-app-icon-1024.png");
await iconAt(300, "microsoft-store-logo-300.png");
await iconAt(114, "amazon-icon-114.png");
await iconAt(512, "amazon-icon-512.png");
await iconAt(512, "samsung-galaxy-icon-512.png");
await iconAt(216, "huawei-icon-216.png");
await banner(1024, 500, "google-play-feature-1024x500.png");
await banner(1024, 500, "samsung-galaxy-feature-1024x500.png");
await banner(1280, 720, "google-tv-banner-1280x720.png");
await banner(320, 180, "android-tv-banner-320x180.png");
await banner(1280, 720, "amazon-firetv-banner-1280x720.png");
await banner(1920, 1080, "amazon-firetv-background-1920x1080.png", { text: false });
await banner(1920, 1080, "microsoft-xbox-hero-1920x1080.png");
await banner(1920, 1080, "samsung-lg-tv-1920x1080.png");
await banner(1080, 1080, "microsoft-boxart-1x1-1080.png", { text: false });
await banner(2160, 2160, "microsoft-boxart-1x1-2160.png", { text: false });
await banner(720, 1080, "microsoft-poster-2x3-720x1080.png", { text: false });
await banner(1440, 2160, "microsoft-poster-2x3-1440x2160.png", { text: false });
console.log("Store images written to docs/store-assets/");
