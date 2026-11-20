import type { MetadataRoute } from "next";

import { takatakManifest } from "@/lib/pwa/manifest";

// Served at /manifest.webmanifest; Next.js adds the <link rel="manifest"> to every page.
export default function manifest(): MetadataRoute.Manifest {
  return takatakManifest();
}
