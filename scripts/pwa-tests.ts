// Installable app (PWA) and store packages: manifest, icons, screenshots, service worker, Android link.
// Run: npm run qa:pwa
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { androidAssetLinks, PWA_APP_ID, takatakManifest } from "../src/lib/pwa/manifest";
import { TV_AGENT, TV_BACK_KEY_CODES, tvModeWanted } from "../src/lib/pwa/tv-mode";

const root = process.cwd();
const publicFile = (url: string) => path.join(root, "public", url.replace(/^\//, ""));

function pngSize(file: string) {
  const bytes = readFileSync(file);
  assert.equal(bytes.subarray(1, 4).toString("latin1"), "PNG", `${file} is not a PNG`);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

const manifest = takatakManifest();

// Brand and install basics (BRAND.md: TAKATAK, navy ground).
assert.equal(manifest.short_name, "TAKATAK");
assert.ok(String(manifest.name).startsWith("TAKATAK"));
assert.equal(manifest.display, "standalone");
assert.equal(manifest.scope, "/");
assert.equal(manifest.id, "/");
assert.equal(manifest.theme_color, "#060D1F");
assert.ok(String(manifest.start_url).startsWith("/"));

// Icons: 192 and 512 "any", plus a 512 "maskable" for Android; every file exists at its declared size.
const icons = manifest.icons ?? [];
for (const [size, purpose] of [["192x192", "any"], ["512x512", "any"], ["512x512", "maskable"]] as const) {
  assert.ok(icons.some((icon) => icon.sizes === size && icon.purpose === purpose), `missing ${size} ${purpose} icon`);
}
for (const icon of icons) assert.equal(pngSize(publicFile(icon.src)), icon.sizes, icon.src);
assert.equal(pngSize(publicFile("/icons/apple-touch-icon.png")), "180x180");

// Store screenshots: at least one phone (narrow) and one computer (wide), real files at the declared size.
const shots = manifest.screenshots ?? [];
assert.ok(shots.some((shot) => shot.form_factor === "narrow"));
assert.ok(shots.some((shot) => shot.form_factor === "wide"));
for (const shot of shots) assert.equal(pngSize(publicFile(shot.src)), shot.sizes, shot.src);

// Shortcuts point inside the app.
for (const shortcut of manifest.shortcuts ?? []) assert.ok(shortcut.url.startsWith("/") && !shortcut.url.startsWith("//"));

// Service worker: one worker for the app and the deal alerts, offline page only, no private data cached.
const sw = readFileSync(publicFile("/takatak-push-sw.js"), "utf8");
assert.match(sw, /addEventListener\("fetch"/);
assert.match(sw, /request\.mode !== "navigate"/);
assert.match(sw, /addEventListener\("push"/);
assert.doesNotMatch(sw, /cache\.put\(/, "the worker must not store pages or API answers");
assert.ok(existsSync(publicFile("/offline.html")));
for (const url of sw.match(/"\/(?:offline\.html|icons\/[^"]+)"/g) ?? []) assert.ok(existsSync(publicFile(JSON.parse(url))), url);

// Android Digital Asset Links: off (404) until a valid Play signing fingerprint is configured.
const fingerprint = Array.from({ length: 32 }, (_, i) => (i * 7 % 256).toString(16).padStart(2, "0").toUpperCase()).join(":");
assert.equal(androidAssetLinks({}), null);
assert.equal(androidAssetLinks({ TAKATAK_ANDROID_CERT_SHA256: "not-a-fingerprint" }), null);
assert.equal(androidAssetLinks({ TAKATAK_ANDROID_CERT_SHA256: fingerprint, TAKATAK_ANDROID_PACKAGE: "Bad Package" }), null);
assert.equal(androidAssetLinks({ TAKATAK_ANDROID_CERT_SHA256: [fingerprint, fingerprint, fingerprint, fingerprint, fingerprint].join(",") }), null);
const links = androidAssetLinks({ TAKATAK_ANDROID_CERT_SHA256: ` ${fingerprint.toLowerCase()} ` });
assert.ok(links);
assert.equal(links[0].target.package_name, PWA_APP_ID);
assert.deepEqual(links[0].target.sha256_cert_fingerprints, [fingerprint]);
assert.deepEqual(links[0].relation, ["delegate_permission/common.handle_all_urls"]);

// CSP: the manifest and the service worker may only come from takatak.ca.
const config = readFileSync(path.join(root, "next.config.ts"), "utf8");
assert.match(config, /manifest-src 'self'/);
assert.match(config, /worker-src 'self'/);

// TV mode: on for smart-TV browsers or ?tv=1, off with ?tv=0, remembered choice wins over the browser.
for (const ua of ["Mozilla/5.0 (SMART-TV; Linux; Tizen 7.0)", "Mozilla/5.0 (Web0S; Linux/SmartTV)", "Mozilla/5.0 (Linux; Android 9; AFTMM Build)", "Mozilla/5.0 (Windows NT 10.0; Xbox; Xbox One)"]) {
  assert.ok(TV_AGENT.test(ua), ua);
}
const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130";
assert.deepEqual(tvModeWanted("", desktop, null), { tv: false, remember: null });
assert.deepEqual(tvModeWanted("?tv=1", desktop, null), { tv: true, remember: "1" });
assert.deepEqual(tvModeWanted("?tv=0", "Mozilla/5.0 (SMART-TV; Tizen)", "1"), { tv: false, remember: "0" });
assert.deepEqual(tvModeWanted("", desktop, "1"), { tv: true, remember: null });
assert.ok(TV_BACK_KEY_CODES.has(10009) && TV_BACK_KEY_CODES.has(461));

// Store images for every store are in docs/store-assets at the size each store asks for.
const assets: Record<string, string> = {
  "google-play-icon-512.png": "512x512",
  "google-play-feature-1024x500.png": "1024x500",
  "apple-app-icon-1024.png": "1024x1024",
  "microsoft-store-logo-300.png": "300x300",
  "microsoft-poster-2x3-1440x2160.png": "1440x2160",
  "android-tv-banner-320x180.png": "320x180",
  "google-tv-banner-1280x720.png": "1280x720",
  "huawei-icon-216.png": "216x216",
  "screenshots/apple-iphone-6.9-1-accueil.png": "1320x2868",
  "screenshots/apple-ipad-13-1-accueil.png": "2064x2752",
  "screenshots/android-tablet-10-1-accueil.png": "2560x1600",
  "screenshots/desktop-1920x1080-1-accueil.png": "1920x1080",
  "screenshots/tv-1920x1080-1-accueil.png": "1920x1080",
};
for (const [file, size] of Object.entries(assets)) assert.equal(pngSize(path.join(root, "docs/store-assets", file)), size, file);

console.log("PWA checks passed: manifest, icons, screenshots, service worker, CSP, TV mode, store images, Android asset links.");
