import type { NextConfig } from "next";

// Phase 14 — conservative security-header baseline.
// Strict CSP is deliberately DEFERRED (documented in
// docs/TAKATAK_V1_SECURITY_CHECKLIST.md): an untested strict policy can break
// Next.js hydration and auth flows. HSTS should be enabled at the platform
// level once the production HTTPS domain is confirmed.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
