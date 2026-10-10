import type { Metadata } from "next";

import { OwnedBrandsContent } from "@/components/website/pages/owned-brands-content";
import { hasOwnedBrands } from "@/lib/website/owned-brands";

export const metadata: Metadata = {
  title: "Our brands",
  description: "GROUPE TAKATAK proudly owns and operates these brands.",
  alternates: { canonical: "/ecosystem" },
  // Kept out of search results until the owner's registry confirms at least one brand.
  robots: hasOwnedBrands ? undefined : { index: false, follow: true },
};

export default function EcosystemPage() {
  return <OwnedBrandsContent />;
}
