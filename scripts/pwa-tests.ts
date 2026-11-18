// Installable app (PWA) and store packages: manifest, icons, screenshots, service worker, Android link.
// Run: npm run qa:pwa
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { androidAssetLinks, PWA_APP_ID, takatakManifest } from "../src/lib/pwa/manifest";

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

console.log("PWA checks passed: manifest, icons, screenshots, service worker, Android asset links.");
