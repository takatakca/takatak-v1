import type { MetadataRoute } from "next";

// Installable TAKATAK app (PWA): phones, tablets, computers, and the store packages
// (Google Play, Microsoft Store, App Store) built from it with PWABuilder. See docs/APPS-MAGASINS.md.
// Colours come from BRAND.md: deep navy ground, electric blue accent.
export const PWA_THEME_COLOR = "#060D1F";
export const PWA_BACKGROUND_COLOR = "#060D1F";
export const PWA_APP_ID = "ca.takatak.app";

const icon192 = { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" };

export function takatakManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TAKATAK — Digital Solutions. Real Results.",
    short_name: "TAKATAK",
    description:
      "Websites, hosting, marketing, AI tools and your TAKATAK dashboard in one app. Sites Web, hébergement, marketing et IA : votre tableau de bord TAKATAK.",
    lang: "en-CA",
    dir: "ltr",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    // No "window-controls-overlay": the site has no title-bar area, so on Windows/macOS installs
    // the window buttons would cover the header's Menu button. A normal title bar is cleaner.
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons: [
      { ...icon192, purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard / Tableau de bord", short_name: "Dashboard", url: "/dashboard", icons: [icon192] },
      { name: "Services", url: "/services", icons: [icon192] },
      { name: "Deals / Offres", short_name: "Deals", url: "/offres", icons: [icon192] },
      { name: "Contact", url: "/contact", icons: [icon192] },
    ],
    screenshots: [
      { src: "/screenshots/narrow-home.png", sizes: "1080x2400", type: "image/png", form_factor: "narrow", label: "TAKATAK home on a phone" },
      { src: "/screenshots/narrow-services.png", sizes: "1080x2400", type: "image/png", form_factor: "narrow", label: "TAKATAK services on a phone" },
      { src: "/screenshots/wide-home.png", sizes: "1440x900", type: "image/png", form_factor: "wide", label: "TAKATAK on a computer" },
    ],
  };
}

// Digital Asset Links for the Google Play app (Trusted Web Activity) that opens takatak.ca full screen.
// TAKATAK_ANDROID_CERT_SHA256: one to four SHA-256 signing-certificate fingerprints (AA:BB:…, comma
// separated), copied from Play Console › App integrity. TAKATAK_ANDROID_PACKAGE: app id (default ca.takatak.app).
// Returns null (the route answers 404) until a valid fingerprint is configured.
export function androidAssetLinks(env: Record<string, string | undefined>) {
  const fingerprints = String(env.TAKATAK_ANDROID_CERT_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  const packageName = String(env.TAKATAK_ANDROID_PACKAGE ?? PWA_APP_ID).trim();
  if (!fingerprints.length || fingerprints.length > 4) return null;
  if (!fingerprints.every((value) => /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/u.test(value))) return null;
  if (packageName.length > 150 || !/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u.test(packageName)) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: packageName, sha256_cert_fingerprints: fingerprints },
    },
  ];
}
