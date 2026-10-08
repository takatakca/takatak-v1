import { ImageResponse } from "next/og";

import { brand } from "@/lib/website/brand";

// Shared social preview image for every public website page (og:image).
// Generated once at build time; uses only the built-in font.

export const alt = `${brand.brandName} — Websites, domains, hosting & growth`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SERVICES = ["Websites", "Domains", "Hosting", "Social media", "Local listings", "SEO", "Reviews"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0f172a 0%, #111827 55%, #064e3b 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            T
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: 2 }}>{brand.brandName}</div>
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 28, color: "#6ee7b7" }}>{brand.domain}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 960 }}>
            Websites, domains, hosting &amp; growth
          </div>
          <div style={{ fontSize: 30, color: "#a7f3d0", maxWidth: 960 }}>{brand.positioning}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {SERVICES.map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "8px 16px",
                borderRadius: 999,
                border: "2px solid rgba(167, 243, 208, 0.45)",
                fontSize: 22,
                color: "#d1fae5",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
