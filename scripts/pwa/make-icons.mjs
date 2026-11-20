#!/usr/bin/env node
// Builds the installable-app icons (PWA, Google Play, Microsoft Store, App Store) from one source.
// Source: knowledgeAI/brand/logo-circle.png when the owner has uploaded it (pass its path as the
// first argument), otherwise the interim scripts/pwa/app-icon.svg drawn from BRAND.md colours.
//   node scripts/pwa/make-icons.mjs [path/to/logo-circle.png]
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const source = process.argv[2] ?? path.join(root, "scripts/pwa/app-icon.svg");
const navy = { r: 6, g: 13, b: 31, alpha: 1 };
const out = (name) => path.join(root, "public/icons", name);
mkdirSync(path.join(root, "public/icons"), { recursive: true });

async function square(size, file, { padding = 0 } = {}) {
  const inner = Math.round(size * (1 - padding * 2));
  const art = await sharp(source, { density: 384 }).resize(inner, inner, { fit: "contain", background: navy }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: navy } })
    .composite([{ input: art, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(file);
}

await square(192, out("icon-192.png"));
await square(512, out("icon-512.png"));
// Android crops "maskable" icons to a circle or squircle: keep the art inside the safe zone.
await square(512, out("icon-maskable-512.png"), { padding: 0.1 });
await square(180, out("apple-touch-icon.png"));
await square(32, out("favicon-32.png"));
// Next.js serves src/app/icon.png and apple-icon.png as the site icons (and push notifications use /icon.png).
await square(192, path.join(root, "src/app/icon.png"));
await square(180, path.join(root, "src/app/apple-icon.png"));
console.log(`Icons written from ${path.relative(root, source)}`);
