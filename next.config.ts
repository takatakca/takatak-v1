import type { NextConfig } from "next";

// Security headers (owner, Nov 4 2026: "100 % on every scanner, even security").
// - HSTS: production is https://takatak.ca. One year, this host only (no includeSubDomains
//   or preload until every takatak.ca subdomain is confirmed on HTTPS).
// - CSP: a baseline that cannot break hydration, auth, Stripe or Upmind (no script/style
//   allow-list yet): no plugins, no <base> hijack, no framing by other sites, forms post
//   to this site or HTTPS only. A strict nonce-based CSP needs the auth proxy and is a
//   separate change (docs/TAKATAK_V1_SECURITY_CHECKLIST.md).
// - Permissions: the site itself may ask for the microphone (TAK-TAK dictation), the
//   camera and screen sharing (calls), full screen, passkeys and SMS one-time codes
//   (sign-in); embedded third parties may not. Location, USB and Bluetooth are off.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  {
    key: "Content-Security-Policy",
    value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https:",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), publickey-credentials-get=(self), otp-credentials=(self), geolocation=(), usb=(), bluetooth=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  // Do not announce the framework in every response (scanners flag X-Powered-By).
  poweredByHeader: false,
  // Keep Prisma out of the bundle so Node resolves the real package names.
  // Production builds MUST use webpack (`next build --webpack`). Next.js 16
  // Turbopack rewrites these to hashed aliases such as
  // `@prisma/client-<hash>` which do not exist in node_modules.
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "@prisma/adapter-pg",
    "pg",
  ],
  // Dev-only access logger. Production Next builds do not emit this logger;
  // production first-hop protection requires META_OAUTH_REDIRECT_URI → relay.
  logging: {
    incomingRequests: {
      ignore: [/\/api\/social\/callback\//],
    },
  },

  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host" as const, value: "review\\.takatak\\.ca" }],
          destination: "/reviews",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  async redirects() {
    // The domain and hosting pages live at /domain and /hosting. /services/domains and
    // /services/hosting showed the same page at a second address, which Google Search Console
    // reported as "Duplicate, Google chose different canonical than user" (2026-11-09).
    // The query string (?lang=fr) is passed through.
    const duplicateServicePages = [
      { source: "/services/domains", destination: "/domain", permanent: true },
      { source: "/services/hosting", destination: "/hosting", permanent: true },
    ];
    const reviewHost = ["dashboard", "login", "register", "signup", "auth", "oauth"].map((route) => ({
      source: `/${route}/:path*`,
      has: [{ type: "host" as const, value: "review\\.takatak\\.ca" }],
      destination: `https://takatak.ca/${route}/:path*`,
      permanent: false,
    }));
    return [...duplicateServicePages, ...reviewHost];
  },
  async headers() {
    const privateNoStore = [
      {
        key: "Cache-Control",
        value: "private, no-store, no-cache, must-revalidate",
      },
      { key: "Pragma", value: "no-cache" },
      { key: "Vary", value: "Cookie" },
    ];
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/dashboard/:path*",
        headers: privateNoStore,
      },
      {
        source: "/dashboard",
        headers: privateNoStore,
      },
      {
        source: "/api/:path*",
        headers: privateNoStore,
      },
      {
        source: "/auth/:path*",
        headers: privateNoStore,
      },
      {
        source: "/oauth",
        headers: [
          ...privateNoStore,
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      {
        source: "/oauth/:path*",
        headers: [
          ...privateNoStore,
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
