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
          background: "radial-gradient(circle at 80% 0%, #12306b 0%, #0B1B3D 40%, #060D1F 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#1F8BFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
              color: "#FFFFFF",
            }}
          >
            T
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: 2 }}>{brand.brandName}</div>
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 28, color: "#29C3FF" }}>{brand.domain}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 960 }}>
            Websites, domains, hosting &amp; growth
          </div>
          <div style={{ fontSize: 30, color: "#29C3FF", maxWidth: 960, letterSpacing: 2 }}>Digital Solutions. Real Results.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {SERVICES.map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "8px 16px",
                borderRadius: 999,
                border: "2px solid rgba(41, 195, 255, 0.45)",
                fontSize: 22,
                color: "#D6ECFF",
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
